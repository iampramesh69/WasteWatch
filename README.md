# WasteWatch

A modular, multi-page community waste reporting app. The frontend is split into separate HTML pages and JavaScript ES modules. The backend is a Node.js + Express REST API, with SQLite as the database and an uploads folder for photos.

## What works

- Dashboard with total, open, cleaned and repeat-location counts
- Separate **Report**, **All reports**, **Hotspots**, and **About** pages
- Create a report with category, date, location, description and optional image
- Choose report coordinates by clicking an interactive Leaflet/OpenStreetMap map or using device GPS permission (optional)
- View geotagged reports on a separate interactive map page (older reports without coordinates still work)
- Server-side validation for required fields and length limits
- Photo uploads (JPEG, PNG, WEBP or GIF, max 5 MB)
- Search and filter reports
- Citizen registration and login with hashed passwords and signed, HttpOnly session cookies
- Server-side role checks: citizens can delete only their own reports; admins can manage all reports
- Admin-only status management, demo-data controls and cleanup-proof photo uploads
- A report cannot be marked Cleaned unless an after-cleanup photo is supplied (or one is already saved)
- Load and clear clearly labelled simulated demo reports (admin only)
- Recurring-location detection and simple rule-based prevention suggestions
- SQLite persistence: data remains after server restarts
- Docker files for a first deployment on an AWS EC2 instance

## Accounts and roles

- Open `http://localhost:3000/login.html` to register a citizen account or log in. New registrations are always `user` accounts; the public registration form cannot create admins.
- On a fresh local database, a demo admin is created automatically: **`admin@wastewatch.local` / `ChangeMe123!`**. Use this only for local judging/demo; change it before deploying anywhere public.
- For a deployment, set environment variables before starting the server: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and a long random `SESSION_SECRET`. Example PowerShell:

```powershell
$env:ADMIN_EMAIL = "municipal-admin@example.org"
$env:ADMIN_PASSWORD = "use-a-long-unique-password"
$env:SESSION_SECRET = "replace-with-a-long-random-secret"
npm start
```

- The first admin account is created at startup only if that email does not already exist. If you change `ADMIN_PASSWORD` after the account has already been created, it does not automatically overwrite the existing password.
- Citizens can submit reports, view public reports and delete only their own reports. Admins can update status, delete any report, and attach an after-cleanup photo. Marking a report `Cleaned` requires a proof image. The server enforces these permissions even if someone tries to call the API directly.
- This is a hackathon, not a fully hardened public-sector deployment. Before real deployment, add HTTPS, rate limiting, admin invitation/verification, backups, audit logs and a formal privacy policy.

## Project structure

```text
wastewatch/
├── public/
│   ├── login.html                 # Citizen registration and login
│   ├── index.html                 # Dashboard page
│   ├── report.html                # Create-report page
│   ├── reports.html               # Search/manage reports page
│   ├── map.html                   # Interactive map of geotagged reports
│   ├── hotspots.html              # Repeat-location insights
│   ├── about.html                 # Project and architecture explanation
│   ├── css/
│   │   └── styles.css             # Shared responsive design
│   └── js/
│       ├── api.js                 # All frontend HTTP/API calls
│       ├── ui.js                  # Shared navigation, rendering, helpers
│       └── pages/
│           ├── dashboard.js       # Dashboard behaviour only
│           ├── report-form.js     # Report form and image upload
│           ├── reports.js         # Search, filters, status, delete
│           ├── hotspots.js        # Repeat-location analysis
│           └── about.js           # About-page setup
├── src/
│   └── database.js                # SQLite schema and database operations
├── data/                          # Created SQLite database at runtime
├── uploads/                       # Uploaded images stored on server
├── server.js                      # Express server and REST endpoints
├── package.json
├── Dockerfile
└── docker-compose.yml
```

### How the pieces connect

```text
Browser page (HTML + page module)
          │ fetch()
          ▼
public/js/api.js  ── HTTP /api/... ──► server.js (Express)
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                       src/database.js         uploads/
                              │                image files
                              ▼
                    data/wastewatch.sqlite
```

The browser does **not** connect directly to SQLite. It sends HTTP requests to the backend API; the backend validates the request and reads/writes the database. Map coordinates are stored in the same SQLite report row as optional `latitude` and `longitude` values. Startup safely adds these columns to older databases if they are missing.

## Run locally

Install **Node.js 20 or newer** first. Then open a terminal in this folder and run:

```bash
npm install
npm start
```

Open <http://localhost:3000>. Do not open the HTML files by double-clicking them: the pages call the backend API, so they must be served by the Node server.

For automatic restarts while developing:

```bash
npm run dev
```

Check the API at <http://localhost:3000/api/health>. A successful response looks like `{"ok":true,"service":"WasteWatch API"}`.

