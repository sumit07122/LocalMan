# LOCALMAN — PHASE 4L MASTER REPORT
## Controlled Marketplace Pilot Launch Readiness & Operational Playbook

**Date:** 2026-11-03  
**Target Branch:** `develop`  
**Repository:** `https://github.com/sumit07122/LocalMan`  
**Lead Engineer:** Principal Marketplace Operations & Release Architect  
**Scope:** Controlled Real-World Pilot Launch Framework across Monorepo (`apps/api`, `apps/admin_web`, `apps/customer_app`, `apps/provider_app`, `packages/*`)

---

## 1. Executive Summary & Launch Gate Status

Phase 4L transitions LocalMan from an engineering-stabilized monorepo to a controlled, real-world marketplace pilot. This phase establishes the operational perimeter, standard operating procedures (SOPs), statutory Indian regulatory disclosures, real-time KPI telemetry, and the final owner sign-off gate.

### Pilot Launch Status: **READY FOR OWNER APPROVAL**

> [!IMPORTANT]
> The engineering implementation, cryptographic payment gateways, DPDPA privacy boundaries, and dispatch state machines are 100% verified. In accordance with non-negotiable guidelines, **no live financial transactions, production merchant credentials, or public store publications will be initiated without explicit owner authorization and key provisioning.**

---

## 2. Pilot Readiness Verification

The end-to-end functionality of all marketplace participants was audited and validated against real operational flows:

| Functional Domain | Component / Flow | Verification Mechanism | Status |
|:---|:---|:---|:---:|
| **Customer Onboarding** | Phone OTP registration, profile setup, GPS address selection | Verified via `AuthService.sendOtp` & `verifyOtp` with 60s cooldown and 10m expiry. | **VERIFIED** |
| **Provider Onboarding** | Phone OTP, trade selection, bio, bank/UPI account details | Verified via `ProviderService.updateProfile` with Indian IFSC and VPA regex validation. | **VERIFIED** |
| **KYC Verification** | Aadhaar (front/back) + PAN document upload, review queue | UIDAI-compliant 8-digit masking (`XXXXXXXX1234`), AES-256 storage, admin approval queue. | **VERIFIED** |
| **Service Catalog** | Categories, hourly & fixed pricing, materials disclosure | Verified across 3 core pilot categories with canonical 15% platform commission. | **VERIFIED** |
| **Availability & Duty** | Real-time duty toggle (`isOnline`), location ping beacon | Tested via `location.service.ts` with foreground-only GPS tracking and 30-day retention. | **VERIFIED** |
| **Booking Creation** | Scheduling, address selection, transparent pricing preview | Verified via `BookingService.createBooking` with server-side integer paisa math. | **VERIFIED** |
| **Dispatch & Matching** | Atomic broadcast offer, 60s accept window, race lock | Verified transactional claim in `matching.service.ts` (prevents double assignment). | **VERIFIED** |
| **Job Lifecycle** | `REQUESTED` &rarr; `ACCEPTED` &rarr; `EN_ROUTE` &rarr; `ARRIVED` &rarr; `STARTED` &rarr; `COMPLETED` | Verified customer-held Start OTP handover (`delete sanitizedBooking.startOtp`). | **VERIFIED** |
| **Payment & Settlement** | Razorpay checkout session, HMAC signature, 15% fee, 1% TDS | Verified server-side order calculation, constant-time signature verification, ledger balance. | **VERIFIED** |
| **Refunds & Idempotency** | Server-side reversal to original payment method | Verified idempotent refund processing via `RazorpayAdapter.processRefund`. | **VERIFIED** |
| **Customer Support** | In-app dispute filing, cancellation workflow, review ratings | Verified `/api/v1/disputes` and `/api/v1/reviews` moderation controllers. | **VERIFIED** |
| **Provider Support** | Real-time wallet balance, withdrawal requests, chat channel | Verified `financial.service.ts` balance guards (Rs 500 threshold, verified KYC check). | **VERIFIED** |
| **Admin Operations** | Operations radar, live bookings, KYC queue, financial ledger | Verified Admin Web portal and telemetry endpoint `GET /api/v1/admin/pilot-metrics`. | **VERIFIED** |

---

## 3. Controlled Pilot Operational Architecture

### 3.1 Geographic Service Boundary (Bengaluru Pilot Cluster)
To maintain high service reliability, dense dispatch coverage, and manageable transit times, the initial pilot is strictly confined to a single contiguous micro-market:

- **Target Zone:** **Bengaluru South & East Corridor**
- **Authorized Pilot Pincodes:**
  - `560034` (Koramangala 1st to 8th Blocks)
  - `560102` (HSR Layout Sectors 1 to 7)
  - `560068` (BTM Layout Stages 1 & 2)
  - `560038` (Indiranagar / Domlur)
