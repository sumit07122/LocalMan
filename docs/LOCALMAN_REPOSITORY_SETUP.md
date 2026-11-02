# LocalMan — Private Repository Architecture & Multi-Repo Isolation

**Date:** November 2026  
**Auditor:** Principal DevSecOps Engineer & Release Architect  
**Repository:** `https://github.com/sumit07122/LocalMan`  
**Visibility:** **PRIVATE** (Commercial Marketplace Intellectual Property)  
**Status:** REPOSITORY VERIFIED & MULTI-REPO ISOLATION ENFORCED  

---

## 1. Multi-Repository Separation Invariant

LocalMan and Fixia are two distinct, independent commercial software assets with different architectures, licensing, and access tiers:

| Dimension | FIXIA Project | LOCALMAN Project |
| :--- | :--- | :--- |
| **Asset Type** | Digital Agency & Portfolio Website | On-Demand Marketplace Platform Monorepo |
| **Repository URL** | `https://github.com/sumit07122/Fixia.git` | `https://github.com/sumit07122/LocalMan.git` |
| **Visibility** | **PUBLIC** | **PRIVATE** |
| **Filesystem Path** | `C:\Users\hp\OneDrive\Desktop\Fixia\fixia-website\fixia-site` | `C:\Users\hp\OneDrive\Desktop\antigravity workspace\localman` |
| **Default/Prod Branch** | `main` | `master` |
| **Staging Branch** | `security/fixia-public-hardening` (PR target) | `develop` |
| **Cloud Hosting** | Vercel Edge Platform | Render (API, PostGIS, Redis) + Vercel (Admin Web) |
| **Mobile Clients** | None (PWA / Mobile Responsive) | Flutter Android APKs (`in.localman.*`) |

> [!CRITICAL]
> Under no circumstances may files, configurations, or Git commits be merged, synced, or pushed between the LocalMan and Fixia repositories. Each repository maintains its own Git commit lineage, remote endpoints, and access boundaries.

---

## 2. LocalMan Git Remote Organization

The local workstation Git configuration in `C:\Users\hp\OneDrive\Desktop\antigravity workspace\localman` is configured with:

```text
origin  https://github.com/sumit07122/LocalMan.git (fetch)
origin  https://github.com/sumit07122/LocalMan.git (push)
```

### Remote Verification Command:
```bash
git remote -v
git ls-remote --heads origin
```
Expected output:
```text
cb61656ae5fdc03815fb1d381f023b817e2a0738    refs/heads/master
```

---

## 3. Production & Staging Branch Strategy

LocalMan employs a disciplined GitFlow / Trunk-based hybrid branching model:

```mermaid
gitGraph
   commit id: "origin/master"
   branch develop
   checkout develop
   commit id: "feat: Phase 4A integrity"
   commit id: "feat: Phase 4B CI/CD & hosting"
   commit id: "feat: Phase 4C staging release"
   checkout master
   merge develop tag: "v1.0.0-staging"
```

1. **`master` (Production Branch):**
   - Authoritative source for commercial production releases.
   - Protected: Force-pushes and direct pushes prohibited.
   - Deploys to `api.localman.in` (Render) and `admin.localman.in` (Vercel).
2. **`develop` (Staging Branch):**
   - Active development integration and QA staging branch.
   - Triggers automated staging deployments on Render (`api-staging.localman.in`) and Vercel (`admin-staging.localman.in`).
   - Generates staging release APKs (`localman-customer-staging.apk`, `localman-provider-staging.apk`) via GitHub Actions.
3. **`feature/*` and `fix/*` (Working Branches):**
   - Branched from `develop`.
   - Merged into `develop` strictly via Pull Request with passing CI tests.
