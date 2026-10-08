# WelgamaAutoPartsAndManagement
A web-based Auto Parts Management System developed for Welgama Auto Parts to digitize inventory, sales and billing, vehicle repair management, customer management, and business reporting, improving efficiency, data accuracy, stock visibility, and overall business decision-making.

## Customer repair bookings

Customers can book one-hour repair appointments in hourly slots from 9:00 a.m. through 4:00 p.m. Sri Lanka time. The slot picker checks the selected technician's existing bookings and the Sri Lankan public holiday calendar; the backend repeats these checks when a booking is submitted. Dates on public holidays and times that have passed or are already booked cannot be submitted.

The holiday calendar is provided by the `date-holidays` backend dependency. Update that dependency periodically to receive calendar data updates.

## Repair invoice email

When an owner creates or changes a bill for a completed repair in **Sales & Billing**, the system emails the customer a PDF copy of the invoice. The email address on the customer profile is used first, with the job card email as a fallback. A failed delivery is shown on the invoice with a retry action.

## Production MongoDB connection

Set `MONGO_URI` in the backend environment to the MongoDB Atlas connection string. The backend also accepts `MONGODB_URI` for hosting integrations that provide that variable name. Include a database name such as `welgama-auto` in the URI path, and URL-encode special characters in the database user's password. Set the variable in Hostinger's Node.js app settings for deployment; do not commit a real connection string or database password.

## Deploying on Hostinger

The React website and Express API are served together by the Node.js application, so the main domain displays the website while API requests use the same domain's `/api` paths.

1. In the frontend folder, install dependencies and build the site with `npm.cmd ci` and `npm.cmd run build` on Windows, or `npm ci` and `npm run build` on macOS/Linux. The build writes the static website into `backend/public`.
2. Deploy the backend as a Hostinger Node.js application with application root `backend` and startup file `index.js`. Ensure the generated `backend/public` directory is included in the deployed source.
3. Add `MONGO_URI` (or `MONGODB_URI`) in the app's environment variables and allow Hostinger's outbound IP in MongoDB Atlas Network Access. The backend listens on Hostinger's `PORT`; `/api/health` reports whether its MongoDB connection is ready.
4. Point the main domain to this Node.js application and enable HTTPS. Open the main domain to see the site; open `/api/health` to check the API/database status.

### Send invoices with Gmail

1. Use the Gmail account that should send invoices. In that Google Account, enable **2-Step Verification**, then create an **App password** under **Security → 2-Step Verification → App passwords**. Use the generated app password, not your normal Gmail password.
2. Copy `backend/.env.example` to `backend/.env`.
3. Set `SMTP_USER` to the sender's full Gmail address and `SMTP_PASS` to its App password. Keep the app password private; do not paste it into source code, README files, or chat.
4. Restart the backend. Add the customer's real email address to their customer profile, mark the repair complete, then create the repair bill in **Sales & Billing**. The system emails the PDF invoice to the email on the customer profile (the job card email is used if the profile has no email).
5. Confirm the invoice screen says the bill was emailed. If delivery fails, correct the customer email or SMTP settings and use **Retry email**.

The backend loads settings from `backend/.env` (or `backend/backend.env` if that is the file you created), whether it is started from the project root or the `backend` folder. The Gmail SMTP settings are:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-sender@gmail.com
SMTP_PASS=your-google-app-password
MAIL_FROM=your-sender@gmail.com
```

`MAIL_FROM` is optional and defaults to `SMTP_USER`. The example file contains placeholders only. Never commit `backend/.env` or share real credentials.

## Supplier purchase order email

When an owner creates a purchase order, the system emails the supplier's registered email address with the order number, requested parts, quantities, unit prices, and total. Purchase order emails use the SMTP settings above. If sending fails, the order is still created; the owner can see the failure and retry delivery from **Purchase Orders**. When the supplier marks the order complete, it waits for owner acceptance in **Purchase Orders**. Accepting it adds the ordered quantities to inventory; the supplier's completion alone does not change stock.

## Supplier account welcome email

When an owner creates a supplier login, the system emails the supplier a welcome message with an encrypted PDF containing the login email and password. The PDF opens with the last four digits of the phone number registered for that supplier. Supplier welcome emails use the same SMTP settings above. If delivery fails, the supplier account remains active and the owner can use **Retry welcome email** on the supplier page while it is open.

## Low-stock early warning

The Inventory page's **Stock Alerts** tab uses the supplied, pre-scored example CSV in mock mode by default. Its badge and Spotlight/List views work without the API; the **EXAMPLE CSV · MOCK DATA** label makes that source explicit. To use model results from the backend, set `USE_STOCK_FLAGS_MOCK` to `false` in `frontend/src/pages/StockAlerts.jsx` and restart the frontend. The real API is owner-authenticated at `GET /api/stock-flags`; `POST /api/stock-flags/refresh` runs the scorer and reports failures.

### Install and run the scoring job

Python 3.11 or newer is recommended. From the repository root, create an environment and install the pinned model dependencies:

```powershell
py -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Keep `MONGO_URI` configured in `backend/.env` (or `backend/backend.env`). To score live data, run:

```powershell
backend\.venv\Scripts\python.exe backend\ml\score_stock.py
```

The job reads product data without selecting the image field, non-repair sales line items and job-card parts used as demand history, appointment dates for job/booked counts, and owner-accepted purchase orders as restock events. Repair invoices are excluded from the sale-line demand so their parts are not counted twice; their job-card `partsUsed` entries are used instead. New owner-accepted receipts retain a `receivedAt` date; older received orders fall back to their last-update date. It loads `backend/AI Models/low_stock_model.pkl` through `stockflag.load_bundle`, calls `stockflag.score_products`, and replaces the `stock_flags` collection with the latest rows and `scoredAt`. If no demand history exists, or its earliest record is less than 56 days old, it stops with an explicit error instead of filling the gap with invented history.

To seed flags from the supplied pre-scored example rather than run the model, use:

```powershell
backend\.venv\Scripts\python.exe backend\ml\score_stock.py --mock-csv "backend\AI Models\flagged_products_2026-09-30.csv"
```

Schedule the same live command using Windows Task Scheduler (for example, daily): set the program to the full path of `backend\.venv\Scripts\python.exe`, the argument to the full path of `backend\ml\score_stock.py`, and **Start in** to the `backend` folder. The API refresh button provides a manual run; set `PYTHON_EXECUTABLE` for the backend process if `python` does not resolve to the environment above.

### Data logging and limits

Live model scoring requires actual sale line items or job-card parts-used records with product IDs and quantities over at least 56 days. This app has a `Sale.items` collection path; job cards provide appointment dates and parts used; purchase orders marked **Received** provide owner-accepted quantities and their `receivedAt` date. This repository does not yet keep a dedicated goods-received event/partial-receipt history. For better forecasts, keep recording each sale's product and quantity, each actual receipt's product and received quantity/date (including partial receipts), and each job card's appointment date and parts used. Jobs and appointments are currently counted by appointment date.
