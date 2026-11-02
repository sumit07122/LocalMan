import { env } from '../../config/env.js';

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number | null;
  etaMinutes: number | null;
  isRealTimeRouting: boolean;
  status: string;
  cached?: boolean;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GoogleMapsServiceOptions {
  apiKey?: string;
  cacheTtlMs?: number;
  maxRequestsPerMinute?: number;
  maxRequestsPerDay?: number;
  fetchFn?: typeof fetch;
}

interface CacheEntry {
  result: RouteResult;
  expiresAt: number;
}

export class GoogleMapsService {
  private apiKey: string;
  private cacheTtlMs: number;
  private maxRequestsPerMinute: number;
  private maxRequestsPerDay: number;
  private fetchFn: typeof fetch;

  private cache = new Map<string, CacheEntry>();
  private minuteRequestTimestamps: number[] = [];
  private dayRequestCount = 0;
  private currentDay = new Date().toISOString().slice(0, 10);

  constructor(options: GoogleMapsServiceOptions = {}) {
    this.apiKey = options.apiKey ?? env.GOOGLE_MAPS_API_KEY;
    this.cacheTtlMs = options.cacheTtlMs ?? 30_000; // 30 seconds default cache TTL
    this.maxRequestsPerMinute = options.maxRequestsPerMinute ?? 60; // 60 requests/min budget
    this.maxRequestsPerDay = options.maxRequestsPerDay ?? 5000; // 5000 requests/day budget
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Calculates Haversine straight-line distance between two coordinates in meters.
   */
  public calculateHaversineDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Clears the in-memory route cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Resets the rolling request budget counters (useful in automated testing).
   */
  public resetBudget(): void {
    this.minuteRequestTimestamps = [];
    this.dayRequestCount = 0;
  }

  /**
   * Returns current budget and cache statistics for monitoring & health checks.
   */
  public getBudgetStats() {
    this.pruneMinuteBudget();
    return {
      requestsThisMinute: this.minuteRequestTimestamps.length,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      requestsToday: this.dayRequestCount,
      maxRequestsPerDay: this.maxRequestsPerDay,
      cachedRoutesCount: this.cache.size,
      hasRealApiKey: Boolean(this.apiKey && this.apiKey !== 'mock_gmaps_key'),
    };
  }

  private pruneMinuteBudget(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    this.minuteRequestTimestamps = this.minuteRequestTimestamps.filter((ts) => ts > oneMinuteAgo);

    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.currentDay) {
      this.currentDay = today;
      this.dayRequestCount = 0;
    }
  }

  private isBudgetExceeded(): boolean {
    this.pruneMinuteBudget();
    if (this.minuteRequestTimestamps.length >= this.maxRequestsPerMinute) {
      return true;
    }
    if (this.dayRequestCount >= this.maxRequestsPerDay) {
      return true;
    }
    return false;
  }

  private recordRequestUsage(): void {
    const now = Date.now();
    this.minuteRequestTimestamps.push(now);
    this.dayRequestCount++;
  }

  /**
   * Resolves routing information between origin and destination.
   * - Supports real Google Maps Directions API key when provided.
   * - Includes 30-second memory cache to eliminate redundant queries.
   * - Includes request budget guard to prevent API bill explosions.
   * - Cleanly falls back to Haversine straight-line distance with durationSeconds: null (NO fake ETAs).
   */
  async calculateRoute(
    origin: Coordinates,
    destination: Coordinates,
    options?: { forceLive?: boolean }
  ): Promise<RouteResult> {
    const straightLineMeters = this.calculateHaversineDistanceMeters(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );

    // 1. Check in-memory cache (30s TTL)
    const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return {
        ...cached.result,
        cached: true,
      };
    }

    // 2. If API key is mock, empty, or test mode without forceLive, return Haversine fallback
    const isMock = !this.apiKey || this.apiKey === 'mock_gmaps_key';
    const isTestMode = env.NODE_ENV === 'test' && !options?.forceLive;

    if (isMock || isTestMode) {
      const fallbackResult: RouteResult = {
        distanceMeters: straightLineMeters,
        durationSeconds: null,
        etaMinutes: null,
        isRealTimeRouting: false,
        status: 'FALLBACK_STRAIGHT_LINE',
      };
      this.cache.set(cacheKey, {
        result: fallbackResult,
        expiresAt: now + this.cacheTtlMs,
      });
      return fallbackResult;
    }

    // 3. Request budget guard: prevent bill explosions
    if (this.isBudgetExceeded()) {
      const budgetFallback: RouteResult = {
        distanceMeters: straightLineMeters,
        durationSeconds: null,
        etaMinutes: null,
        isRealTimeRouting: false,
        status: 'BUDGET_EXCEEDED_FALLBACK',
      };
      this.cache.set(cacheKey, {
        result: budgetFallback,
        expiresAt: now + this.cacheTtlMs,
      });
      return budgetFallback;
    }

    // 4. Execute external Google Directions API call with timeout
    try {
      this.recordRequestUsage();
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&key=${encodeURIComponent(
        this.apiKey
      )}`;

      const response = await this.fetchFn(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        const errorFallback: RouteResult = {
          distanceMeters: straightLineMeters,
          durationSeconds: null,
          etaMinutes: null,
          isRealTimeRouting: false,
          status: `HTTP_${response.status}`,
        };
        this.cache.set(cacheKey, {
          result: errorFallback,
          expiresAt: now + this.cacheTtlMs,
        });
        return errorFallback;
      }

      const data = (await response.json()) as any;
      if (data.status === 'OK' && data.routes?.[0]?.legs?.[0]) {
        const leg = data.routes[0].legs[0];
        const distanceMeters = leg.distance.value;
        const durationSeconds = leg.duration.value;
        const etaMinutes = Math.ceil(durationSeconds / 60);

        const realResult: RouteResult = {
          distanceMeters,
          durationSeconds,
          etaMinutes,
          isRealTimeRouting: true,
          status: 'OK',
        };
        this.cache.set(cacheKey, {
          result: realResult,
          expiresAt: now + this.cacheTtlMs,
        });
        return realResult;
      }

      const statusFallback: RouteResult = {
        distanceMeters: straightLineMeters,
        durationSeconds: null,
        etaMinutes: null,
        isRealTimeRouting: false,
        status: data.status || 'NO_ROUTE_FOUND',
      };
      this.cache.set(cacheKey, {
        result: statusFallback,
        expiresAt: now + this.cacheTtlMs,
      });
      return statusFallback;
    } catch {
      const exceptionFallback: RouteResult = {
        distanceMeters: straightLineMeters,
        durationSeconds: null,
        etaMinutes: null,
        isRealTimeRouting: false,
        status: 'ROUTING_UNAVAILABLE',
      };
      this.cache.set(cacheKey, {
        result: exceptionFallback,
        expiresAt: now + this.cacheTtlMs,
      });
      return exceptionFallback;
    }
  }
}

export const googleMapsService = new GoogleMapsService();
