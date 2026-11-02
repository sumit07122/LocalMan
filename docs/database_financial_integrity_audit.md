# LocalMan Platform: Financial Database Integrity Audit & Reconciliation Specification

**Author**: Principal Database Architect, Senior Financial Systems Engineer  
**Date**: November 1, 2026  
**Regulatory Standards**: Reserve Bank of India (RBI) Payment Settlement Directives, Indian Income Tax Act Section 194O (TDS)  

---

## 1. Core Financial Rules & Invariants

LocalMan operates under strict financial constraints:
1. **Integer Paisa Standard**: All monetary attributes are stored strictly as integers representing Indian paisa ($1\text{ INR} = 100\text{ paisa}$). Floating-point values for monetary storage are prohibited.
2. **Statutory Platform Deductions**:
   * **Platform Commission**: Default 15.00% (or provider/service override).
   * **Statutory TDS**: 1.00% deducted under Section 194O for Indian e-commerce marketplace participants.
3. **Wallet Accounting Invariant**:
   $$\text{availableBalancePaisa} + \text{pendingBalancePaisa} + \text{paidOutBalancePaisa} = \sum \text{Credits} - \sum \text{Debits}$$
   Every change to a provider's balance must be accompanied by an atomic, immutable append-only row in `wallet_ledger_entries`.

---

## 2. Subsystem Financial Audits

### 2.1 Payments & Gateway Webhook Settlement
* **Workflow**:
  1. Customer requests checkout session via `PaymentService.createCheckoutSession`.
  2. Server calculates payable total authoritatively ($Base + Materials + Tax + ExtraDuration$).
  3. Gateway order created (`gateway_order_id`).
  4. Customer pays -> Gateway sends `payment.captured` webhook.
  5. `FinancialService.settleBookingPayment` executes inside an atomic `$transaction`.
* **Integrity Evaluation**:
  * **Idempotency Guard**: Checked via unique idempotency key `ledger_settle_${booking.id}_${payment.id}` on `wallet_ledger_entries`.
  * **Duplicate / Out-of-Order Webhook Handling**: If a second webhook arrives for an already `CAPTURED` payment, `settleBookingPayment` re-fetches inside the transaction and immediately returns the existing payment record without duplicating credits.
* **Database Gaps Identified**:
  1. `payments` lacks check constraint: `amount_paisa > 0`.
  2. `payments.gateway_payment_id` and `gateway_order_id` lack database indexes, risking slow lookups during high webhook volume.

### 2.2 Provider Wallets & Ledger Journaling
* **Workflow**:
  * Credit on job completion: Provider net earnings ($Gross - Commission - TDS$) credited to `availableBalancePaisa`.
  * Withdrawal requested: `withdrawAmountPaisa` deducted from `availableBalancePaisa` and added to `pendingBalancePaisa`.
  * Bank transfer confirmed: `netPayoutPaisa` deducted from `pendingBalancePaisa` and added to `paidOutBalancePaisa`.
  * Bank transfer failed: `netPayoutPaisa` deducted from `pendingBalancePaisa` and restored to `availableBalancePaisa`.
* **Ledger Immutability**:
  * Entries in `wallet_ledger_entries` are append-only. No `UPDATE` or `DELETE` endpoints exist in application code.
  * Every entry records `resulting_available_paisa` and `resulting_pending_paisa` at that exact timestamp.
* **Database Gaps Identified**:
  1. `provider_wallets` lacks database check constraints:
     ```sql
     ALTER TABLE provider_wallets 
       ADD CONSTRAINT chk_wallet_available_non_negative CHECK (available_balance_paisa >= 0),
       ADD CONSTRAINT chk_wallet_pending_non_negative CHECK (pending_balance_paisa >= 0),
       ADD CONSTRAINT chk_wallet_paid_out_non_negative CHECK (paid_out_balance_paisa >= 0);
     ```
  2. `provider_wallets` lacks an optimistic locking version column (`version INT DEFAULT 1`). Under high concurrency, simultaneous balance updates can race if not locked via `SELECT FOR UPDATE`.

### 2.3 Refunds & Proportional Provider Debit
* **Workflow**:
  * Customer cancels eligible booking or dispute is resolved in customer's favor.
  * `RefundService.processRefund` calculates remaining refundable amount:
    $$\text{remainingRefundable} = \text{payment.amountPaisa} - \sum \text{successfulRefunds}$$
  * `FinancialService.processRefundAdjustment` proportionally debits provider wallet for their share of the refund.