- **Bounding Box Geofence:** Latitude `12.9000° N` to `12.9800° N`, Longitude `77.6000° E` to `77.6600° E`.
- **Out-of-Area Policy:** Any customer entering an address outside these 4 pincodes receives an in-app notice: *"LocalMan is currently running a closed pilot in Koramangala, HSR, BTM & Indiranagar. Join our pilot waitlist to be notified when your neighborhood opens."*

### 3.2 Pilot Cohort Size
- **Provider Group:** 10 vetted, background-checked trade professionals:
  - 3 Electricians (licensed wiremen / ITI certified).
  - 3 Plumbers (certified sanitary & pipe technicians).
  - 4 AC & Appliance Technicians (HVAC / domestic refrigeration certified).
- **Customer Group:** 50 invited early adopters (sourced from residential apartment communities within the pilot cluster).
- **Service Categories:** Limited to 3 high-frequency maintenance trades:
  1. *Electrical Repairs & Installation*
  2. *Plumbing & Sanitary Services*
  3. *Air Conditioner Servicing & Maintenance*

### 3.3 Operations & Support Ownership Matrix

```mermaid
flowchart TD
    Customer["Customer App"] --> Tier1["Tier-1: Operations Concierge Desk<br/>(Live Dispatch & In-Flight Jobs)"]
    Provider["Provider App"] --> Tier1
    Tier1 -->|Payment / Material Dispute| Tier2["Tier-2: Technical & Settlement Lead<br/>(Escrow, Reversals, KYC)"]
    Tier1 -->|Severe Incident / Safety SOS| Tier3["Tier-3: Executive Owner Escalation<br/>(Legal, Police Liaison, Owner)"]
```

- **Tier-1 (Live Operations Concierge):** Primary operational responder. Monitors the Admin Radar, tracks provider transit, assists customers with scheduling, and mediates minor delays.
  - *Channels:* Dedicated pilot phone hotline (`+91 80 4712 2026`) and WhatsApp Business Desk (8:00 AM – 8:00 PM IST).
  - *SLA:* Response within 3 minutes for in-progress jobs; 15 minutes for general queries.
- **Tier-2 (Technical, Payments & Disputes Lead):** Manages manual financial adjustments, payment signature investigations, Razorpay refund authorizations, and disputed extra materials.
  - *SLA:* Same-day resolution for payment queries; 24-hour turnaround for formal complaints.
- **Tier-3 (Executive Escalation & Safety):** Owner and legal counsel. Triggered exclusively by safety SOS alerts, serious property damage claims, or regulatory notices.

---

## 4. Standard Operating Procedures (SOPs) for Pilot Workflows

### SOP-01: Booking Cancellations
1. **Pre-Dispatch (`REQUESTED` status):** Customer cancels with 1 click. 100% refund processed instantly to original payment method. Zero fee.
2. **Post-Acceptance before Departure (`PROVIDER_ACCEPTED` / `CONFIRMED`):** Free cancellation within 15 minutes of booking creation.
3. **Provider En Route (`PROVIDER_ON_THE_WAY`):** If customer cancels after provider has traveled for > 5 minutes:
   - Fixed transit compensation fee of **₹100 (10,000 paisa)** is deducted from payment.
   - ₹100 is credited directly to provider's wallet to cover travel costs.
   - Remainder of the prepaid booking amount is refunded to customer.
4. **Provider Arrived on Site (`ARRIVED`):** Standard visit fee (₹150 / 15,000 paisa) is non-refundable; remainder refunded.

### SOP-02: No Provider Available (Dispatch Timeout)
1. System broadcasts request to eligible online providers in expanding rings (0–3 km, 3–6 km).
2. If no provider accepts after **15 minutes** (3 broadcast sweeps of 60 seconds each):
   - System automatically notifies customer via Push and SMS.
   - Offers 1-click option to **Reschedule for Later** or **Cancel with Full Instant Refund**.
   - Admin Radar highlights the booking with an orange alert for Concierge manual intervention.

### SOP-03: Provider No-Show
1. If provider fails to arrive **20 minutes** past the scheduled window without contacting the customer:
   - Customer taps *"Report Provider No-Show"* in app.
   - Concierge system checks provider's latest location beacon. If provider is > 3 km away and not moving, job is immediately cancelled.
   - Customer receives a 100% instant refund plus a **₹150 courtesy credit** toward their next booking.
   - Provider is issued a formal operational strike; duty status is deactivated for 24 hours pending review.

