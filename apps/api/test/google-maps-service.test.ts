import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GoogleMapsService } from '../src/modules/location/google-maps.service.js';

describe('GoogleMapsService: Caching, Budget Guard & Haversine Fallback', () => {
  const origin = { lat: 12.9716, lng: 77.5946 }; // Bengaluru MG Road
  const dest = { lat: 12.9784, lng: 77.6408 }; // Indiranagar

  it('1. Calculates accurate Haversine straight-line distance', () => {
    const service = new GoogleMapsService();
    const distance = service.calculateHaversineDistanceMeters(
      origin.lat,
      origin.lng,
      dest.lat,
      dest.lng
    );
    // Distance between MG Road and Indiranagar is ~5 km (+- 500m)
    assert.ok(distance > 4500 && distance < 5500);
  });

  it('2. Returns Haversine fallback when API key is mock or absent', async () => {
    const service = new GoogleMapsService({ apiKey: 'mock_gmaps_key' });
    const route = await service.calculateRoute(origin, dest);

    assert.strictEqual(route.isRealTimeRouting, false);
    assert.strictEqual(route.durationSeconds, null);
    assert.strictEqual(route.etaMinutes, null);
    assert.strictEqual(route.status, 'FALLBACK_STRAIGHT_LINE');
    assert.ok(route.distanceMeters > 0);
  });

  it('3. Successfully parses real Google Directions API response when valid key and network response provided', async () => {
    const mockFetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          routes: [
            {
              legs: [
                {
                  distance: { value: 5200 },
                  duration: { value: 900 }, // 15 mins
                },
              ],
            },
          ],
        }),
      } as any;
    };

    const service = new GoogleMapsService({
      apiKey: 'AIzaSy_real_test_key_123',
      fetchFn: mockFetch,
    });

    const route = await service.calculateRoute(origin, dest, { forceLive: true });
    assert.strictEqual(route.isRealTimeRouting, true);
    assert.strictEqual(route.distanceMeters, 5200);
    assert.strictEqual(route.durationSeconds, 900);
    assert.strictEqual(route.etaMinutes, 15);
    assert.strictEqual(route.status, 'OK');
  });

  it('4. Re-queries hit the 30-second in-memory cache without calling fetch again', async () => {
    let fetchCount = 0;
    const mockFetch = async () => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          routes: [
            {
              legs: [
                {
                  distance: { value: 5200 },
                  duration: { value: 900 },
                },
              ],
            },
          ],
        }),
      } as any;
    };

    const service = new GoogleMapsService({
      apiKey: 'AIzaSy_real_test_key_123',
      fetchFn: mockFetch,
      cacheTtlMs: 30000,
    });

    // Call 1: misses cache, executes fetch
    const route1 = await service.calculateRoute(origin, dest, { forceLive: true });
    assert.strictEqual(fetchCount, 1);
    assert.strictEqual(route1.cached, undefined);

    // Call 2: hits cache, does not execute fetch
    const route2 = await service.calculateRoute(origin, dest, { forceLive: true });
    assert.strictEqual(fetchCount, 1);
    assert.strictEqual(route2.cached, true);
    assert.strictEqual(route2.distanceMeters, 5200);
  });

  it('5. Request Budget Guard blocks calls when minute limit is reached and falls back to Haversine straight line', async () => {
    let fetchCount = 0;
    const mockFetch = async () => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'OK',
          routes: [
            {
              legs: [
                {
                  distance: { value: 5200 },
                  duration: { value: 900 },
                },
              ],
            },
          ],
        }),
      } as any;
    };

    const service = new GoogleMapsService({
      apiKey: 'AIzaSy_real_test_key_123',
      fetchFn: mockFetch,
      maxRequestsPerMinute: 2, // Strict budget for test
      cacheTtlMs: 1, // Expire cache immediately so we test budget
    });

    // Call 1: within budget
    await service.calculateRoute({ lat: 12.1, lng: 77.1 }, { lat: 12.2, lng: 77.2 }, { forceLive: true });
    assert.strictEqual(fetchCount, 1);

    // Call 2: within budget
    await service.calculateRoute({ lat: 12.3, lng: 77.3 }, { lat: 12.4, lng: 77.4 }, { forceLive: true });
    assert.strictEqual(fetchCount, 2);

    // Call 3: budget exceeded -> falls back without calling fetch
    const route3 = await service.calculateRoute(
      { lat: 12.5, lng: 77.5 },
      { lat: 12.6, lng: 77.6 },
      { forceLive: true }
    );
    assert.strictEqual(fetchCount, 2); // Fetch was NOT called
    assert.strictEqual(route3.isRealTimeRouting, false);
    assert.strictEqual(route3.status, 'BUDGET_EXCEEDED_FALLBACK');
    assert.strictEqual(route3.durationSeconds, null);
  });

  it('6. Gracefully handles HTTP or network errors by returning Haversine straight line', async () => {
    const errorFetch = async () => {
      throw new Error('Network timeout or DNS failure');
    };

    const service = new GoogleMapsService({
      apiKey: 'AIzaSy_real_test_key_123',
      fetchFn: errorFetch as any,
    });

    const route = await service.calculateRoute(origin, dest, { forceLive: true });
    assert.strictEqual(route.isRealTimeRouting, false);
    assert.strictEqual(route.status, 'ROUTING_UNAVAILABLE');
    assert.strictEqual(route.durationSeconds, null);
    assert.ok(route.distanceMeters > 0);
  });
});
