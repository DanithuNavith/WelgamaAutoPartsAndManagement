"""
stockflag.py  -  shared code for the Welgama Auto low-stock early-warning model.

Used by the notebook (training) AND by the app (scoring), so the features
are computed identically in both places.

Public API
----------
simulate_history(products, ...)   -> panel, jobs     (synthetic sales history)
build_features(panel, jobs, products, latest_only=False) -> feature table
score_products(bundle, products, daily_log, jobs_log) -> flag table (what the app shows)
load_bundle(path)                 -> dict with models + config
"""
import numpy as np
import pandas as pd
import joblib

HORIZON = 7  # days ahead we warn about

CAT_FEATURES = ["category", "make", "part_type"]
NUM_FEATURES = [
    "stock", "threshold", "headroom", "headroom_ratio",
    "sales_1", "sales_7", "sales_14", "sales_28", "sales_56",
    "avg_28", "std_28", "trend_7_vs_28", "days_cover", "naive_proj_7",
    "days_since_restock", "last_restock_qty",
    "jobs_last7", "booked_next7", "booked_vs_last",
    "dow", "dom", "month_sin", "month_cos",
    "price", "margin_pct",
]
FEATURES = CAT_FEATURES + NUM_FEATURES

MAKES = ["Toyota", "Suzuki", "Honda", "Nissan", "Daihatsu", "Hyundai"]
# words that identify the vehicle model (removed to leave the part type)
MODEL_WORDS = ["Aqua", "Wagon R", "Fit", "Vitz", "March", "Move", "Eon"]


# ----------------------------------------------------------------------------
# product parsing
# ----------------------------------------------------------------------------
def parse_products(df):
    """Clean the raw Mongo export: drop image/__v, derive make + part_type."""
    p = df.drop(columns=[c for c in ["image", "__v"] if c in df.columns]).copy()
    p = p.rename(columns={"_id": "product_id", "lowStockThreshold": "threshold",
                          "costPrice": "cost_price"})
    def split(name):
        make = next((m for m in MAKES if name.startswith(m)), "Other")
        rest = name[len(make):].strip() if make != "Other" else name
        for mw in MODEL_WORDS:
            if rest.startswith(mw):
                rest = rest[len(mw):].strip()
                break
        return make, rest
    mk = p["name"].apply(split)
    p["make"] = [m for m, _ in mk]
    p["part_type"] = [r for _, r in mk]
    p["margin_pct"] = (p["price"] - p["cost_price"]) / p["price"]
    return p


# ----------------------------------------------------------------------------
# synthetic history  (ASSUMPTIONS - replace with real logs when available)
# ----------------------------------------------------------------------------
# base units/day for an average vehicle make, by part type
BASE_RATE = {
    "Oil Filter": 1.2, "Air Filter": 0.7, "Cabin Filter": 0.5, "Fuel Filter": 0.4,
    "Spark Plug": 1.5, "Brake Pad": 0.8, "Brake Disc": 0.35, "Wheel Cylinder": 0.3,
    "Wheel Bearing": 0.3, "Stabilizer Link": 0.3, "Wiper Blade": 1.0, "Radiator Hose": 0.25,
    "Front Bumper": 0.12, "Rear Bumper": 0.10, "Headlight": 0.22, "Tail Light": 0.20,
    "Headlight Lens": 0.15, "Rear Door": 0.06, "Door": 0.06, "Door Panel": 0.10,
    "Side Mirror": 0.20, "Side Mirror Cover": 0.25, "Rim Cap": 0.40, "Spoiler": 0.08,
    "Badge/Emblem": 0.25, "Front Grille": 0.12, "Bonnet": 0.06,
}
# how popular each make is in a Sri Lankan garage (Aqua / Wagon R dominate)
MAKE_POP = {"Toyota": 1.15, "Suzuki": 1.1, "Honda": 0.9, "Nissan": 0.6, "Daihatsu": 0.5, "Hyundai": 0.4}
# monsoon-sensitive categories: multiplier by calendar month (1..12)
_MONSOON = [1.0, 0.95, 0.95, 1.0, 1.25, 1.35, 1.25, 1.2, 1.2, 1.25, 1.2, 1.05]
_NEUTRAL = [1.0] * 12
_BODY_SUMMER = [1.05, 1.1, 1.1, 1.15, 0.95, 0.9, 0.9, 0.95, 1.0, 1.0, 1.0, 1.1]
CAT_SEASON = {
    "Accessories": _MONSOON, "Brake System": _MONSOON, "Lighting": _MONSOON,
    "Suspension": [1.0, 1.0, 1.0, 1.05, 1.1, 1.15, 1.1, 1.1, 1.05, 1.1, 1.1, 1.0],
    "Body Parts": _BODY_SUMMER,
}
SLOW_LEAD = {"Body Parts", "Door Parts", "Lighting", "Body Accessories", "Exterior Accessories", "Wheel Accessories"}


