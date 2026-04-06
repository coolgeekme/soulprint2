/**
 * Location and Places handlers
 * Extracted from the main catch-all route.js for maintainability.
 */

import { getDb } from '@/lib/mongodb';
import { authenticate, ok, err, getClientIP, getLocationFromIP } from '@/lib/api-utils';
import { geocodeAddress, searchNearbyPlaces, extractPlaceType } from '@/lib/handlers/location-services';
import { invalidateSystemPromptCache } from '@/lib/handlers/chat-cache';

// PLACES SEARCH API
async function handlePlacesSearch(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { query, location, lat, lng, radius = 2000, maxResults = 10 } = body;

  if (!query && !location && (!lat || !lng)) {
    return err('Either query with location, or lat/lng coordinates required');
  }

  try {
    let coords = { lat, lng };
    let locationName = location || 'selected location';

    if (!lat || !lng) {
      if (location) {
        const geocoded = await geocodeAddress(location);
        if (!geocoded) return err(`Could not find location: ${location}`);
        coords = { lat: geocoded.lat, lng: geocoded.lng };
        locationName = geocoded.formattedAddress;
      } else {
        return err('Location or coordinates required');
      }
    }

    const placeType = query ? extractPlaceType(query) : null;

    const places = await searchNearbyPlaces({
      lat: coords.lat,
      lng: coords.lng,
      query: placeType ? null : query,
      type: placeType,
      radius,
      maxResults,
    });

    return ok({
      places,
      location: locationName,
      coordinates: coords,
      count: places.length,
    });
  } catch (e) {
    return err(`Search failed: ${e.message}`, 500);
  }
}

// GEOCODE API
async function handleGeocode(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { address } = body;

  if (!address) return err('address required');

  try {
    const result = await geocodeAddress(address);
    if (!result) return err(`Could not find location: ${address}`);
    return ok(result);
  } catch (e) {
    return err(`Geocode failed: ${e.message}`, 500);
  }
}

// USER LOCATION - Save browser geolocation
async function handleSaveUserLocation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  const body = await request.json();
  const { lat, lng, timezone } = body;

  if (!lat || !lng) return err('lat and lng required');

  try {
    const db = await getDb();
    
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    let address = 'Your location';
    
    if (apiKey) {
      const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
      const geoData = await geoRes.json();
      address = geoData.results?.[0]?.formatted_address || 'Your location';
    }

    let userTimezone = timezone;
    if (!userTimezone && apiKey) {
      const timestamp = Math.floor(Date.now() / 1000);
      const tzRes = await fetch(`https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`);
      const tzData = await tzRes.json();
      if (tzData.timeZoneId) {
        userTimezone = tzData.timeZoneId;
      }
    }

    await db.collection('user_locations').updateOne(
      { user_id: user.id },
      { 
        $set: { 
          lat, 
          lng, 
          address,
          timezone: userTimezone || 'UTC',
          updated_at: new Date(),
          source: 'web'
        } 
      },
      { upsert: true }
    );

    invalidateSystemPromptCache(user.id);

    return ok({ success: true, address, lat, lng, timezone: userTimezone || 'UTC' });
  } catch (error) {
    return err(`Failed to save location: ${error.message}`, 500);
  }
}

// USER LOCATION - Get current saved location
async function handleGetUserLocation(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const db = await getDb();
    let location = await db.collection('user_locations').findOne({ user_id: user.id });
    
    if (!location || !location.lat || !location.lng) {
      const clientIP = getClientIP(request);
      if (clientIP) {
        const ipLocation = await getLocationFromIP(clientIP);
        if (ipLocation) {
          await db.collection('user_locations').updateOne(
            { user_id: user.id },
            { 
              $set: { 
                ...ipLocation,
                updated_at: new Date()
              } 
            },
            { upsert: true }
          );
          location = ipLocation;
          invalidateSystemPromptCache(user.id);
        }
      }
    }
    
    if (!location || !location.lat || !location.lng) {
      return ok({ hasLocation: false });
    }

    return ok({ 
      hasLocation: true, 
      lat: location.lat, 
      lng: location.lng, 
      address: location.address,
      source: location.source || 'manual',
      city: location.city,
      region: location.region,
      country: location.country,
      timezone: location.timezone,
      updated_at: location.updated_at
    });
  } catch (error) {
    return err(`Failed to get location: ${error.message}`, 500);
  }
}

// USER TIMEZONE - Save
async function handleSaveUserTimezone(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const body = await request.json();
    const { timezone } = body;
    
    if (!timezone) return err('timezone required');

    const db = await getDb();
    
    await db.collection('user_locations').updateOne(
      { user_id: user.id },
      { 
        $set: { 
          timezone,
          timezone_updated_at: new Date(),
        },
        $setOnInsert: {
          user_id: user.id,
          source: 'auto'
        }
      },
      { upsert: true }
    );

    invalidateSystemPromptCache(user.id);

    return ok({ success: true, timezone });
  } catch (error) {
    return err(`Failed to save timezone: ${error.message}`, 500);
  }
}

// USER TIMEZONE - Get
async function handleGetUserTimezone(request) {
  const user = await authenticate(request);
  if (!user) return err('Unauthorized', 401);

  try {
    const db = await getDb();
    const location = await db.collection('user_locations').findOne({ user_id: user.id });
    
    return ok({ 
      timezone: location?.timezone || 'UTC',
      hasTimezone: !!location?.timezone
    });
  } catch (error) {
    return err(`Failed to get timezone: ${error.message}`, 500);
  }
}

export {
  handlePlacesSearch,
  handleGeocode,
  handleSaveUserLocation,
  handleGetUserLocation,
  handleSaveUserTimezone,
  handleGetUserTimezone,
};
