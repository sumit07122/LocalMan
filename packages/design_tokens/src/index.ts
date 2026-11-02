/**
 * LOCALMAN DESIGN TOKENS
 * Single source of truth for design tokens across LocalMan applications.
 */

export const Colors = {
  // Brand Core
  brand: {
    primary: '#101828',       // Deep Ink - Authority, Modernity & Grounding
    primaryHover: '#1D2939',  // Deep Ink Hover
    accent: '#315EFB',        // Primary Blue - Technology, Clarity & Confidence
    accentHover: '#254EDB',   // Blue Hover
    warmAccent: '#F5A524',    // Warning / Indian Local Warmth
    warmAccentHover: '#D98206',
    secondary: '#12A879',     // Success Green - Trust & Operational Vitality
  },

  // Operational & Lifecycle Status
  status: {
    requested: '#315EFB',     // Blue - New / Dispatched
    confirmed: '#6366F1',     // Indigo - Confirmed
    onTheWay: '#F5A524',      // Amber - In Transit
    arrived: '#0EA5E9',       // Sky - Arrived at Location
    inProgress: '#8B5CF6',    // Purple - Work Underway
    completed: '#12A879',     // Emerald Green - Completed & Settled
    cancelled: '#E5484D',     // Ruby Red - Cancelled
    disputed: '#F97316',      // Orange - Flagged / Dispute
    expired: '#667085',       // Slate Gray - Expired
  },

  // Neutrals & Surfaces
  neutral: {
    white: '#FFFFFF',
    surface: '#F5F7FB',       // Soft Cool Canvas Background
    card: '#FFFFFF',          // Clean White Surface
    cardHover: '#FAFBFC',
    border: '#E6EAF0',        // Subtle Clean Dividers
    borderStrong: '#D0D5DD',
    textPrimary: '#172033',   // High-Contrast Primary Text
    textSecondary: '#667085', // Balanced Readable Secondary Text
    textMuted: '#98A2B3',     // Muted Captions & Placeholders
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const Shadows = {
  sm: '0 1px 2px 0 rgba(16, 24, 40, 0.05)',
  md: '0 4px 8px -2px rgba(16, 24, 40, 0.06), 0 2px 4px -2px rgba(16, 24, 40, 0.04)',
  lg: '0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.03)',
} as const;

export const Typography = {
  fontFamilySans: 'Plus Jakarta Sans, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMono: 'JetBrains Mono, Menlo, monospace',
} as const;