def simulate_history(products, start="2024-10-01", end="2026-09-30", seed=42):
    """Simulate daily jobs, sales, restocks and stock for each product.

    Reorder policy (what the shop does today): when stock <= lowStockThreshold an
    order is placed (0-2 day delay), supplier lead time 2-5 d (fast parts) or
    4-9 d (body/lighting), order-up-to level S. Lost sales when out of stock.
    Returns (panel, jobs). panel: one row per product per day.
    """
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start, end, freq="D")
    n = len(dates)

    # ---- shop-level daily job count (drives all part demand) ----
    dow = dates.dayofweek.values
    wk = np.select([dow == 6, dow == 5], [0.25, 1.15], 1.0)
    month = dates.month.values
    job_season = np.array([1.0, 0.95, 1.0, 0.95, 1.1, 1.15, 1.1, 1.1, 1.05, 1.1, 1.05, 0.95])[month - 1]
    trend = 1 + 0.0004 * np.arange(n)
    pay = np.where(dates.day.values >= 26, 1.12, 1.0)  # salary-week bump
    closed = ((month == 4) & np.isin(dates.day.values, [13, 14])) | ((month == 12) & (dates.day.values == 25)) \
             | ((month == 1) & (dates.day.values == 1))
    ar = np.zeros(n); e = rng.normal(0, 0.12, n)
    for i in range(1, n):
        ar[i] = 0.85 * ar[i - 1] + e[i]            # busy / quiet spells
    lam_jobs = 14 * wk * job_season * trend * pay * np.exp(ar) * np.where(closed, 0.05, 1.0)
    jobs = rng.poisson(lam_jobs)
    booked = rng.binomial(jobs, 0.6)               # jobs already booked a few days ahead
    jobs_df = pd.DataFrame({"date": dates, "jobs": jobs, "booked": booked})
    job_index = jobs / 14.0

    rows = []
    for _, p in products.iterrows():
        base = BASE_RATE[p["part_type"]] * MAKE_POP.get(p["make"], 0.5)
        seas = np.array(CAT_SEASON.get(p["category"], _NEUTRAL))[month - 1]
        mu = base * seas * job_index
        # over-dispersion (gamma-Poisson) + rare bulk/fleet orders
        g = rng.gamma(4.0, 1 / 4.0, n)
        sales = rng.poisson(mu * g)
        bulk = rng.random(n) < (0.004 if base > 0.3 else 0.0)
        sales = sales + bulk * rng.integers(3, 7, n)

        thr = int(p["threshold"]); q0 = int(p["quantity"])
        S = q0 if q0 > 1.5 * thr else 2 * thr + 4       # order-up-to level
        lead_rng = (4, 10) if p["category"] in SLOW_LEAD else (2, 6)
        stock = S; order_day = None; arrive = None; pending = False
        last_rs = -1; last_rs_qty = S
        st = np.zeros(n, int); sold = np.zeros(n, int); rs = np.zeros(n, int)
        for i in range(n):
            if arrive is not None and i == arrive:
                rs[i] = order_qty; stock += order_qty; pending = False; arrive = None
            s = min(sales[i], stock); sold[i] = s; stock -= s
            if stock <= thr and not pending:
                pending = True
                delay = rng.choice([0, 1, 2], p=[0.6, 0.25, 0.15])
                arrive = i + delay + int(rng.integers(*lead_rng))
                order_qty = S - stock
            st[i] = stock
        rows.append(pd.DataFrame({"date": dates, "product_id": p["product_id"], "sold": sold,
                                  "restocked": rs, "stock": st}))
    panel = pd.concat(rows, ignore_index=True)
    return panel, jobs_df


