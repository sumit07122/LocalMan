# LocalMan Phase 2G: Location, Maps, GPS & Provider Operations Architecture

## 1. Executive Summary

Phase 2G establishes the server-authoritative, privacy-preserving, production-grade geospatial and provider operations engine for the LocalMan platform. It bridges mobile device GPS sensors, server-side freshness validation, multi-instance rate throttling, routing abstractions, and proximity-based marketplace dispatch without sacrificing operational security, KYC boundaries, or financial integrity.

---

## 2. Location Data Model

Geographic data in LocalMan represents physical coordinates and kinematics, distinct from financial ledger transactions.

### Database Schema

1. **`Provider` Model (`providers` table)**:
   - `currentLatitude` (`DOUBLE PRECISION`): Most recently reported latitude $[-90.0, 90.0]$.
   - `currentLongitude` (`DOUBLE PRECISION`): Most recently reported longitude $[-180.0, 180.0]$.
   - `lastLocationAt` (`TIMESTAMP(3)`): Server receipt timestamp of the latest valid location update.
   - `currentAccuracyMeters` (`DOUBLE PRECISION`): Horizontal accuracy radius in meters $(0, 5000]$.
   - `currentHeading` (`DOUBLE PRECISION`): Direction of movement in degrees $[0.0, 360.0]$.
   - `currentSpeed` (`DOUBLE PRECISION`): Speed in meters/second $[0.0, 75.0]$.
   - Index: `@@index([isOnline, lastLocationAt], name: "idx_providers_online_location")`.

2. **`ProviderLocationLog` Model (`provider_location_logs` table)**:
   - `id` (`TEXT PRIMARY KEY`): Unique audit log record UUID.
   - `providerId` (`TEXT`): Foreign key referencing `providers.id` with `CASCADE` delete.
   - `bookingId` (`TEXT?`): Optional foreign key referencing `bookings.id` with `SET NULL` on delete.
   - `latitude` (`DOUBLE PRECISION`): Recorded latitude.
   - `longitude` (`DOUBLE PRECISION`): Recorded longitude.
   - `accuracy` (`DOUBLE PRECISION?`): Recorded accuracy in meters.
   - `heading` (`DOUBLE PRECISION?`): Recorded heading.
   - `speed` (`DOUBLE PRECISION?`): Recorded speed.
   - `source` (`VARCHAR(50)`): Source platform (default: `FOREGROUND_APP`).
   - `createdAt` (`TIMESTAMP(3)`): Server timestamp when the point was logged.
   - Indexes:
     - `@@index([providerId, createdAt(sort: Desc)], name: "idx_location_logs_provider_created")`
     - `@@index([bookingId], name: "idx_location_logs_booking")`

---

## 3. Location Freshness & Operational Status

Location data degrades rapidly over time. LocalMan enforces strict server-side freshness validation to ensure providers are never treated as nearby based on expired GPS readings.

### Configurable Threshold

- `LOCATION_FRESHNESS_THRESHOLD_SECONDS = 900` (15 minutes default, configurable via environment variable).

### Freshness Status Calculation

```
                     ┌───────────────────────┐
                     │ Location Update Input │
                     └───────────┬───────────┘
                                 │
                     ┌───────────▼───────────┐
                     │  lastLocationAt == null?
                     └─────┬───────────┬─────┘
                      YES  │           │  NO
             ┌─────────────┘           └─────────────┐
             ▼                                       ▼
       UNAVAILABLE                         Age = now - lastLocationAt
                                                     │
                                       ┌─────────────┴─────────────┐
                                       ▼                           ▼
                                  Age <= 15m                   Age > 15m
                                  (Age >= -15s)                    │
                                       │                           ▼
                                     FRESH                       STALE
```

> **Future Clock Defense**: If a client timestamp is in the future beyond 15 seconds (`ageMs < -15000`), `getFreshnessStatus` classifies it as `UNAVAILABLE` rather than `FRESH`. Rogue client clocks can never claim permanent freshness.

### Operational States

LocalMan formally separates duty status from location availability:

| Operational State | `isOnline` | Location Freshness | Active Job Busy? | Eligible for Proximity Dispatch |
| :--- | :--- | :--- | :--- | :--- |
| **`OFFLINE`** | `false` | Any | No | ❌ No |
| **`ONLINE`** | `true` | `FRESH` | No | ✅ Yes (Proximity Scored) |
| **`ONLINE_BUT_LOCATION_STALE`** | `true` | `STALE` or `UNAVAILABLE` | No | ⚠️ Yes (Fallback to Service Area match, no proximity bonus) |
| **`BUSY`** | `true` | Any | Yes (In transit/active) | ❌ No (Excluded until job completion) |

