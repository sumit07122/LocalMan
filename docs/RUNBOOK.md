# LocalMan Platform - Engineering Runbook & Zero-to-One Setup Guide

**Target Setup Time**: < 15 minutes  
**Audience**: Full-Stack Engineers, Mobile Engineers, QA, and DevOps  
**Repository**: `localman` (Monorepo)

---

## 1. Monorepo Architecture Overview

LocalMan is structured as an npm workspaces monorepo:

```
localman/
├── apps/
│   ├── api/             # Fastify 5 REST API & WebSocket Realtime Server (Port 4000)
│   ├── admin_web/       # React + Vite Admin & Operations Dashboard (Port 3000)
│   ├── customer_app/    # Flutter Customer Mobile App (Android/iOS)
│   └── provider_app/    # Flutter Partner/Technician Mobile App (Android/iOS)
├── packages/
│   ├── constants/       # Shared business constants, enums, limits & mime types
│   ├── contracts/       # Zod schemas & DTOs shared across backend and frontend
│   └── design_tokens/   # Shared typography, spacing, and brand design tokens
├── scripts/
│   ├── start-local-db.ts # Embedded zero-dependency local PostgreSQL engine (Port 5432)
│   ├── dev-all.ts        # Unified single-command development runner
│   └── verify-db-counts.ts # Verification script for demo data metrics
└── docs/                # Architecture docs, verification reports, runbook
```

---

## 2. System Prerequisites

Ensure the following tools are installed on your host machine:

| Component | Minimum Version | Verification Command | Notes |
|---|---|---|---|
| **Node.js** | `>= 20.0.0` | `node -v` | Node 20 LTS, 22 LTS, or 26 supported |
| **npm** | `>= 10.0.0` | `npm -v` | Installed with Node.js |
| **PostgreSQL** | `15+` / Embedded | Included via `npm run db:start` | Embedded engine requires zero installation |
| **Java JDK** | `21 LTS` | `java -version` | Oracle JDK 21 or OpenJDK 21 |
| **Flutter SDK** | `3.22+` / `3.47+` | `flutter --version` | Flutter stable channel |
| **Android SDK** | API 34+ | `adb --version` | Configured via `ANDROID_HOME` |

---

## 3. Zero-to-Running in 4 Steps (< 15 Minutes)

### Step 1: Install Dependencies & Build Packages (2 mins)

From the monorepo root:
```bash
# Install workspace dependencies and compile shared packages
npm install
npm run build:packages
```

### Step 2: Configure Environment Files (1 min)

Every app contains a well-documented `.env.example`. Copy the examples:

```bash
# Backend API
cp apps/api/.env.example apps/api/.env

# Admin Web
cp apps/admin_web/.env.example apps/admin_web/.env

# Mobile Apps (optional for custom overrides, defaults resolve automatically)
cp apps/customer_app/.env.example apps/customer_app/.env
cp apps/provider_app/.env.example apps/provider_app/.env
```

*Note: In development, default fallback values allow immediate local execution without external API keys (SMS, Payments, and Storage default to `mock` mode, and Google Maps uses Haversine straight-line fallback).*

### Step 3: Initialize & Seed Database (2 mins)

LocalMan ships with an embedded local PostgreSQL engine (`embedded-postgres`), so you do not even need Docker installed.

In terminal 1 (or run via background):
```bash
# Start the local database engine
npm run db:start
```

In terminal 2 (run migrations and seed realistic demo data):
```bash
# Apply Prisma migrations (including Phase 3J reviews/reputation)
npm run db:migrate

# Seed realistic demo data (5 customers, 10 providers across 5 categories, 20 bookings)
npm run db:seed
```

To verify the database seed metrics at any time:
```bash
npx tsx scripts/verify-db-counts.ts
```

### Step 4: Single-Command Full Stack Development (1 min)

To start the local PostgreSQL database, Fastify API, and React Admin Dashboard simultaneously with unified log prefixes and graceful shutdown:

```bash
npm run dev:all
```

**Running Services Endpoints:**
- 🐘 **PostgreSQL**: `localhost:5432` (`localman_db` / user: `localman_user`)
- ⚡ **Backend API**: `http://localhost:4000` (Health: `http://localhost:4000/api/v1/health`)
- 🖥️ **Admin Web**: `http://localhost:3000` (Direct Vite proxy to backend API)

---

## 4. Mobile Apps Setup & Local API Connection

Both `customer_app` and `provider_app` are built with Flutter and Riverpod.

### API Base URL Resolution Matrix

The apps use `EnvConfig` with smart automatic resolution:
- **Android Emulator**: Resolves to `http://10.0.2.2:4000/api/v1` (maps to host localhost)
- **iOS Simulator / Desktop**: Resolves to `http://localhost:4000/api/v1`
- **Physical Device over Wi-Fi**: Pass compile-time define `--dart-define=API_BASE_URL=http://<YOUR_LAN_IP>:4000/api/v1`
- **Production (Release Mode)**: Mandatory HTTPS check. Fails fast with `StateError` if HTTP is used.

### Running Customer Mobile App

```bash
cd apps/customer_app

# Fetch dependencies
flutter pub get

# Static code analysis
flutter analyze

# Run on Android Emulator
flutter run

# Build Android Debug APK
flutter build apk --debug
```

### Running Provider / Partner Mobile App

```bash
cd apps/provider_app

# Fetch dependencies
flutter pub get

# Static code analysis
flutter analyze

# Run on Android Emulator
flutter run

# Build Android Debug APK
flutter build apk --debug
```

---

## 5. Verification & Test Suite Execution

The repository enforces strict regression testing across all modules:

```bash
# Run all backend unit & integration tests (514+ tests passing)
npm test

# Run GoogleMapsService tests (caching, budget guard, Haversine fallback)
npm run test --workspace=@localman/api test/google-maps-service.test.ts

# Run Flutter analysis on mobile apps
cd apps/customer_app && flutter analyze
cd apps/provider_app && flutter analyze
```

---

## 6. Troubleshooting & FAQs

### Q1: `File ... npm.ps1 cannot be loaded because running scripts is disabled` (Windows)
**Fix**: Run commands via `cmd.exe /c` or run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` in PowerShell.

### Q2: Port 5432 or 4000 is already in use
**Fix**: Check running processes:
- Windows: `netstat -ano | findstr :5432` followed by `taskkill /PID <PID> /F`
- macOS/Linux: `lsof -i :5432` followed by `kill -9 <PID>`

### Q3: Stale `postmaster.pid` after crash
**Fix**: `scripts/start-local-db.ts` automatically detects and clears stale `postmaster.pid` lock files on startup. You can also manually delete `.local-postgres-data/postmaster.pid`.

### Q4: Connecting a physical phone over Wi-Fi
**Fix**: 
1. Find your machine's LAN IP: `ipconfig` (Windows) or `ifconfig` (macOS/Linux), e.g. `192.168.1.15`.
2. Ensure your phone is on the same Wi-Fi.
3. Run the app with: `flutter run --dart-define=API_BASE_URL=http://192.168.1.15:4000/api/v1`.
