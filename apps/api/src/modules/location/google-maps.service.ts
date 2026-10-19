import { env } from '../../config/env.js';

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number | null;
  etaMinutes: number | null;
  isRealTimeRouting: boolean;
  status: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export class GoogleMapsService {
  private apiKey: string;

  constructor(apiKey = env.GOOGLE_MAPS_API_KEY) {
    this.apiKey = apiKey;
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
   * Resolves routing information between origin and destination.
   * In development/test environments or when credentials are not configured,
   * it cleanly returns straight-line distance with durationSeconds: null (NO fake ETAs).
   */
  async calculateRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
    const straightLineMeters = this.calculateHaversineDistanceMeters(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );

    // If API key is mock or absent, return non-routed fallback
    if (!this.apiKey || this.apiKey === 'mock_gmaps_key' || env.NODE_ENV === 'test') {
      return {
        distanceMeters: straightLineMeters,
        durationSeconds: null,
        etaMinutes: null,
        isRealTimeRouting: false,
        status: 'FALLBACK_STRAIGHT_LINE',
      };
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&key=${this.apiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        return {
          distanceMeters: straightLineMeters,
          durationSeconds: null,
          etaMinutes: null,
          isRealTimeRouting: false,
          status: `HTTP_${response.status}`,
        };
      }

      const data = (await response.json()) as any;
      if (data.status === 'OK' && data.routes?.[0]?.legs?.[0]) {
        const leg = data.routes[0].legs[0];
        const distanceMeters = leg.distance.value;
        const durationSeconds = leg.duration.value;
        const etaMinutes = Math.ceil(durationSeconds / 60);

        return {
          distanceMeters,
          durationSeconds,
          etaMinutes,
          isRealTimeRouting: true,
          status: 'OK',
        };
      }

      return {
        distanceMeters: straightLineMeters,
        durationSeconds: null,
        etaMinutes: null,
        isRealTimeRouting: false,
        status: data.status || 'NO_ROUTE_FOUND',
      };
    } catch {
      return {
        distanceMeters: straightLineMeters,
        durationSeconds: null,
        etaMinutes: null,
        isRealTimeRouting: false,
        status: 'ROUTING_UNAVAILABLE',
      };
    }
  }
}

export const googleMapsService = new GoogleMapsService();