---

## 4. Provider Location Update API

- **Endpoint**: `POST /api/v1/providers/location` (and `/api/v1/providers/location/beacon` alias)
- **Authentication**: Mandatory JWT session. Provider identity is strictly derived from `request.user.id`; client-supplied `providerId` fields are rejected or ignored.

### Input Schema & Validation Rules

```typescript
export const LocationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().max(5000).optional(),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).max(75).optional(), // ~270 km/h
  timestamp: z.union([z.string().datetime(), z.number()]).optional(),
  source: z.string().max(50).optional().default('FOREGROUND_APP'),
  bookingId: z.string().uuid().optional(),
});
```

### Sanity Checks

1. **Latitude/Longitude**: Validated to physical coordinate bounds $[-90, 90]$ and $[-180, 180]$ with `isNaN` guard.
2. **Accuracy**: Must be positive and $\le 5000$ meters.
3. **Heading**: Must be within $[0, 360]$ degrees.
4. **Speed**: Must be within $[0, 75]$ m/s (~270 km/h).
5. **Timestamp**: If supplied, cannot exceed server time by $> 15$ seconds, nor be older than 24 hours.
6. **Physical Displacement & Speed Sanity**:
   - If consecutive updates occur within 1 hour, implied velocity is calculated:
     $$\text{speed} = \frac{\text{HaversineDistance}(\text{prev}, \text{current})}{\Delta t}$$
   - If velocity exceeds $80\text{ m/s}$ ($\sim 288\text{ km/h}$) across displacements $> 500\text{ m}$, the update is rejected with `ValidationError: Excessive displacement detected. Implied travel speed exceeds physical limits.`
7. **Concurrency & Out-of-Order Arrival**:
   - If an out-of-order beacon arrives where `clientTime < provider.lastLocationAt.getTime()`, the reading is recorded in `provider_location_logs` for audit/telemetry, but `provider`'s active coordinates are **NOT** overwritten, ensuring monotonically advancing state.

---

## 5. Throttling & Anti-Spam Architecture

To prevent database thrashing from high-frequency mobile GPS streaming:
- **Interval Window**: Minimum 5 seconds per provider (`LOCATION_THROTTLE_SECONDS = 5`).
- **Multi-Instance Defense**: Combines in-memory debounce with database timestamp check against `provider.lastLocationAt`. If an update hits another API node within 5 seconds, the database timestamp triggers `429 Too Many Requests`.
- **Response**: Updates arriving within $< 5$ seconds return `429 Too Many Requests` (`TOO_MANY_REQUESTS`).
- **Mobile Client Compliance**: The Flutter `LocationService` buffers and debounces updates to ensure requests are transmitted only when the 5-second interval has elapsed or significant displacement occurs.

---

## 6. Proximity Matching & Service Area Integration

In Phase 2F, `MatchingService` selected candidates based on online status and service areas. Phase 2G integrates real-time GPS freshness into proximity ranking:

1. **Service Area Boundary Check**:
   - Matches city and/or radius circle from `ProviderServiceArea` center coordinates.
2. **Fresh Location Requirement & Scoring Advantage**:
   - If provider coordinates are `FRESH`, straight-line Haversine distance to customer service address is calculated:
     $$\text{Score} = (\text{RatingAvg} \times 20) + (\min(\text{ExperienceYears}, 10) \times 2) + \max(0, 20 - \text{DistanceKm} \times 2)$$
   - Fresh nearby candidates receive a proximity bonus up to $+20$ points.
   - If provider coordinates are `STALE` or `UNAVAILABLE`:
     - Distance is `undefined`.
     - Provider receives $+0$ proximity bonus.
     - Provider remains eligible under service area fallback rules, scored purely on rating and experience.
3. **Strict On-Demand Mode**:
   - If `options.requireFreshLocation == true`, providers with stale or absent locations are excluded immediately from urgent dispatch rings.

---

## 7. Google Maps & ETA Architecture

LocalMan implements a clean abstraction layer (`GoogleMapsService`) for routing, distance, and ETA calculations:

```typescript
export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number | null;
  etaMinutes: number | null;
  isRealTimeRouting: boolean;
  status: string;
}
```

