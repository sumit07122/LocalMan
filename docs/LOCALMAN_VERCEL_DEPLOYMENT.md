# LocalMan — Vercel Deployment Guide (Admin Web Dashboard)

**Application:** `@localman/admin-web`  
**Framework:** React 18 + Vite + TypeScript  
**Target Environments:** Staging (`admin-staging.localman.in`), Production (`admin.localman.in`)  
**Deployment Platform:** Vercel Edge CDN  

---

## 1. Overview & Architecture

`apps/admin_web` is a client-side Single Page Application (SPA) built with Vite and React. It communicates with the backend Fastify API via REST and WebSocket channels.

Vercel is the recommended hosting platform for `admin_web` because of its global edge network, automatic preview deployments on pull requests, and instant zero-downtime rollbacks.

> [!IMPORTANT]
> The backend Fastify API (`apps/api`) runs as a persistent Node.js process with WebSockets, PostGIS, Redis queues, and background workers. It is hosted on **Render** (see [`docs/LOCALMAN_BACKEND_HOSTING.md`](file:///docs/LOCALMAN_BACKEND_HOSTING.md)), NOT on Vercel serverless functions.

---

## 2. Step-by-Step Vercel Setup

### Step 1: Import GitHub Repository
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New... > Project**.
3. Select your GitHub repository: `localman`.

### Step 2: Configure Project Settings
In the **Configure Project** screen:

| Setting | Value | Explanation |
| :--- | :--- | :--- |
| **Project Name** | `localman-admin` | Project identifier on Vercel |
| **Framework Preset** | `Vite` | Detected automatically |
| **Root Directory** | `apps/admin_web` | Points build directly to admin portal workspace |
| **Include files outside root** | **Enabled (Checked)** | Required so npm can resolve workspace dependencies (`@localman/constants`, `@localman/contracts`, `@localman/design-tokens`) |

### Step 3: Build & Output Settings
- **Build Command:**
  ```bash
  cd ../.. && npm run build --workspace=@localman/admin-web
  ```
- **Output Directory:** `dist`
- **Install Command:**
  ```bash
  cd ../.. && npm install
  ```

### Step 4: Environment Variables

Add the following environment variables in Vercel **Project Settings > Environment Variables**:

| Variable Name | Environments | Staging Value | Production Value | Description |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Production | — | `https://api.localman.in/api/v1` | Production Fastify backend URL |
| `VITE_API_BASE_URL` | Preview | `https://api-staging.localman.in/api/v1` | — | Staging backend URL for PR previews |
| `VITE_API_BASE_URL` | Development | `http://localhost:4000/api/v1` | — | Local dev environment |

> [!CAUTION]
> In production builds, `VITE_API_BASE_URL` must start with `https://`. The dashboard startup validator [`validateAdminEnv`](file:///apps/admin_web/src/config/env.ts) will fail fast if an unencrypted `http://` URL is provided.

---

## 3. SPA Routing & Security Headers Configuration

Vercel deployment configuration is tracked in [`apps/admin_web/vercel.json`](file:///apps/admin_web/vercel.json):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

### Why this matters:
1. **SPA Rewrites:** Direct navigation or refreshing subpaths (e.g. `/bookings/bkg_123`, `/disputes`, `/kyc-verification`) routes seamlessly through `index.html` without returning 404.
2. **Clickjacking & XSS Protection:** `X-Frame-Options: DENY` prevents framing of administrative panels.
3. **Asset Caching:** Vite-hashed assets (`/assets/*.js`, `/assets/*.css`) are cached with 1-year immutable cache headers for ultra-fast CDN page loads.

---

## 4. Custom Domains & SSL Setup

1. In Vercel Project Settings, navigate to **Domains**.
2. Add custom domains:
   - Production: `admin.localman.in` (mapped to `master` branch)
   - Staging: `admin-staging.localman.in` (mapped to `develop` branch)
3. In your DNS provider (Cloudflare / Namecheap / GoDaddy):
   - Add CNAME record: `admin` -> `cname.vercel-dns.com`
   - Add CNAME record: `admin-staging` -> `cname.vercel-dns.com`
4. Vercel automatically provisions and renews free Let's Encrypt SSL/TLS certificates.

---

## 5. Branch & Continuous Delivery Strategy

- **Pull Requests (Any Branch):**
  Vercel automatically builds an isolated Preview Deployment with a unique URL (e.g. `https://localman-admin-git-feat-kyc-xyz.vercel.app`). Uses Staging API.
- **Merge to `develop`:**
  Automatically deploys to Staging (`https://admin-staging.localman.in`).
- **Merge to `master`:**
  Automatically deploys to Production (`https://admin.localman.in`).