# ----------------------------------------------------------------------------
# features  (only uses information available at the END of day t)
# ----------------------------------------------------------------------------
def build_features(panel, jobs, products, latest_only=False, with_target=False):
    """panel: date, product_id, sold, restocked, stock.  jobs: date, jobs, booked.
    booked(d) = jobs already booked for day d, known in advance, so the sum of
    booked over t+1..t+7 is a legitimate feature at time t.
    """
    pr = products.set_index("product_id")
    jb = jobs.sort_values("date").set_index("date").copy()
    jb["jobs_last7"] = jb["jobs"].rolling(7, min_periods=1).sum()
    jb["booked_next7"] = jb["booked"][::-1].rolling(HORIZON, min_periods=1).sum()[::-1].shift(-1)
    # booked_next7 at day t = booked(t+1..t+7); in live use pass the bookings list
    jb["month"] = jb.index.month
    out = []
    for pid, g in panel.sort_values(["product_id", "date"]).groupby("product_id", sort=False):
        g = g.set_index("date").copy()
        s = g["sold"].astype(float)
        f = pd.DataFrame(index=g.index)
        f["product_id"] = pid
        f["stock"] = g["stock"]
        f["threshold"] = pr.loc[pid, "threshold"]
        f["headroom"] = f["stock"] - f["threshold"]
        f["headroom_ratio"] = f["headroom"] / f["threshold"]
        f["sales_1"] = s
        for w in (7, 14, 28, 56):
            f[f"sales_{w}"] = s.rolling(w, min_periods=1).sum()
        f["avg_28"] = s.rolling(28, min_periods=1).mean()
        f["std_28"] = s.rolling(28, min_periods=2).std().fillna(0)
        f["trend_7_vs_28"] = (f["sales_7"] / 7) / (f["avg_28"] + 0.05)
        f["days_cover"] = (f["headroom"] / (f["avg_28"] + 0.02)).clip(upper=120)
        f["naive_proj_7"] = f["headroom"] - HORIZON * f["avg_28"]
        ridx = np.where(g["restocked"].values > 0, np.arange(len(g)), np.nan)
        last = pd.Series(ridx, index=g.index).ffill()
        f["days_since_restock"] = (np.arange(len(g)) - last).fillna(60).clip(upper=60)
        f["last_restock_qty"] = g["restocked"].where(g["restocked"] > 0).ffill().fillna(0)
        f["jobs_last7"] = jb["jobs_last7"].reindex(g.index)
        f["booked_next7"] = jb["booked_next7"].reindex(g.index)
        f["booked_vs_last"] = f["booked_next7"] / (f["jobs_last7"] * 0.6 + 1)
        f["dow"] = g.index.dayofweek
        f["dom"] = g.index.day
        f["month_sin"] = np.sin(2 * np.pi * g.index.month / 12)
        f["month_cos"] = np.cos(2 * np.pi * g.index.month / 12)
        f["price"] = pr.loc[pid, "price"]
        f["margin_pct"] = pr.loc[pid, "margin_pct"]
        for c in CAT_FEATURES:
            f[c] = pr.loc[pid, c]
        if with_target:
            fut_min = g["stock"][::-1].rolling(HORIZON, min_periods=HORIZON).min()[::-1].shift(-1)
            fut_dem = s[::-1].rolling(HORIZON, min_periods=HORIZON).sum()[::-1].shift(-1)
            f["y_low7"] = (fut_min <= f["threshold"]).astype(float).where(fut_min.notna())
            f["y_demand7"] = fut_dem
            f["y_min_stock7"] = fut_min
        out.append(f.iloc[[-1]] if latest_only else f)
    res = pd.concat(out).reset_index().rename(columns={"index": "date"})
    return res