### Anti-Fabrication Invariant

- **Rule**: **NEVER fabricate ETA or distance using constants or arbitrary formulas.**
- **Development/Test Fallback**:
  - When `GOOGLE_MAPS_API_KEY` is not configured, set to `mock_gmaps_key`, or during tests:
    - Calculates true Haversine distance in meters (`distanceMeters`).
    - Leaves `durationSeconds: null` and `etaMinutes: null`.
    - Returns `isRealTimeRouting: false` with status `FALLBACK_STRAIGHT_LINE`.
- **Production Integration**:
  - When valid production credentials are supplied, calls Google Directions API driving mode.
  - Returns road network driving distance and traffic-aware `durationSeconds`.

---

## 8. Provider Mobile GPS & Background Location Boundary

### Foreground-Only Decision (Phase 2G Boundary)

- **Policy**: For LocalMan V1, **foreground location tracking while on-duty and during job execution is strictly sufficient**.
- **Rationale**:
  1. **Worker Privacy**: Providers should not be tracked when off-duty or when the application is closed.
  2. **Battery & Device Performance**: Continuous background location drains battery excessively on budget Android devices common among gig workers.
  3. **App Store & Play Store Compliance**: Background location requires explicit regulatory justification, prominent disclosure, and scrutiny.
- **Manifest / Plist Configuration**:
  - Android: `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` added. No `ACCESS_BACKGROUND_LOCATION`.
  - iOS: `NSLocationWhenInUseUsageDescription` added. No `NSLocationAlwaysUsageDescription`.
- **Lifecycle Integration**:
  - `startForegroundTracking()` begins periodic 30-second GPS fixes when the provider switches duty to `ONLINE` or transitions to `PROVIDER_ON_THE_WAY`.
  - `stopTracking()` cancels all GPS listeners when the provider toggles `OFFLINE`.

---

## 9. Location Privacy & Authorization Boundaries

Provider location is sensitive PII. LocalMan enforces strict access boundaries:

1. **Customer Tracking Endpoint**:
   - `GET /api/v1/bookings/:id/provider-location`
   - **Access Rules**:
     - Requesting user must be the customer who booked the service, or an administrator (`ADMIN` / `CITY_MANAGER`).
     - Booking lifecycle state **MUST** be `PROVIDER_ON_THE_WAY` or `ARRIVED`.
     - If booking is in `REQUESTED`, `CONFIRMED`, `JOB_STARTED`, or `COMPLETED`, tracking is rejected with `403 Forbidden`.
     - Intruders / other customers attempting IDOR tracking receive `403 Forbidden`.
   - **Anti-Stale Presentation**:
     - If provider location is `STALE`, coordinates are nullified (`latitude: null, longitude: null, etaMinutes: null, distanceMeters: null, isRealTimeRouting: false`) with explicit `freshnessStatus: 'STALE'`.
     - Stale coordinates are never presented as a live position.
     - If `UNAVAILABLE`, all coordinate and routing fields are null.
2. **Historical Breadcrumb Isolation**:
   - Customer tracking returns only the current snapshot.
   - Historical route breadcrumbs from `provider_location_logs` are never leaked to customers or unauthorized users.

---

## 10. Data Retention & Pruning Policy

To comply with data minimization and storage privacy principles:
- Location breadcrumbs in `provider_location_logs` have an active operational retention window of **30 days**.
- Administrative endpoint `POST /api/v1/admin/location/prune` executes time-based deletion of records older than `retentionDays` (`ADMIN` role only, requires `retentionDays >= 1`).
- All pruning operations write an immutable audit log entry in `audit_logs` recording the executing administrator ID, retention window, and deleted record count.

---

## 11. Real-Time Location Events

Integrated with `RealtimeService`:
- `PROVIDER_LOCATION_UPDATED`: Emitted to `provider:{id}` channel and active `booking:{bookingId}` channel.
- **Event Scope**: Real-time GPS coordinates are broadcast to customer booking channels **ONLY** while `currentStatus` is `PROVIDER_ON_THE_WAY` or `ARRIVED`. Once the job enters `JOB_STARTED`, GPS streaming to the booking channel is discontinued.
- `PROVIDER_LOCATION_STALE`: Broadcast when a provider's location heartbeat lapses.
- `PROVIDER_LOCATION_UNAVAILABLE`: Broadcast when GPS fix cannot be acquired.
