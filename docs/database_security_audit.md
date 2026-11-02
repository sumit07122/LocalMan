# LocalMan Platform: Database Security & Data Protection Audit

**Author**: Backend Security Engineer, Principal Database Architect  
**Date**: November 1, 2026  
**Standards Evaluated**: OWASP Top 10 API Security, Indian Digital Personal Data Protection Act (DPDPA 2023), RBI Guidelines on Digital Payments, Aadhaar Act Section 29  

---

## 1. Executive Security Verdict

The LocalMan platform enforces strong authentication and ownership validation within its application service layers (e.g. customer ID checks on bookings, provider ID checks on quotes, hashed refresh tokens). However, **critical database-level exposure risks** exist concerning:
1. **Plaintext KYC Document Numbers**: Aadhaar and PAN numbers in `provider_documents`.
2. **Plaintext Start OTP Storage**: `bookings.start_otp` stored unhashed.
3. **Partial Banking Details Encryption**: `bank_account_number_enc` is stored as an encrypted string, but `bank_ifsc_code`, `bank_account_holder`, and `upi_id` are unencrypted plain text.
4. **Soft-Delete Information Retention**: Absence of an automated data masking or retention policy for inactive accounts.

---

## 2. In-Depth Vulnerability Assessment

### 2.1 Storage of Sensitive Personal Data & Financial Identifiers (DPDPA / Aadhaar Act)
* **Finding**: In [apps/api/prisma/schema.prisma](file:///c:/Users/hp/OneDrive/Desktop/antigravity%20workspace/localman/apps/api/prisma/schema.prisma#L180-L196), `ProviderDocument` defines:
  ```prisma
  model ProviderDocument {
    id String @id @default(uuid())
    providerId String @map("provider_id")
    documentType KycDocType @map("document_type")
    documentNumber String @map("document_number") @db.VarChar(100)
    fileUrl String @map("file_url")
    ...
  }
  ```
* **Statutory Risk**: Under Indian UIDAI regulations and Section 29 of the Aadhaar Act, storing 12-digit Aadhaar numbers in plaintext without masking (showing only last 4 digits) or hardware/software vault tokenization incurs severe criminal and civil penalties. Similarly, PAN numbers constitute sensitive financial PII.
* **Remediation**:
  1. Add `documentNumberMasked VARCHAR(20)` to store masked representations (e.g., `XXXX-XXXX-1234` or `XXXXX1234F`) for operations dashboard display.
  2. Encrypt `document_number` using AES-256-GCM authenticated encryption with a dedicated database encryption key (`KYC_ENCRYPTION_KEY`), or store a HMAC-SHA256 hash for deduplication and encrypt the payload.

### 2.2 Plaintext Start OTP in `bookings` Table
* **Finding**: [apps/api/prisma/schema.prisma](file:///c:/Users/hp/OneDrive/Desktop/antigravity%20workspace/localman/apps/api/prisma/schema.prisma#L330) defines:
  ```prisma
  startOtp String @map("start_otp") @db.VarChar(6)
  ```
* **Vulnerability**: The start OTP is the cryptographic authorization handed by the customer to the provider to confirm physical arrival and initiate billing. Storing this 6-digit OTP in plaintext in PostgreSQL exposes it to anyone with read-only database replica access, SQL backup access, or internal administrative reporting access.
* **Remediation**:
  1. Store `startOtpHash VARCHAR(64)` (SHA-256 of OTP + booking salt).
  2. Verify incoming start OTP using `crypto.timingSafeEqual` against the hash.
  3. Once verified and job status transitions to `JOB_STARTED`, clear or nullify the OTP value immediately.

### 2.3 Banking & Payment Secrets Protection
* **Finding**:
  * `providers.bank_account_number_enc` is encrypted (Pass).
  * `providers.bank_ifsc_code`, `providers.bank_account_holder`, and `providers.upi_id` are unencrypted (Acceptable for routing, but must never be exposed via public APIs).
  * `providers.commission_rate_override` and financial metrics: The application service layer properly isolates these fields so customers cannot view provider commission rates or TDS internals.
* **Audit Check**: Verified that `PublicReviewDto`, `BookingDto`, and public catalog endpoints omit all banking, commission, and TDS fields.

### 2.4 Insecure Direct Object Reference (IDOR) & Query Scoping
* **Finding**: Inspected controllers across addresses, bookings, quotes, reviews, and payments.
* **Audit Verification**:
  * `AddressService.getAddress`: Enforces `if (address.userId !== customer.id) throw new ForbiddenError(...)`.
  * `BookingService.createBooking`: Validates address ownership against `customer.id`.
  * `QuoteService.acceptQuote`: Asserts `if (booking.customerId !== customerUser.id) throw new ForbiddenError(...)`.
  * `PaymentService.createCheckoutSession`: Asserts `if (booking.customerId !== customer.id) throw new ForbiddenError(...)`.
* **Database-Level Reinforcement**:
  While application-level checks are active, database queries should always include the owner parameter directly in the Prisma `where` clause:
  ```typescript
  // Preferred pattern: Owner-scoped find
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId: customer.id }
  });
  ```
  This eliminates potential bypass bugs if an upstream authorization check is accidentally skipped.

### 2.5 SQL Injection & Raw Query Safety
* **Finding**: Inspected all database interactions across `apps/api/src/modules/`.
* **Result**: **PASS**. 100% of standard operations utilize Prisma ORM type-safe parameterized queries. Zero instances of raw string interpolation (`prisma.$queryRawUnsafe`) with unescaped user inputs were detected.

### 2.6 Database User Privileges & Least Privilege Architecture
* **Finding**: The database configuration connects via a single master user (`localman_user`).
* **Production Recommendation**: Split database roles in production:
  1. **`localman_migration_user`**: DDL privileges (`CREATE`, `ALTER`, `DROP`, `REFERENCES`) used exclusively during CI/CD deployment migrations.
  2. **`localman_app_user`**: DML privileges only (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on application tables. Explicitly revoked from dropping tables, creating extensions, or altering schemas.

---

## 3. Security Remediation Action Items

| Item | Threat Addressed | Remediation | Priority |
| :---: | :--- | :--- | :---: |
| **SEC-01** | Aadhaar/PAN exposure in KYC | Add AES-256 encryption on `document_number` and store masked value `document_number_masked` for ops display. | **CRITICAL** |
| **SEC-02** | Start OTP interception | Hash `start_otp` using SHA-256; nullify hash upon entering `JOB_STARTED`. | **HIGH** |
| **SEC-03** | Soft-delete uniqueness lock | Replace global unique constraint on `users.phone_number` with partial unique index `WHERE deleted_at IS NULL`. | **HIGH** |
| **SEC-04** | Webhook timing attack | Ensure Razorpay/payment webhook signature verification uses `crypto.timingSafeEqual`. | **HIGH** |
| **SEC-05** | Production least privilege | Separate migration credentials from runtime application connection pool credentials. | **MEDIUM** |