Open <http://localhost:3000/map.html> to view geotagged reports. On the report form, click the map to choose a point or select **Use my location** and grant browser permission. Device geolocation requires `localhost` or a secure HTTPS origin. The browser reports both coordinates and an estimated accuracy; desktop browsers may return approximate Wi-Fi/IP-based locations. If accuracy is poor or the pin appears in the wrong city, manually click/drag the pin or check operating-system location settings. The initial map view is centered on Tanakpur for this demo and can be changed in the page modules. Coordinates are optional, so reports can still be submitted without them.

## Database and uploads

- SQLite database: `data/wastewatch.sqlite`
- Report photos: `uploads/`
- Both are created automatically when the server starts or the first photo is uploaded.
- Back up both the `data/` and `uploads/` folders together.
- The demo-data button deletes/replaces only records marked as simulated. It does not delete user-created reports.

## Map dependencies

The map uses Leaflet 1.9.4 and standard OpenStreetMap tiles from their public CDN/tile service. It does not require an API key. An internet connection is needed for the map library and tiles. Keep OpenStreetMap attribution visible and follow the tile usage policy; for heavy production traffic, use a tile provider suited to your expected usage. Browser GPS prompts for user permission and does not send coordinates anywhere until the user submits the report.

## API endpoints

| Method   | Endpoint           | Purpose                                                                |
| -------- | ------------------ | ---------------------------------------------------------------------- |
| `GET`    | `/api/health`      | Health check                                                           |
| `GET`    | `/api/reports`     | List reports; supports `search`, `status`, `category` query parameters |
| `GET`    | `/api/reports/:id` | Get one report                                                         |
| `POST`   | `/api/reports`     | Create a report (`multipart/form-data`, optional `photo`)              |
| `PATCH`  | `/api/reports/:id` | Update status; optional `cleanupPhoto` upload supported by API         |
| `DELETE` | `/api/reports/:id` | Delete a report                                                        |
| `POST`   | `/api/demo/seed`   | Replace simulated records with sample data                             |
| `DELETE` | `/api/demo`        | Delete simulated records only                                          |

## Deploy on AWS

The included Docker setup is intended for a simple first demo on **Amazon EC2**. It is not a complete production deployment.

1. Create an EC2 instance in your AWS account and allow inbound TCP `80` from the internet. Keep SSH (`22`) restricted to your own IP. Do not expose port `3000` publicly if you use a reverse proxy.
2. Install Docker and the Docker Compose plugin on the instance.
3. Copy or clone this project onto the instance. Never upload `node_modules`, real user data, or secrets to a public Git repository.
4. In the project directory run:

   ```bash
   docker compose up -d --build
   docker compose logs -f
   ```

5. For a quick private test, browse to `http://EC2-PUBLIC-IP:3000` after allowing port `3000` from **your IP only** in the EC2 security group. For a public demo, configure a domain, HTTPS (for example with Caddy or Nginx plus a certificate), and expose only ports 80/443.
6. Keep the Docker named volumes `wastewatch_data` and `wastewatch_uploads`; they preserve the SQLite database and photos when the container is recreated. Back them up. Deleting the volumes deletes the app data.

**Important AWS limitations:** SQLite and local photo files are appropriate for a small demonstration on one persistent EC2 host, not a horizontally scaled production service. For multiple app instances, migrate metadata to Amazon RDS or DynamoDB and photos to a private S3 bucket. Add authentication/roles, HTTPS, rate limiting, backups, logging, input scanning and AWS Budgets before public use. No AWS resources have been created by this project.

## security limits

- There is no login or authorization yet. Anyone who can access the app can submit, change status or delete reports. Keep it private while testing.
- This does not verify whether a cleanup actually happened; status changes are self-reported.
- Hotspot matching uses normalized text location names, not GPS or AI.
- Images are stored on the app server. Do not upload sensitive photos.
- Check your AWS region's current pricing before creating resources.

## AWS EC2 deployment with Docker + free HTTPS

This package includes a Caddy reverse proxy so the app can run behind HTTPS. Before `docker compose up`, create a `.env` file from `.env.example` and set `DOMAIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `SESSION_SECRET`. Point the DNS name at the EC2 public IP and allow inbound TCP 80/443 plus SSH 22 from your own IP only. Do not expose port 3000 publicly. Caddy obtains and renews a TLS certificate automatically when DNS and firewall rules are correct.

The SQLite database and uploaded photos are stored in Docker named volumes on the EC2 root disk. Back them up. Stopping the instance does not erase them, but terminating an instance may delete its root EBS volume depending on the volume's Delete on termination setting. AWS usage may incur charges; check your account's Free Tier/credits and Billing console.
