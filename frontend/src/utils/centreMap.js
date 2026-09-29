// Builds a Google Maps URL for a centre, with no API key required (uses the
// public maps.google.com "search" URL scheme, which opens the Maps app on
// mobile or a new tab on desktop). Prefers exact coordinates when the
// centre has them (backend/models/Centre.js's `location.latitude/
// longitude`, populated for most centres via the DPC data load) and falls
// back to a text search built from name/village/taluk/district for the
// centres that don't.
export function centreMapUrl(centre) {
  if (!centre) return null;
  const lat = centre.location?.latitude;
  const lng = centre.location?.longitude;
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const parts = [centre.name, centre.address, centre.village, centre.taluk, centre.district].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}
