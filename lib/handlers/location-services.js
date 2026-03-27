/**
 * Location Services — Geocoding, Places API, Location handling
 * Extracted from the main catch-all route.js for maintainability.
 * 
 * Note: getClientIP and getLocationFromIP are in @/lib/api-utils.js
 */

async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('Google Places API key not configured');
  
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.status !== 'OK' || !data.results?.[0]) {
    return null;
  }
  
  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}


async function searchNearbyPlaces({ lat, lng, query, type, radius = 1500, maxResults = 5 }) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('Google Places API key not configured');
  
  let url;
  if (query) {
    // Text search (more flexible)
    url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
  } else if (type) {
    // Nearby search with type
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
  } else {
    // General nearby search
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
  }
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Places API error: ${data.status}`);
  }
  
  const places = (data.results || []).slice(0, maxResults).map(place => ({
    name: place.name,
    address: place.vicinity || place.formatted_address,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
    priceLevel: place.price_level,
    isOpen: place.opening_hours?.open_now,
    types: place.types,
    placeId: place.place_id,
    lat: place.geometry?.location?.lat,
    lng: place.geometry?.location?.lng,
  }));
  
  return places;
}

// Get place details
async function getPlaceDetails(placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('Google Places API key not configured');
  
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,opening_hours,rating,reviews,price_level,url&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.status !== 'OK') {
    throw new Error(data.error_message || `Places API error: ${data.status}`);
  }
  
  return data.result;
}

// Format places for Telegram message

// Parse location query from text
function parseLocationQuery(text) {
  // Patterns: "near [location]", "in [location]", "around [location]"
  const nearMatch = text.match(/\b(?:near|in|around|at)\s+(.+?)(?:\s*$|\s+(?:for|to|and))/i);
  if (nearMatch) {
    return nearMatch[1].trim();
  }
  
  // Check if text ends with a location (after the search term)
  const parts = text.split(/\s+(?:near|in|around|at)\s+/i);
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  
  return null;
}

// Extract search type from query
function extractPlaceType(text) {
  const lowerText = text.toLowerCase();
  for (const [keyword, type] of Object.entries(PLACE_TYPES)) {
    if (lowerText.includes(keyword)) {
      return type;
    }
  }
  return null;
}


export {
  geocodeAddress,
  searchNearbyPlaces,
  getPlaceDetails,
  parseLocationQuery,
  extractPlaceType,
};
