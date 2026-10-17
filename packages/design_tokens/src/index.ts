export const Colors = {
  // Brand Primary & Accents
  brand: {
    primary: '#0F172A',      // Slate 900 - Trust & Authority
    primaryLight: '#1E293B', // Slate 800
    accent: '#F59E0B',       // Amber 500 - Energy & Indian Local Warmth
    accentHover: '#D97706',  // Amber 600
    secondary: '#0D9488',    // Teal 600 - Freshness & Reliability
  },

  // Booking & Operational Status Colors
  status: {
    requested: '#3B82F6',    // Blue 500
    confirmed: '#8B5CF6',    // Purple 500
    onTheWay: '#F59E0B',     // Amber 500
    arrived: '#06B6D4',      // Cyan 500
    inProgress: '#6366F1',   // Indigo 500
    completed: '#10B981',    // Emerald 500
    cancelled: '#EF4444',    // Red 500
    disputed: '#F97316',     // Orange 500
    expired: '#6B7280',      // Gray 500
  },

  // Neutral Scales
  neutral: {
    white: '#FFFFFF',
    surface: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
  },
} as const;

export const Typography = {
  fontFamilySans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMono: 'JetBrains Mono, Menlo, monospace',
} as const;
