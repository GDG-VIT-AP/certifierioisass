# Certifier -- Certificate Generation & Distribution

Certificate generation and management system for GDG OnCampus VIT-AP. Upload a template image, import participants from Excel, position name/cert-id/QR layers on a live canvas preview, batch-generate certificates to a database, and email download links to participants.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Hono on Cloudflare Workers |
| Database | Neon PostgreSQL (serverless) via Prisma + @prisma/adapter-neon |
| Email | Gmail REST API (OAuth2) |
| Frontend | React 19 + Vite 7 + Tailwind CSS 4 |
| Image Storage | Cloudinary (unsigned upload) |
| PDF Export | jsPDF + html2canvas |
| QR Codes | qrcode |
| Excel Parsing | xlsx |

## Project Structure

```
backend/
  src/
    index.ts          Hono app -- /generate, /send-emails, /cert/:id
    db.ts             Prisma client factory (Neon adapter)
  prisma/
    schema.prisma     Certificate model
  wrangler.toml       Workers config
  prisma.config.ts    Prisma datasource config

frontend/
  src/
    App.tsx            Routing
    lib/api.ts         API client + Cloudinary upload
    pages/
      GenerateCertificate.tsx   Builder UI
      ViewCertificate.tsx       Certificate display & download
```

## Prerequisites

- Node.js >= 18
- Git Bash (Windows) or any Unix shell
- A Neon PostgreSQL database (https://neon.tech)
- A Cloudinary account with an unsigned upload preset (https://cloudinary.com)
- Gmail OAuth2 credentials (for email sending)
- Cloudflare account (for production deployment)

---

## Local Development

### 1. Clone and install

```bash
git clone <repo-url> && cd certifierioisass
cd backend && npm i
cd ../frontend && npm i
```

### 2. Backend setup

Create `backend/.env`:

```
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
```

Push the schema to your Neon database and generate the Prisma client:

```bash
cd backend
npx prisma db push
npx prisma generate
```

Start the backend dev server (runs on http://localhost:8787):

```bash
npm run dev
```

### 3. Frontend setup

Create `frontend/.env`:

```
VITE_BACKEND_URL=http://localhost:8787
VITE_CERT_VERIFY_BASE_URL=http://localhost:5173
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```

Start the frontend dev server (runs on http://localhost:5173):

```bash
cd frontend
npm run dev
```

### 4. Open in browser

- Builder: http://localhost:5173/generate
- Certificate viewer: http://localhost:5173/cert/:certificateId

---

## Production Deployment

### 1. Database (Neon)

1. Create a project at https://neon.tech
2. Copy the connection string
3. Push the schema:

```bash
cd backend
npx prisma db push
```

### 2. Cloudinary

1. Sign up at https://cloudinary.com
2. From Dashboard, copy your **Cloud Name**
3. Go to Settings > Upload > Upload presets, create a new **unsigned** preset
4. Note the preset name

### 3. Gmail OAuth2

1. Go to https://console.cloud.google.com
2. Create a project, enable the **Gmail API**
3. Create OAuth credentials (Web application)
   - Add `https://developers.google.com/oauthplayground` as an authorized redirect URI
4. Copy the **Client ID** and **Client Secret**
5. Go to https://developers.google.com/oauthplayground
   - Gear icon > check "Use your own OAuth credentials" > paste Client ID + Secret
   - Select `https://www.googleapis.com/auth/gmail.send` > Authorize APIs
   - Sign in with the Gmail account you want to send from
   - Exchange authorization code for tokens > copy the **Refresh Token**
6. Publish the OAuth consent screen (APIs & Services > OAuth consent screen > Publish App) to prevent the refresh token from expiring after 7 days

You now have: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL`

### 4. Deploy Backend (Cloudflare Workers)

Login to Cloudflare:

```bash
cd backend
npx wrangler login
```

Set secrets (each command prompts for the value):

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put GMAIL_CLIENT_ID
npx wrangler secret put GMAIL_CLIENT_SECRET
npx wrangler secret put GMAIL_REFRESH_TOKEN
npx wrangler secret put GMAIL_SENDER_EMAIL
```

Update `CERT_VIEW_BASE_URL` in `backend/wrangler.toml` to your frontend URL.

Deploy:

```bash
npx wrangler deploy
```

Note the Worker URL printed (e.g. `https://certifier-api.your-subdomain.workers.dev`).

### 5. Deploy Frontend (Cloudflare Pages)

Set the production env values in `frontend/.env`:

```
VITE_BACKEND_URL=https://certifier-api.your-subdomain.workers.dev
VITE_CERT_VERIFY_BASE_URL=https://certifier.pages.dev
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```

Build and deploy:

```bash
cd frontend
npm run build
npx wrangler pages project create certifier
npx wrangler pages deploy dist
```

### 6. Verify

```bash
curl https://certifier-api.your-subdomain.workers.dev/
```

Should return: `backend is running!`

Open https://certifier.pages.dev/generate in a browser.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/generate` | Batch-create certificates from template + participants |
| POST | `/send-emails` | Send certificate links to participants via Gmail |
| GET | `/cert/:id` | Retrieve a single certificate by cert_id |

## Excel Format

The Excel file should have **no header row**. Column A = participant name, Column B = email.

| A | B |
|---|---|
| John Doe | john@example.com |
| Jane Smith | jane@example.com |

## Environment Variables

### Backend (Cloudflare Workers secrets)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `GMAIL_CLIENT_ID` | Google OAuth2 client ID |
| `GMAIL_CLIENT_SECRET` | Google OAuth2 client secret |
| `GMAIL_REFRESH_TOKEN` | Gmail OAuth2 refresh token |
| `GMAIL_SENDER_EMAIL` | Gmail address to send from |
| `CERT_VIEW_BASE_URL` | Frontend URL (set in wrangler.toml [vars]) |

### Frontend (Vite build-time)

| Variable | Description |
|----------|-------------|
| `VITE_BACKEND_URL` | Backend Worker URL |
| `VITE_CERT_VERIFY_BASE_URL` | Frontend URL (for QR codes) |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |
