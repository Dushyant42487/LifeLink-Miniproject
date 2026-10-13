// Centralized Geolocation & Distance Calculation Utilities for LifeLink (Frontend)

/**
 * Checks if coordinates are valid, finite, and in real-world geographic bounds.
 * Specifically rejects non-finite, out-of-range, and (0,0) null-island defaults.
 */
export function isValidCoordinate(lat?: any, lng?: any): boolean {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return false;
  if (lat === '' || lng === '') return false;
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return false;
  if (numLat < -90 || numLat > 90) return false;
  if (numLng < -180 || numLng > 180) return false;
  if (numLat === 0 && numLng === 0) return false;
  return true;
}

/**
 * Parses and validates client-supplied coordinate inputs.
 * Returns either validated numbers or a descriptive error string.
 */
export function parseCoordinates(lat?: any, lng?: any): { lat?: number; lng?: number; error?: string } {
  if (lat === undefined && lng === undefined) return {};
  if (lat === null && lng === null) return {};
  if (lat === '' && lng === '') return {};
  
  if (lat === undefined || lat === null || lat === '' || lng === undefined || lng === null || lng === '') {
    return { error: 'Both latitude and longitude must be provided together.' };
  }

  const numLat = Number(lat);
  const numLng = Number(lng);

  if (!Number.isFinite(numLat)) {
    return { error: 'Latitude must be a valid finite number.' };
  }
  if (!Number.isFinite(numLng)) {
    return { error: 'Longitude must be a valid finite number.' };
  }
  if (numLat < -90 || numLat > 90) {
    return { error: `Latitude ${numLat} is out of range. Must be between -90 and 90.` };
  }
  if (numLng < -180 || numLng > 180) {
    return { error: `Longitude ${numLng} is out of range. Must be between -180 and 180.` };
  }

  return { lat: numLat, lng: numLng };
}

/**
 * Calculates geographic distance in kilometers between two GPS coordinates using the Haversine formula.
 */
export function calcHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
