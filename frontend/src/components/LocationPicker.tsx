"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Map, { Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface LocationPickerProps {
  address: string;
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number | null, lng: number | null) => void;
}

export default function LocationPicker({
  address,
  latitude,
  longitude,
  onLocationChange,
}: LocationPickerProps) {
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const geocode = useCallback(
    async (query: string) => {
      if (!query || query.length < 5) return;
      setGeocoding(true);
      setGeocodeError(null);
      try {
        let data;
        if (MAPBOX_TOKEN) {
          // Use Mapbox Geocoding API
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1&language=es`
          );
          const json = await res.json();
          if (json.features && json.features.length > 0) {
            const [lng, lat] = json.features[0].center;
            onLocationChange(lat, lng);
            return;
          }
          data = [];
        } else {
          // Fallback to Nominatim
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
            { headers: { "Accept-Language": "es" } }
          );
          data = await res.json();
          if (data.length > 0) {
            onLocationChange(parseFloat(data[0].lat), parseFloat(data[0].lon));
            return;
          }
        }
        setGeocodeError("No se encontro la ubicacion");
      } catch {
        setGeocodeError("Error al buscar ubicacion");
      } finally {
        setGeocoding(false);
      }
    },
    [onLocationChange]
  );

  // Debounce geocoding when address changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      geocode(address);
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [address, geocode]);

  const hasLocation = latitude !== null && longitude !== null;

  return (
    <div>
      <div className="flex items-center gap-2">
        {geocoding && (
          <p className="text-[11px] text-[#86868b]">Buscando ubicacion...</p>
        )}
        {geocodeError && (
          <p className="text-[11px] text-[#ff9500]">{geocodeError}</p>
        )}
        {hasLocation && !geocoding && (
          <p className="text-[11px] text-[#34c759]">
            {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
          </p>
        )}
      </div>

      {hasLocation && MAPBOX_TOKEN && (
        <div className="mt-2 overflow-hidden rounded-xl border border-[#e5e5ea]">
          <Map
            key={`${latitude}-${longitude}`}
            initialViewState={{
              latitude: latitude!,
              longitude: longitude!,
              zoom: 15,
            }}
            style={{ width: "100%", height: 180 }}
            mapStyle="mapbox://styles/mapbox/light-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
            interactive={false}
          >
            <Marker latitude={latitude!} longitude={longitude!} anchor="bottom">
              <div className="flex h-8 w-8 items-center justify-center">
                <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
                  <path
                    d="M12 0C5.4 0 0 5.4 0 12C0 21 12 32 12 32S24 21 24 12C24 5.4 18.6 0 12 0Z"
                    fill="#1d1d1f"
                  />
                  <circle cx="12" cy="11" r="4" fill="white" />
                </svg>
              </div>
            </Marker>
          </Map>
        </div>
      )}
    </div>
  );
}
