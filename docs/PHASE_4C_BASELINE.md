# LocalMan & Fixia — Phase 4C Discovery and Repository Separation Baseline

**Date:** November 2026  
**Auditor:** Principal DevSecOps Engineer & Release Manager  
**Status:** DISCOVERY COMPLETE & BASELINE ESTABLISHED  

---

## 1. Executive Discovery Summary

An exhaustive filesystem and Git discovery was conducted across the workstation to identify the locations, remotes, branches, and working tree states of both the **LocalMan** and **Fixia** projects.

Both projects exist as completely independent repositories in distinct filesystem locations:

| Project | Filesystem Location | Remote Origin URL | Current Branch | Remote Tracking Ref | Working Tree State |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **LocalMan** | `C:\Users\hp\OneDrive\Desktop\antigravity workspace\localman` | `https://github.com/sumit07122/LocalMan.git` | `master` | `origin/master` (`cb61656`) | 2 commits ahead; 78 modified tracked files; Phase 4A/4B deliverables intact |
| **Fixia** | `C:\Users\hp\OneDrive\Desktop\Fixia\fixia-website\fixia-site` | `https://github.com/sumit07122/Fixia.git` | `main` | `origin/main` (`e7c0b2e`) | 2 commits ahead; 16 modified tracked files; 3 untracked files |

---

## 2. Independent Project Inventories

### 2.1 LocalMan Monorepo (`C:\Users\hp\OneDrive\Desktop\antigravity workspace\localman`)
- **Nature:** Full-stack enterprise service marketplace monorepo.
- **Components:**
  - `apps/api`: Fastify, TypeScript, Prisma ORM, PostgreSQL + PostGIS, Redis.
  - `apps/customer_app`: Flutter mobile client (`in.localman.customer`).
  - `apps/provider_app`: Flutter provider client (`in.localman.provider`).
  - `apps/admin_web`: React 18, Vite, TypeScript management dashboard.
  - `packages/constants`, `packages/contracts`, `packages/design_tokens`: Shared TypeScript packages.
- **Git State:**
  - Current branch: `master`
  - Ahead of `origin/master` by 2 commits:
    - `b807fb4`: `build: configure clean CI workspace build pipeline and prisma generation for Vercel`
    - `f91e288`: `feat(ci): add vercel root deploy script and update admin env validation`
  - All Phase 4A database integrity constraints and Phase 4B CI/CD configurations are present and verified.

### 2.2 Fixia Website (`C:\Users\hp\OneDrive\Desktop\Fixia\fixia-website\fixia-site`)
- **Nature:** High-performance public portfolio and agency static web application.
- **Components:**
  - `index.html`, `about.html`, `contact.html`, `pricing.html`, `services.html`, `work.html`, `results.html`, `faq.html`, `process.html`, `ai.html`, `erp.html`, `software.html`, `web.html`, `android.html`, `solution-builder.html`, `ideas.html`, `calculator.html`, `case-study-detail.html`.
  - `styles.css`, `polish.css`, `app.js`, `polish.js`, `analytics.js`.
  - `projects_data.json`, `ideas-data.js`, `sitemap.xml`, `robots.txt`, `manifest.webmanifest`.
  - `api/` (serverless handlers: `inquiry.js`, `generate-ideas.js`, `generate-solution.js`).
  - Public exposure risk: `admin.html` containing client-side passcode authentication (`fixia2026`) and mock personal lead records.
- **Git State:**
  - Current branch: `main`
  - Remote origin: `https://github.com/sumit07122/Fixia.git` (tracked branch `origin/main`)
  - Ahead of `origin/main` by 2 commits (`50fa25b`).

---

## 3. Separation Architecture & Safety Rules

1. **Strict Remote Isolation:**
   - LocalMan Git repository interacts **ONLY** with `https://github.com/sumit07122/LocalMan.git`.
   - Fixia Git repository interacts **ONLY** with `https://github.com/sumit07122/Fixia.git`.
   - Under no circumstances shall files or commits from LocalMan be pushed into Fixia, or vice versa.
2. **Preservation of Existing Work:**
   - No `git reset --hard`, no `git clean -fd`, no destructive checkout, and no history rewriting.
   - All uncommitted user edits in both repositories are strictly preserved.
3. **Repository Visibility Invariant:**
   - LocalMan must remain **PRIVATE**.
   - Fixia remains **PUBLIC** as the agency website.
4. **Branching Model:**
   - Fixia: Hardening performed on a dedicated branch `security/fixia-public-hardening` and proposed via pull request targeting `main`.
   - LocalMan: Staging release prepared on `develop` branch targeting private staging deployment.