* **Critical Database Flaw Identified**:
  * **The `refunds` table has NO `idempotency_key` column!**
  * The service layer stores `[idempotency:${idempotencyKey}]` inside the `reason` TEXT string.
  * If two admin refund requests execute simultaneously with the same idempotency key, they bypass relational unique constraints and can issue duplicate refunds!
* **Remediation**:
  * Add `idempotency_key VARCHAR(120) UNIQUE` to the `refunds` table.
  * Enforce `amount_paisa > 0` via database check constraint.

### 2.4 Payouts & Concurrency Protection
* **Workflow**:
  * Provider initiates withdrawal via `FinancialService.requestPayout`.
  * System validates: `provider.verificationStatus === 'VERIFIED'`, `amount >= 10000 paisa` (₹100), and `amount <= availableBalancePaisa`.
  * Payout created in `PROCESSING` status; funds moved to `pendingBalancePaisa`.
* **Idempotency**: Payout has unique index on `idempotency_key`. Duplicate requests with identical keys return the existing payout record cleanly.
* **Integrity Gap**:
  * If a provider triggers rapid double-click payout requests with different idempotency keys, and both read `availableBalancePaisa` before the update commits, both could attempt to reserve the same balance.
  * **Remediation**: Use database row locking (`SELECT FOR UPDATE` on `provider_wallets`) or an atomic conditional decrement:
    ```sql
    UPDATE provider_wallets 
    SET available_balance_paisa = available_balance_paisa - :withdrawAmount,
        pending_balance_paisa = pending_balance_paisa + :withdrawAmount
    WHERE id = :walletId AND available_balance_paisa >= :withdrawAmount;
    ```
    If rows affected equals 0, throw `ValidationError('Insufficient available balance')`.

---

## 3. Mathematical Financial Reconciliation Queries

To ensure complete accounting auditability, the following SQL queries must be executed periodically or by nightly reconciliation cron jobs to verify zero balance drift:

### 3.1 Wallet Balance vs. Ledger Cumulative Net Sum
```sql
-- Reconciles every provider's wallet balance against the sum of all their ledger entries
WITH ledger_tally AS (
  SELECT 
    wallet_id,
    SUM(CASE WHEN direction = 'CREDIT' THEN amount_paisa ELSE -amount_paisa END) AS calculated_net_balance
  FROM wallet_ledger_entries
  GROUP BY wallet_id
)
SELECT 
  w.id AS wallet_id,
  w.provider_id,
  w.available_balance_paisa + w.pending_balance_paisa AS current_held_balance,
  COALESCE(l.calculated_net_balance, 0) AS cumulative_ledger_balance,
  (w.available_balance_paisa + w.pending_balance_paisa) - COALESCE(l.calculated_net_balance, 0) AS balance_drift_paisa
FROM provider_wallets w
LEFT JOIN ledger_tally l ON l.wallet_id = w.id
WHERE (w.available_balance_paisa + w.pending_balance_paisa) != COALESCE(l.calculated_net_balance, 0);
-- Expected result: 0 rows returned (Zero drift)
```

### 3.2 Booking Payments vs. Provider Net Earnings & Platform Deductions
```sql
-- Validates that Booking Total = Provider Net + Platform Fee + TDS
SELECT 
  b.id AS booking_id,
  b.booking_number,
  b.total_amount_paisa,
  p.net_payout_paisa AS provider_net_paisa,
  p.platform_deduction_paisa,
  p.tds_deduction_paisa,
  b.total_amount_paisa - (p.net_payout_paisa + p.platform_deduction_paisa + p.tds_deduction_paisa) AS discrepancy_paisa
FROM bookings b
JOIN provider_payouts p ON p.booking_id = b.id
WHERE b.current_status IN ('PAYMENT_SETTLED', 'REVIEWED')
  AND b.total_amount_paisa != (p.net_payout_paisa + p.platform_deduction_paisa + p.tds_deduction_paisa);
-- Expected result: 0 rows returned
```

### 3.3 Refund Cap Reconciliation
```sql
-- Ensures no payment has had more money refunded than the captured payment amount
SELECT 
  p.id AS payment_id,
  p.booking_id,
  p.amount_paisa AS original_captured_paisa,
  SUM(r.amount_paisa) AS total_refunded_paisa,
  SUM(r.amount_paisa) - p.amount_paisa AS over_refunded_paisa
FROM payments p
JOIN refunds r ON r.payment_id = p.id
WHERE r.status IN ('SUCCEEDED', 'PROCESSING')
GROUP BY p.id, p.booking_id, p.amount_paisa
HAVING SUM(r.amount_paisa) > p.amount_paisa;
-- Expected result: 0 rows returned
```

