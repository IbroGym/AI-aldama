# Staging deployment (domain + HTTPS)

This project can be tested from many devices by running it in production mode and putting Nginx in front.

## 1) Server prerequisites

- Ubuntu/Debian VM with public IP
- DNS A record: `staging.yourdomain.com` -> your server public IP
- Open ports: `80`, `443` (and optional `22` for SSH)

Install runtime:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Install Node.js (if needed):

```bash
node -v
npm -v
```

## 2) Upload app and install dependencies

```bash
cd /opt
git clone <your-repo-url> bus-stop-system-architecture
cd /opt/bus-stop-system-architecture
npm ci
```

## 3) Configure environment

Create `.env.local` in `/opt/bus-stop-system-architecture` with the same env values you use locally (especially Supabase keys).

At minimum:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_KIOSK_ID=demo
```

## 4) Build and run production app

```bash
cd /opt/bus-stop-system-architecture
npm run build
npm run start:public
```

The app will listen at `http://0.0.0.0:3001`.

## 5) Configure Nginx reverse proxy

1. Copy `deploy/nginx.staging.conf` to Nginx sites:

```bash
sudo cp deploy/nginx.staging.conf /etc/nginx/sites-available/bus-stop-staging
```

2. Edit server name:

```bash
sudo nano /etc/nginx/sites-available/bus-stop-staging
```

Replace `staging.example.com` with your real domain.

3. Enable site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/bus-stop-staging /etc/nginx/sites-enabled/bus-stop-staging
sudo nginx -t
sudo systemctl reload nginx
```

## 6) Enable HTTPS certificate

```bash
sudo certbot --nginx -d staging.yourdomain.com
```

Certbot updates Nginx config automatically and configures renewal.

## 7) Make app persistent (systemd)

1. Copy service file:

```bash
sudo cp deploy/bus-stop-staging.service /etc/systemd/system/
```

2. Update service values:
- `User=...` (your Linux user)
- `WorkingDirectory=...` (actual path)

3. Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable bus-stop-staging
sudo systemctl restart bus-stop-staging
sudo systemctl status bus-stop-staging
```

## 8) Validation checklist (multi-device kiosk tests)

- Open `https://staging.yourdomain.com/kiosk` from phone + tablet + laptop.
- Verify idle overlay exits when pressing/clicking.
- Verify route polylines are visible in `https://staging.yourdomain.com/dashboard/map`.
- Verify API calls to `/api/map/transit` and `/api/vehicles` return 200 in browser Network tab.
- Verify no console errors about blocked dev origins or mixed content.
