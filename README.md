# TexFlow — Textile Import & Wholesale Management

A configurable full-stack app for **textile importers and wholesalers**: containers, roll stock, m² sales, invoicing, payments, and legacy credits. Each company deploys its own instance and customizes branding, legal info, and tax settings from the admin panel.

## Stack

| Layer | Technology |
|-------|------------|
| Backend API | Laravel 12 + Sanctum |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 4 |
| Database | MySQL 8 |

## Core features

- **Containers** — import shipments with purchase, shipping, customs, and other costs
- **Stock** — roll-level inventory by fabric type and color (m²)
- **Sales** — sell rolls with unit price and quantity; AI pricing hints (optional)
- **Legacy credits** — receivables not tied to current stock
- **Clients** — CRM with separate stock vs credit balances
- **Invoices** — PDF with configurable HT / TVA / TTC
- **Payments** — FIFO allocation, proof upload, credit-targeted payments
- **Company settings** — logo, name, legal details, tax rate (admin UI)
- **Roles** — admin, secrétaire (operations), comptable (finance)
- **Bilingual UI** — French + Arabic

## Customize for your company

1. Deploy the app (see below)
2. Log in as admin
3. Open **Paramètres** → set company name, logo, ICE/RC, address, TVA rate
4. Replace `frontend/public/logo.png` or upload logo in settings
5. Set `OPENROUTER_API_KEY` for AI assistant (optional)

Environment defaults in `backend/.env` are seeded into `company_settings` on first `db:seed`.

## Local development

### 1. MySQL (Docker)

```bash
docker compose --env-file .env.docker up -d
```

### 2. Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Set `DB_PASSWORD`, `ADMIN_PASSWORD`, `FRONTEND_URL` in `.env`, then:

```bash
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

API: **http://localhost:8000**

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App: **http://localhost:5173**

## Production

```bash
cd backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan db:seed --force
php artisan storage:link
php artisan config:cache

cd ../frontend
npm ci && npm run build
```

Serve `frontend/dist` and point API to `backend/public`.

## Project structure

```
TexFlow/
├── backend/          Laravel API
├── frontend/         React SPA
├── docs/             Documentation
└── README.md
```

## Repository

https://github.com/Pandox03/AbrajTex