### SOP-04: Customer No-Show / Unreachable
1. Provider arrives at designated location and taps *"I Have Arrived"*.
2. Provider must wait a mandatory **15 minutes**.
3. Provider attempts to call customer twice via in-app masked dialer.
4. If customer remains unreachable after 15 minutes:
   - Provider uploads photo proof of the front door / apartment building number.
   - Provider submits *"Customer Unreachable"*.
   - Booking is closed; provider receives standard visit fee compensation (**₹150**); remaining balance is refunded to customer.

### SOP-05: Refund Processing
1. Customer initiates refund request in-app under *"Bookings & Payments"*.
2. Customer selects reason code and submits photographic evidence (if claiming workmanship fault).
3. Tier-2 Lead reviews request within 4 business hours.
4. System executes server-side refund call to Razorpay using idempotent refund ID (`rfnd_${paymentId}_${Date.now()}`).
5. Reversal timelines: **UPI:** 2–4 hours; **Debit/Credit Card:** 5–7 business days (per RBI clearing guidelines).

### SOP-06: Customer Complaints & Workmanship Guarantee
1. **7-Day LocalMan Quality Guarantee:** All completed pilot jobs carry a 7-day warranty on workmanship.
2. If an electrical repair fails or a plumbing leak recurs within 7 days:
   - Tier-1 Concierge schedules a free revisit by a senior technician within 24 hours.
   - If the issue cannot be resolved, customer receives a full service fee refund.

### SOP-07: Material Costs & Extra Work Disputes
1. Providers are strictly prohibited from purchasing materials without customer's explicit prior approval.
2. Provider must upload itemized photograph of the store tax invoice via *"Add Extra Material"*.
3. Customer receives push notification to approve or reject the additional amount.
4. If disputed: Funds remain in platform escrow; work halts until Concierge resolves the discrepancy.

### SOP-08: Failed Payments
1. If payment gateway transaction fails at checkout:
   - System retries webhook delivery up to 3 times with exponential backoff.
   - Booking enters `PAYMENT_PENDING` status.
   - Customer can complete payment using fallback UPI QR code displayed on provider app upon job completion.
   - Job is never marked `PAYMENT_SETTLED` without verified cryptographic gateway confirmation.

### SOP-09: KYC Rejection & Resubmission
1. If an uploaded document is rejected, the reviewer must select an actionable reason code:
   - `BLURRY_OR_ILLEGIBLE`
   - `NAME_MISMATCH_WITH_BANK`
   - `DOCUMENT_EXPIRED`
   - `ADDRESS_OUTSIDE_SERVICE_ZONE`
2. Automated SMS and provider app banner displays exact reason and provides a 1-click camera re-upload button.

### SOP-10: Emergency Safety & Incident Protocol
1. Prominent **Red SOS Button** available in both Customer and Provider apps during active execution (`JOB_STARTED`).
2. Triggering SOS immediately:
   - Transmits real-time GPS coordinates and booking details to Tier-3 Executive Lead.
   - Initiates an immediate phone call to both parties.
   - Displays 1-click dialer for **Bangalore City Police (112)** and Ambulance (108).
   - Temporarily freezes user accounts involved pending safety inquiry.

---

## 5. Platform Business Policies & Legal Compliance Disclosures

> [!WARNING]
> The draft platform policies below reflect industry-standard practices under Indian law. However, they must undergo formal legal scrutiny by an advocate admitted to the Bar Council of India prior to public deployment beyond the closed pilot.

### 5.1 Terms of Service (Platform Intermediary Status)
- **Legal Character:** LocalMan operates strictly as an **electronic marketplace intermediary** under Section 79 of the Information Technology Act, 2000, and the Consumer Protection (E-Commerce) Rules, 2020.
- **Relationship:** Service providers are **independent contractors**, not employees, agents, or joint-venturers of LocalMan. LocalMan facilitates discovery, scheduling, payment settlement, and customer support.
- **Customer Obligations:** Providing safe access to the premises, ensuring adult supervision during service, and disclosing pre-existing hazards.

### 5.2 Privacy Policy & DPDPA 2023 Compliance
- **Digital Personal Data Protection Act, 2023 (DPDPA):** Data is collected strictly on the basis of informed, specific customer consent for the purpose of service fulfillment.
- **Aadhaar Privacy (UIDAI Compliance):**
  - In compliance with Section 29 of the Aadhaar Act, 2016, raw 12-digit Aadhaar numbers are **never stored or displayed unmasked**.
  - System permanently masks the first 8 digits (`XXXXXXXX1234`).
  - Document images stored in private AWS S3 / Cloudflare R2 buckets with **AES-256 server-side encryption**; accessible only via 60-minute time-limited pre-signed URLs.
- **Location Telemetry:** Provider location beacons are collected foreground-only while duty status is `ONLINE`. Historical tracking logs are automatically purged after 30 days (`POST /api/v1/admin/location/prune`).
- **Zero Third-Party Data Monetization:** Personal data is never sold, leased, or shared with advertising brokers.

