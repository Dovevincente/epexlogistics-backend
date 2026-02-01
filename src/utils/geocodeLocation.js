/**
 * utils/geocodeLocation.js
 *
 * Converts a city + country into latitude & longitude
 * Map-ready utility (Google Maps / Leaflet / Mapbox)
 *
 * Safe fallback: returns null coordinates if lookup fails
 */

import fetch from "node-fetch";

export const geocodeLocation = async (city, country) => {
  try {
    if (!city || !country) {
      return { lat: null, lng: null };
    }

    const query = encodeURIComponent(`${city}, ${country}`);

    // 🌍 OpenStreetMap Nominatim (FREE, no API key)
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Epex-Logistics/1.0 (admin@epexlogistics.com)",
      },
    });

    const data = await response.json();

    if (!data || data.length === 0) {
      return { lat: null, lng: null };
    }

    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
    };
  } catch (error) {
    console.error("Geocoding failed:", error);
    return { lat: null, lng: null };
  }
};
