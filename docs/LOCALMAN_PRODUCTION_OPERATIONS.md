# LocalMan — Production Operations, Monitoring & Incident Runbook

**Date:** November 2026  
**Audience:** Site Reliability Engineers, DevOps Engineers, Platform Administrators  
**Classification:** Internal Confidential  

---

## 1. Observability Architecture

The LocalMan production platform incorporates three pillars of observability:
1. **Health Checks:** Automated pinging of API, PostgreSQL, and Redis status.
2. **Structured Logging:** Fastify Pino JSON logging with automatic PII redaction.
3. **Application Metrics:** Connection pool tracking, queue depths, and financial reconciliation alerts.

---

## 2. Health Monitoring & Endpoints

### 2.1 API Liveness & Readiness Probe
- **Endpoint:** `GET /health`
- **Response Format:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-11-02T10:00:00.000Z",
    "uptimeSeconds": 86420
  }
  ```
- **Monitors:** Render Health Probe, UptimeRobot, or Better Uptime pinging every 60 seconds.

### 2.2 Deep Diagnostics Probe (Internal Admin Only)
- **Endpoint:** `GET /api/v1/admin/system/health` (Protected by `ADMIN` RBAC)
- **Inspects:**
  - Database connectivity & query round-trip latency
  - Redis connection & memory usage
  - PostGIS extension operational status
  - Active WebSocket client count

---

## 3. Log Management & Sensitive Data Sanitization

### 3.1 PII & Secret Redaction Invariant
All application logs are processed to guarantee that sensitive credentials, customer identities, and payment tokens are **NEVER** emitted to stdout, logs, or third-party log aggregators.

Masked fields:
- `authorization`, `accesstoken`, `refreshtoken`, `token`
- `otp`, `otpcode`, `startOtp`
- `password`, `jwtSecret`, `pepper`
- `aadhaarNumber`, `panNumber`, `bankAccountNumber`, `upiId`
- `cvv`, `cardNumber`, `razorpay_signature`

### 3.2 High-Priority Financial & Security Alerts
Log parsers must listen for and alert on these structured log tags:

| Log Tag | Severity | Description | Action Required |
| :--- | :--- | :--- | :--- |
| `[FINANCIAL_ALERT]` | **CRITICAL** | Provider wallet had insufficient balance to cover a refund clawback. Unrecovered liability recorded. | Flag provider account in Admin portal; offset future earnings. |
| `[SECURITY_LOCKOUT]` | **HIGH** | A booking Start OTP was locked after 5 consecutive failed verification attempts. | Possible brute force; notify customer/provider support. |
| `[GATEWAY_ERROR]` | **HIGH** | Razorpay or SMS gateway returned 5xx or connection timeout. | Check third-party status page; verify webhook processing queue. |

---

## 4. Alerting Thresholds & Notification Channels

| Metric | Warning Threshold | Critical Threshold | Notification Channel |
| :--- | :--- | :--- | :--- |
| **HTTP 5xx Error Rate** | > 0.5% over 5m | > 2.0% over 5m | Slack `#devops-alerts` + PagerDuty |
| **API Response Latency (P95)**| > 800ms | > 2000ms | Slack `#devops-alerts` |
| **Database Pool Exhaustion** | > 80% connections | > 95% connections | Slack `#devops-alerts` + SMS |
| **Redis Memory Utilization** | > 75% maxmemory | > 90% maxmemory | Slack `#devops-alerts` |
| **Disk Storage (PostgreSQL)** | > 70% volume | > 85% volume | Email + Slack |

---

## 5. Incident Response & Rollback Runbooks

### Runbook 1: Production Web Service Failure / Crash Loop
1. **Check Render Deployment Logs:**
   Navigate to Render Dashboard > `localman-api` > **Logs**.
2. **Identify Root Cause:**
   Check whether crash is caused by database connectivity, unhandled promise rejection, or environment variable misconfiguration.
3. **Instant Rollback:**
   - In Render Dashboard > `localman-api` > **Events**.
   - Find the previous healthy deployment and click **Rollback to this deploy**.
   - Traffic is diverted back to the previous healthy container within 30 seconds.

### Runbook 2: Admin Portal Frontend Regression
1. In [Vercel Dashboard](https://vercel.com) > `localman-admin` > **Deployments**.
2. Find the previous stable production deployment.
3. Click the three dots `...` and select **Promote to Production (Instant Rollback)**.
4. CDN edge routing updates globally in less than 5 seconds.

### Runbook 3: Database Incident & Point-in-Time Recovery (PITR)
1. **Freeze Application Traffic (if data corruption is occurring):**
   Put API in maintenance mode or stop worker service.
2. **Access Render PostgreSQL Backups:**
   Navigate to Render Dashboard > `localman-postgres` > **Backups**.
3. **Restore from Snapshot:**
   Select the snapshot taken immediately prior to the incident and click **Restore to New Database**.
4. **Update `DATABASE_URL`:**
   Point `localman-api` to the restored database instance and trigger deployment.
5. **Verify Data Integrity:**
   Run integrity checks via `apps/api/test/postgres-integrity-constraints.test.ts`.

