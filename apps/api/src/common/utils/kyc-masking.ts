/**
 * Safe KYC Document Masking (Phase 4M)
 * Strict compliance with DPDPA 2023 & Aadhaar Act Section 29.
 * An unmasked document number must NEVER be returned to dashboard or API consumers.
 */
export function safelyMaskKycDocumentNumber(
  documentType: string,
  rawNumber?: string | null,
  existingMasked?: string | null
): string {
  // 1. If an existing mask is valid (contains masking characters 'X' or '*'), prefer it
  if (
    existingMasked &&
    typeof existingMasked === 'string' &&
    (existingMasked.includes('X') || existingMasked.includes('*')) &&
    existingMasked.length >= 4
  ) {
    return existingMasked;
  }

  // 2. If raw number is missing, empty, or not a string, return safe redaction
  if (!rawNumber || typeof rawNumber !== 'string') {
    return 'XXXXXXXX****';
  }

  const clean = rawNumber.trim().replace(/\s+/g, '');
  if (clean.length === 0) {
    return 'XXXXXXXX****';
  }

  // 3. Document-specific masking rules
  if (documentType === 'AADHAAR_FRONT' || documentType === 'AADHAAR_BACK') {
    // UIDAI standard: First 8 digits masked, only last 4 visible
    const last4 = clean.length >= 4 ? clean.slice(-4) : '****';
    return `XXXXXXXX${last4}`;
  }

  if (documentType === 'PAN_CARD') {
    // Standard Indian PAN: 10 chars (e.g. ABCDE1234F -> ABXXXXXX4F)
    if (clean.length >= 4) {
      const prefix = clean.slice(0, 2);
      const suffix = clean.slice(-2);
      return `${prefix}XXXXXX${suffix}`;
    }
    return 'XXXXX****';
  }

  // Generic document types (Trade certificate, driving license, etc.)
  if (clean.length > 4) {
    const last4 = clean.slice(-4);
    return `XXXX-XXXX-${last4}`;
  }

  return 'XXXXXXXX****';
}