# ----------------------------------------------------------------------------
# scoring (used by the app)
# ----------------------------------------------------------------------------
def load_bundle(path):
    return joblib.load(path)


def score_products(bundle, products, daily_log, jobs_log, booked_next7=None):
    """Return one row per product with risk flag, probability, days-to-threshold,
    recommended reorder qty.

    products   : raw/parsed products (needs quantity + lowStockThreshold or threshold)
    daily_log  : >= 56 days of (date, product_id, sold, restocked)
    jobs_log   : date, jobs, booked   (booked for future days may be appended;
                 if not, pass booked_next7 = expected number of booked jobs next 7 d)
    """
    p = products if "part_type" in products.columns else parse_products(products)
    today = daily_log["date"].max()
    cur = p.set_index("product_id")["quantity"]
    panel = daily_log.copy()
    panel["stock"] = np.nan
    panel.loc[panel["date"] == today, "stock"] = panel.loc[panel["date"] == today, "product_id"].map(cur)
    jl = jobs_log.copy()
    if booked_next7 is not None:   # append 7 future days carrying the booked total
        fut = pd.DataFrame({"date": pd.date_range(today + pd.Timedelta(days=1), periods=HORIZON),
                            "jobs": 0, "booked": booked_next7 / HORIZON})
        jl = pd.concat([jl, fut], ignore_index=True)
    X = build_features(panel, jl, p, latest_only=True)
    X = X[X["date"] == today].copy()
    X["stock"] = X["product_id"].map(cur).values
    X["headroom"] = X["stock"] - X["threshold"]
    X["headroom_ratio"] = X["headroom"] / X["threshold"]
    X["days_cover"] = (X["headroom"] / (X["avg_28"] + 0.02)).clip(upper=120)
    X["naive_proj_7"] = X["headroom"] - HORIZON * X["avg_28"]

    proba = bundle["calibrator"].predict(bundle["clf"].predict_proba(X[FEATURES])[:, 1])
    daily = np.clip(bundle["reg"].predict(X[FEATURES]) / HORIZON, 0.01, None)
    X["p_low_7d"] = np.where(X["stock"] <= X["threshold"], 1.0, proba)   # already low = certain
    X["pred_daily_demand"] = daily
    X["days_to_threshold"] = np.where(X["headroom"] <= 0, 0, (X["headroom"] / daily)).round(1)
    cut, hi = bundle["cutoff"], bundle["high_cutoff"]
    X["flag"] = np.select(
        [X["stock"] <= X["threshold"], X["p_low_7d"] >= hi, X["p_low_7d"] >= cut],
        ["CRITICAL - already low", "HIGH - reorder now", "WATCH - likely low within 7 days"], "OK")
    lead = X["category"].isin(SLOW_LEAD).map({True: 7, False: 4})
    order_up_to = X["threshold"] + daily * (lead + HORIZON)
    X["suggested_order_qty"] = np.where(X["flag"] == "OK", 0,
                                        np.ceil(np.clip(order_up_to - X["stock"], 0, None))).astype(int)
    names = p.set_index("product_id")["name"]
    X["name"] = X["product_id"].map(names)
    cols = ["name", "category", "stock", "threshold", "p_low_7d", "days_to_threshold",
            "pred_daily_demand", "flag", "suggested_order_qty", "product_id"]
    order = {"CRITICAL": 0, "HIGH": 1, "WATCH": 2, "OK": 3}
    X["_o"] = X["flag"].str.split(" ").str[0].map(order)
    return X.sort_values(["_o", "p_low_7d"], ascending=[True, False])[cols].reset_index(drop=True)
