/**
 * Tax Policy Configuration & Statutory Withholding Engine (Phase 4N)
 *
 * Implements strict statutory tax boundaries in compliance with Indian Tax Law:
 * 1. Income-tax Act, 1961 - Section 194-O (E-commerce Operator TDS)
 *    - Amended via Finance (No. 2) Act 2024 effective 1 October 2024:
 *      Statutory TDS rate reduced from 1.0% to 0.1%.
 *      Official CBDT Reference: https://www.incometaxindia.gov.in/w/tds-rates-1
 *    - Section 194-O(2) Exemption: Individual/HUF providers with gross receipts <= ₹5,00,000
 *      during the financial year who furnish PAN/Aadhaar are exempt from deduction.
 *    - Section 206AA: Higher withholding rate of 5.0% if PAN is not furnished.
 *
 * 2. Platform Commission (15.00%):
 *    - Commercial take-rate for marketplace facilitation.
 *    - 100% platform gross revenue (NOT a tax and NOT GST).
 *
 * 3. GST (Goods and Services Tax):
 *    - 18.00% GST applicable on marketplace platform fee.
 *    - Section 9(5) vs Section 52 TCS classification subject to formal CA review.
 *
 * IMPORTANT:
 * All live financial disbursements and tax treatments remain in a blocked /
 * pending-CA-approval state until an owner-approved Chartered Accountant determination exists.
 */

export interface TaxPolicyConfig {
  /**
   * Whether a qualified Chartered Accountant has formally approved LocalMan's tax determination
   */
  isApprovedByCa: boolean;

  /**
   * System status for tax compliance gate
   */
  status: 'TAX_POLICY_CA_APPROVED' | 'TAX_POLICY_PENDING_CA_APPROVAL';

  /**
   * Statutory TDS withholding rate under Section 194-O (amended rate: 0.1% w.e.f. 01.10.2024)
   */
  statutoryTdsRatePercent: number;

  /**
   * Higher TDS rate under Section 206AA when provider fails to furnish a valid PAN (5.0%)
   */
  noPanTdsRatePercent: number;

  /**
   * Section 194-O(2) annual exemption threshold in integer paisa (₹5,00,000 = 50,000,000 paisa)
   */
  tdsExemptionThresholdPaisa: number;

  /**
   * Whether aggregate annual gross threshold exemption tracking is active
   */
  isExemptionThresholdActive: boolean;

  /**
   * Authoritative platform commission take-rate (15.00%) - strictly platform revenue
   */
  platformCommissionPercent: number;

  /**
   * GST rate on platform commission facilitation fee (18.00%)
   */
  gstOnCommissionPercent: number;

  /**
   * Statutory tax holding policy: withheld amounts are held in escrow/accrual, NOT marked remitted
   */
  remittanceMode: 'ESCROW_ACCRUAL_PENDING_CHALLAN_281';

  /**
   * Official statutory citation
   */
  statutoryReference: string;
}

export function getTaxConfig(): TaxPolicyConfig {
  const isApprovedByCa = process.env.TAX_POLICY_APPROVED_BY_CA === 'true';

  // Support environment override if CA prescribes specific rate, default to official CBDT 0.1% rate
  const configuredTdsRate = process.env.STATUTORY_TDS_RATE_PERCENT !== undefined
    ? Number(process.env.STATUTORY_TDS_RATE_PERCENT)
    : 0.1;

  const noPanRate = Number(process.env.NO_PAN_TDS_RATE_PERCENT) || 5.0;
  const isExemptionThresholdActive = process.env.TDS_THRESHOLD_EXEMPTION_ENABLED === 'true';

  return {
    isApprovedByCa,
    status: isApprovedByCa ? 'TAX_POLICY_CA_APPROVED' : 'TAX_POLICY_PENDING_CA_APPROVAL',
    statutoryTdsRatePercent: configuredTdsRate,
    noPanTdsRatePercent: noPanRate,
    tdsExemptionThresholdPaisa: 50000000, // ₹5,00,000
    isExemptionThresholdActive,
    platformCommissionPercent: 15.0,
    gstOnCommissionPercent: 18.0,
    remittanceMode: 'ESCROW_ACCRUAL_PENDING_CHALLAN_281',
    statutoryReference: 'Section 194-O, Income-tax Act, 1961 (amended w.e.f. 01.10.2024 at 0.1%)',
  };
}

/**
 * Calculates statutory TDS deduction strictly in integer paisa.
 * Returns both the calculated amount and the legal audit metadata.
 */
export function calculateStatutoryTdsPaisa(params: {
  grossAmountPaisa: number;
  hasVerifiedPan: boolean;
  cumulativeAnnualGrossPaisa?: number;
}): {
  tdsRatePercent: number;
  tdsDeductionPaisa: number;
  isExempt: boolean;
  exemptionReason: string | null;
  ruleCitation: string;
} {
  const gross = Math.max(0, Math.round(params.grossAmountPaisa));
  const config = getTaxConfig();

  // 1. If provider does not have a verified PAN, Section 206AA mandates 5.0%
  if (!params.hasVerifiedPan) {
    const rate = config.noPanTdsRatePercent;
    const deduction = Math.round((gross * rate) / 100);
    return {
      tdsRatePercent: rate,
      tdsDeductionPaisa: deduction,
      isExempt: false,
      exemptionReason: null,
      ruleCitation: 'Section 206AA (Higher TDS rate in absence of PAN)',
    };
  }

  // 2. Check Section 194-O(2) threshold exemption (<= ₹5,00,000 annual gross) if active
  if (config.isExemptionThresholdActive && params.cumulativeAnnualGrossPaisa !== undefined) {
    const projectedAnnual = params.cumulativeAnnualGrossPaisa + gross;
    if (projectedAnnual <= config.tdsExemptionThresholdPaisa) {
      return {
        tdsRatePercent: 0.0,
        tdsDeductionPaisa: 0,
        isExempt: true,
        exemptionReason: `Gross annual earnings (₹${(projectedAnnual / 100).toFixed(2)}) within Section 194-O(2) exemption limit of ₹5,00,000`,
        ruleCitation: 'Section 194-O(2) (Threshold exemption for Individuals/HUFs with PAN)',
      };
    }
  }

  // 3. Standard Section 194-O statutory deduction (0.1% effective 01.10.2024)
  const rate = config.statutoryTdsRatePercent;
  const deduction = Math.round((gross * rate) / 100);

  return {
    tdsRatePercent: rate,
    tdsDeductionPaisa: deduction,
    isExempt: false,
    exemptionReason: null,
    ruleCitation: config.statutoryReference,
  };
}

/**
 * Safety gate: Live monetary disbursements must be blocked if tax policy is not approved by CA.
 */
export function isLiveDisbursementPermitted(): boolean {
  const config = getTaxConfig();
  return config.isApprovedByCa;
}
