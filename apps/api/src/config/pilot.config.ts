export interface PilotZoneConfig {
  isConfirmedByOwner: boolean;
  status: 'PILOT_ZONE_CONFIRMED' | 'PILOT_ZONE_NOT_CONFIRMED';
  clusterName: string | null;
  city: string | null;
  state: string | null;
  pincodes: string[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null;
  targetCustomerCohort: number;
  targetProviderCohort: number;
}

/**
 * Controlled Marketplace Pilot Configuration (Phase 4M)
 * Geofenced pilot zones require explicit project owner confirmation before activation.
 * Never silently activate a pilot zone without owner configuration.
 */
export function getPilotConfig(): PilotZoneConfig {
  const isOwnerConfirmed = process.env.PILOT_ZONE_CONFIRMED === 'true';

  const targetCustomerCohort = Number(process.env.PILOT_TARGET_CUSTOMER_COHORT) || 50;
  const targetProviderCohort = Number(process.env.PILOT_TARGET_PROVIDER_COHORT) || 10;

  if (!isOwnerConfirmed) {
    return {
      isConfirmedByOwner: false,
      status: 'PILOT_ZONE_NOT_CONFIRMED',
      clusterName: null,
      city: null,
      state: null,
      pincodes: [],
      bounds: null,
      targetCustomerCohort,
      targetProviderCohort,
    };
  }

  const clusterName = process.env.PILOT_CLUSTER_NAME || 'Owner Approved Pilot Cluster';
  const city = process.env.PILOT_CITY || 'Unconfirmed';
  const state = process.env.PILOT_STATE || 'Unconfirmed';
  const pincodes = (process.env.PILOT_PINCODES || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const minLat = Number(process.env.PILOT_MIN_LAT) || 0;
  const maxLat = Number(process.env.PILOT_MAX_LAT) || 0;
  const minLng = Number(process.env.PILOT_MIN_LNG) || 0;
  const maxLng = Number(process.env.PILOT_MAX_LNG) || 0;

  const hasBounds = minLat !== 0 || maxLat !== 0 || minLng !== 0 || maxLng !== 0;

  return {
    isConfirmedByOwner: true,
    status: 'PILOT_ZONE_CONFIRMED',
    clusterName,
    city,
    state,
    pincodes,
    bounds: hasBounds ? { minLat, maxLat, minLng, maxLng } : null,
    targetCustomerCohort,
    targetProviderCohort,
  };
}

/**
 * Checks whether a given pincode is permitted under the active pilot configuration.
 * Always returns false if the pilot zone is unconfirmed by the owner.
 */
export function isPincodeInPilotZone(postalCode?: string | null): boolean {
  const config = getPilotConfig();
  if (!config.isConfirmedByOwner || config.pincodes.length === 0) {
    return false;
  }
  if (!postalCode) {
    return false;
  }
  const cleanCode = postalCode.trim();
  return config.pincodes.includes(cleanCode);
}

