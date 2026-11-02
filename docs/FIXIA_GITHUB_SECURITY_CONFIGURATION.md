# FIXIA — GitHub Security & Branch Protection Configuration Guide

**Repository:** `https://github.com/sumit07122/Fixia`  
**Visibility:** Public  
**Default Branch:** `main`  
**Audience:** Repository Owner (`sumit07122`) & DevOps Engineers  

---

## 1. Overview

Because GitHub CLI (`gh`) is not installed on the local Windows workstation, repository settings and branch protections must be verified or configured directly through the GitHub Web UI or GitHub REST API.

This guide provides the exact configuration required to protect the public FIXIA repository from credential leaks, unauthorized force pushes, and broken deployments.

---

## 2. GitHub Code Security & Analysis Configuration

Navigate to: `https://github.com/sumit07122/Fixia/settings/security_analysis`

| Security Feature | Required State | Action / Path | Reason |
| :--- | :--- | :--- | :--- |
| **Dependency Graph** | **Enabled** | Included automatically on public repos | Tracks open source dependencies |
| **Dependabot Alerts** | **Enabled** | Click **Enable** next to Dependabot alerts | Notifies owner of vulnerable npm dependencies |
| **Dependabot Security Updates** | **Enabled** | Click **Enable** next to Dependabot security updates | Automatically opens PRs to patch vulnerable packages |
| **Secret Scanning** | **Enabled** | Click **Enable** next to Secret scanning | Continuously scans commits for exposed API keys & tokens |
| **Push Protection** | **Enabled** | Check **Push protection** | Blocks `git push` if a secret or token is detected in commits |
| **Private Vulnerability Reporting** | **Enabled** | Click **Enable** next to Private vulnerability reporting | Allows external security researchers to privately report bugs |

---

## 3. Branch Protection Rules for `main`

Navigate to: `https://github.com/sumit07122/Fixia/settings/branches`  
Click **Add branch protection rule** (or edit existing rule for `main`).

### 3.1 Branch Name Pattern
```text
main
```

### 3.2 Required Settings

1. **Protect matching branches:**
   - [x] **Require a pull request before merging**
     - [ ] *Require approvals:* **Leave UNCHECKED (0 approvals)** (This ensures the sole repository owner `sumit07122` is not blocked by a second-reviewer requirement).
     - [x] *Dismiss stale pull request approvals when new commits are pushed*
     - [x] *Require conversation resolution before merging* (Ensures all review comments are addressed).

2. **Require status checks to pass before merging:**
   - [x] **Require status checks to pass before merging**
   - [x] **Require branches to be up to date before merging**
   - **Status checks that are required:**
     - `Validate Static Assets & Security` (from `.github/workflows/ci.yml`)

3. **Administrative & Integrity Safeguards:**
   - [x] **Do not allow bypassing the above settings** (or allow administrators to bypass only for emergency hotfixes)
   - [x] **Restrict force pushes** (Prevents accidental history loss or overwriting `main`)
   - [x] **Restrict deletions** (Prevents accidental deletion of the default branch)

---

## 4. Verification Checklist for Repository Owner

After saving the settings:
- [ ] Attempting to push directly to `main` without a PR is rejected by Git.
- [ ] Attempting to force-push (`git push --force`) to `main` is rejected by Git.
- [ ] Push protection alerts immediately if an API key is included in a commit.
- [ ] CI workflow `FIXIA Static Site CI` runs automatically on all pull requests targeting `main`.
