/**
 * Startup validation for LocalMan Admin Web Dashboard.
 * Fails fast with clear actionable messages if required variables are missing.
 */
export function validateAdminEnv(): void {
  const envMode = import.meta.env.MODE || 'development';
  const apiUrl = import.meta.env.VITE_API_BASE_URL;

  // In production, an explicit VITE_API_BASE_URL with HTTPS is required
  if (envMode === 'production') {
    if (!apiUrl) {
      console.error('================================================================================');
      console.error('❌ FATAL STARTUP ERROR: VITE_API_BASE_URL is missing in production build.');
      console.error('💡 Remedy: Set VITE_API_BASE_URL=https://api.localman.in in your production environment.');
      console.error('================================================================================');
      throw new Error('Missing required environment variable: VITE_API_BASE_URL');
    }

    if (!apiUrl.startsWith('https://')) {
      console.warn('⚠️ SECURITY WARNING: VITE_API_BASE_URL does not use HTTPS in production:', apiUrl);
    }
  }

  // Debug log in development
  if (envMode === 'development') {
    console.info(`[LocalMan Admin Web] Initialized in development mode (API: ${apiUrl || '/api (Vite proxy)'})`);
  }
}
