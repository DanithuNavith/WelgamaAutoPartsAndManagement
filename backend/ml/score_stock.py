"""Score current stock against the bundled model and replace Mongo stock_flags."""
import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
from bson import ObjectId
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "AI Models"
sys.path.insert(0, str(MODEL_DIR))
import stockflag


def to_id(value):
    return str(value) if isinstance(value, ObjectId) else str(value)


def mongo_records(db, start, end):
    products = list(db.products.find({}, {"image": 0, "__v": 0}))
    if not products:
        raise RuntimeError("No products found in MongoDB.")
    for product in products:
        product["_id"] = to_id(product["_id"])
    product_ids = {str(product["_id"]) for product in products}
    sales = db.sales.find(
        {"createdAt": {"$gte": start, "$lt": end}, "billType": {"$ne": "REPAIR"}},
        {"items.product": 1, "items.quantity": 1, "createdAt": 1},
    )
    daily_sales = {}
    for sale in sales:
        date = sale["createdAt"].date()
        for item in sale.get("items", []):
            product_id = to_id(item.get("product", ""))
            if product_id in product_ids:
                key = (date, product_id)
                daily_sales[key] = daily_sales.get(key, 0) + int(item.get("quantity", 0))

    restock_dates = {}
    orders = db.purchaseorders.find(
        {
            "status": "Received",
            "$or": [
                {"receivedAt": {"$gte": start, "$lt": end}},
                {"receivedAt": {"$exists": False}, "updatedAt": {"$gte": start, "$lt": end}},
            ],
        },
        {"items.product": 1, "items.quantity": 1, "receivedAt": 1, "updatedAt": 1},
    )
    for order in orders:
        date = (order.get("receivedAt") or order["updatedAt"]).date()
        for item in order.get("items", []):
            product_id = to_id(item.get("product", ""))
            if product_id in product_ids:
                key = (date, product_id)
                restock_dates[key] = restock_dates.get(key, 0) + int(item.get("quantity", 0))

    job_counts = {}
    booked_counts = {}
    future_end = end + timedelta(days=7)
    jobs = db.jobcards.find(
        {"appointmentDate": {"$gte": start, "$lt": future_end}},
        {"appointmentDate": 1, "partsUsed.product": 1, "partsUsed.quantity": 1},
    )
    for job in jobs:
        date = job["appointmentDate"].date()
        booked_counts[date] = booked_counts.get(date, 0) + 1
        if date < end.date():
            job_counts[date] = job_counts.get(date, 0) + 1
            for item in job.get("partsUsed", []):
                product_id = to_id(item.get("product", ""))
                if product_id in product_ids:
                    key = (date, product_id)
                    daily_sales[key] = daily_sales.get(key, 0) + int(item.get("quantity", 0))

    return products, daily_sales, restock_dates, job_counts, booked_counts


def read_mock_csv(db, csv_path, scored_at):
    rows = pd.read_csv(csv_path).fillna("")
    required = {
        "product_id", "name", "category", "stock", "threshold", "p_low_7d",
        "days_to_threshold", "pred_daily_demand", "flag", "suggested_order_qty",
    }
    missing = required.difference(rows.columns)
    if missing:
        raise ValueError(f"Mock CSV is missing required columns: {', '.join(sorted(missing))}")
    documents = []
    for row in rows.to_dict(orient="records"):
        document = {key: row[key] for key in required}
        document.update({
            "product_id": str(document["product_id"]),
            "stock": int(document["stock"]),
            "threshold": int(document["threshold"]),
            "p_low_7d": float(document["p_low_7d"]),
            "days_to_threshold": float(document["days_to_threshold"]),
            "pred_daily_demand": float(document["pred_daily_demand"]),
            "suggested_order_qty": int(document["suggested_order_qty"]),
            "scoredAt": scored_at,
        })
        documents.append(document)
    return documents


def replace_flags(db, documents):
    flags = db.stock_flags
    flags.delete_many({})
    if documents:
        flags.insert_many(documents)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mock-csv",
        help="Load pre-scored example rows instead of scoring live MongoDB history.",
    )
    args = parser.parse_args()
    uri = os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017/welgama-auto")
    db_name = os.environ.get("MONGO_DB_NAME")
    scored_at = datetime.now(timezone.utc)

    with MongoClient(uri, serverSelectionTimeoutMS=10000) as client:
        database = client[db_name] if db_name else client.get_default_database()
        if database is None:
            raise RuntimeError("Set MONGO_DB_NAME or include a database name in MONGO_URI.")
        if args.mock_csv:
            documents = read_mock_csv(database, args.mock_csv, scored_at)
        else:
            today = datetime.now(timezone.utc).date()
            start = datetime.combine(today - timedelta(days=59), datetime.min.time(), timezone.utc)
            end = datetime.combine(today + timedelta(days=1), datetime.min.time(), timezone.utc)
            products, sales, restocks, jobs, booked = mongo_records(database, start, end)
            if not sales:
                raise RuntimeError(
                    "No sales line items or job-card parts-used records were found in the last 60 days. "
                    "Log real demand or run with --mock-csv using the supplied scored example."
                )
            history_days = (today - min(date for date, _ in sales)).days + 1
            if history_days < 56:
                raise RuntimeError(
                    f"Only {history_days} days of demand history are available; "
                    "the model requires at least 56 days. Use --mock-csv until enough real history is logged."
                )
            dates = pd.date_range(start=start.date(), end=(end - timedelta(days=1)).date(), freq="D")
            daily_rows = [
                {
                    "date": date,
                    "product_id": to_id(product["_id"]),
                    "sold": sales.get((date.date(), to_id(product["_id"])), 0),
                    "restocked": restocks.get((date.date(), to_id(product["_id"])), 0),
                }
                for product in products
                for date in dates
            ]
            jobs_log = pd.DataFrame([
                {
                    "date": date,
                    "jobs": jobs.get(date.date(), 0),
                    "booked": booked.get(date.date(), 0),
                }
                for date in dates
            ])
            future_bookings = sum(
                count for date, count in booked.items()
                if end.date() <= date < (end + timedelta(days=7)).date()
            )
            products_frame = pd.DataFrame(products)
            daily_log = pd.DataFrame(daily_rows)
            scored = stockflag.score_products(
                stockflag.load_bundle(MODEL_DIR / "low_stock_model.pkl"),
                products_frame,
                daily_log,
                jobs_log,
                booked_next7=future_bookings,
            )
            documents = scored.to_dict(orient="records")
            for document in documents:
                document["product_id"] = str(document["product_id"])
                document["scoredAt"] = scored_at

        replace_flags(database, documents)
        print(f"Replaced {len(documents)} stock flags; scoredAt={scored_at.isoformat()}")


if __name__ == "__main__":
    main()