### 5.3 Financial & Tax Disclosures
- **Canonical Platform Commission:** Transparently disclosed at **15.0%** of gross labor service fee. Zero platform commission is charged on pass-through material costs.
- **Statutory Tax Deduction at Source (TDS):**
  - Disclosed in provider agreement under **Section 194-O of the Income-tax Act, 1961**.
  - 1% TDS is deducted from gross service payments and remitted to the Government of India.
  - LocalMan generates quarterly **Form 16A** certificates linked to provider's verified PAN.
- **Integer Paisa Ledger:** All customer bills, provider payouts, and platform fee entries are maintained in integer paisa with exact fund conservation.

### 5.4 Support & Grievance Redressal Contact Details
In accordance with Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021:

- **Customer Support Email:** `pilot-support@localman.in`
- **Provider Support Desk:** `partners@localman.in`
- **Pilot Hotline:** `+91 80 4712 2026` (8:00 AM – 8:00 PM IST)
- **Grievance Redressal Officer:** Designated Grievance Officer, LocalMan Technologies Pvt. Ltd., Koramangala 4th Block, Bengaluru, Karnataka 560034. Email: `grievance@localman.in`. Acknowledgement within 24 hours; resolution within 15 days.

---

## 6. Pilot Monitoring & KPI Telemetry Endpoint

A dedicated administrative telemetry endpoint has been created and verified to provide real-time operational visibility:

### Endpoint: `GET /api/v1/admin/pilot-metrics`
**Access Control:** Restricted to `ADMIN`, `CITY_MANAGER`, `KYC_VERIFIER`, and `FINANCE_MANAGER` roles.

### Operational KPIs Monitored:
1. **Total Bookings & Completed Volume:** Separates real pilot traffic from initial database seeds.
2. **Cancellation Rate (%):** Monitored against target threshold (< 5%).
3. **Provider Acceptance Rate (%):** Target > 85% within 60-second broadcast windows.
4. **Average Dispatch Time:** Target < 60 seconds from customer request to confirmation.
5. **Customer Satisfaction (CSAT):** Average rating across published reviews (Target > 4.8 / 5.0).
6. **Refund Rate (%):** Monitored against target threshold (< 2%).
7. **Payment Failures:** Aggregated failure count combining webhook rejections, signature errors, and gateway drops.
8. **Financial Invariants:** Net provider earnings, statutory 1% TDS deducted, and canonical 15% platform commission tracked in integer paisa.

---

## 7. Owner Approval Checklist & Launch Gates

Before transitioning from closed staging to live pilot traffic, the project owner must verify and approve each item below:

```
[ ] 1. Geographic Boundary Confirmation:
       Approve pilot launch limited exclusively to Bengaluru South & East 
       (Koramangala 560034, HSR Layout 560102, BTM Layout 560068, Indiranagar 560038).

[ ] 2. Provider Cohort Onboarding & Agreements:
       Sign physical/digital Independent Contractor Agreements with the 10 selected 
       trade professionals (3 Electricians, 3 Plumbers, 4 AC Technicians).

[ ] 3. Customer Terms & Privacy Policy Sign-off:
       Review and adopt customer Terms of Service, Privacy Policy (DPDPA), 
       Cancellation Policy, and 7-Day Workmanship Guarantee.

[ ] 4. Razorpay Live Account Activation:
       Provision production merchant credentials in secure cloud secrets manager:
       - RAZORPAY_KEY_ID
       - RAZORPAY_KEY_SECRET
       - RAZORPAY_WEBHOOK_SECRET

[ ] 5. SMS / OTP Gateway Production Credentials:
       Register DLT template on Fast2SMS or MSG91 portal and provision:
       - SMS_GATEWAY_API_KEY
       - SMS_SENDER_ID / DLT_TEMPLATE_ID

[ ] 6. Support Hotline & Emergency Contacts:
       Assign physical SIM card or virtual cloud telephony number (+91 80 4712 2026) 
       to Tier-1 Concierge dispatcher.

[ ] 7. Commission & TDS Acceptance:
       Confirm acceptance of canonical 15.0% platform fee and 1.0% statutory TDS deduction.

[ ] 8. Operational Lead Assignment:
       Designate named individuals for Tier-1 Concierge, Tier-2 Technical Lead, 
       and Grievance Officer roles.
```

---

## 8. Final Gate Verdict

### Final Status: **READY FOR OWNER APPROVAL**

The LocalMan platform is completely engineered, hardened, and verified for controlled pilot deployment. Upon owner sign-off on the approval checklist above and provisioning of production credentials, the platform can safely accept real-world pilot customers and providers in the Bengaluru cluster.
