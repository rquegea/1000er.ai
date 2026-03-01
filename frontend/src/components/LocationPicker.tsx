"use client";

import { useEffect, useState, useRef, useCallback } from "react";

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

  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
    Popup: typeof import("react-leaflet").Popup;
  } | null>(null);
  const [leafletIcon, setLeafletIcon] = useState<L.Icon | null>(null);

  useEffect(() => {
    // @ts-expect-error -- CSS module imported at runtime for SSR safety
    import("leaflet/dist/leaflet.css");
    Promise.all([import("react-leaflet"), import("leaflet")]).then(
      ([rl, L]) => {
        setMapComponents({
          MapContainer: rl.MapContainer,
          TileLayer: rl.TileLayer,
          Marker: rl.Marker,
          Popup: rl.Popup,
        });
        setLeafletIcon(
          new L.default.Icon({
            iconUrl:
              "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            iconRetinaUrl:
              "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
            shadowUrl:
              "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          })
        );
      }
    );
  }, []);

  const geocode = useCallback(
    async (query: string) => {
      if (!query || query.length < 5) return;
      setGeocoding(true);
      setGeocodeError(null);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
          {
            headers: { "Accept-Language": "es" },
          }
        );
        const data = await res.json();
        if (data.length > 0) {
          onLocationChange(parseFloat(data[0].lat), parseFloat(data[0].lon));
        } else {
          setGeocodeError("No se encontró la ubicación");
        }
      } catch {
        setGeocodeError("Error al buscar ubicación");
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
          <p className="text-[11px] text-[#86868b]">Buscando ubicación...</p>
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

      {hasLocation && MapComponents && leafletIcon && (
        <div className="mt-2 overflow-hidden rounded-xl border border-[#e5e5ea]">
          <MapComponents.MapContainer
            key={`${latitude}-${longitude}`}
            center={[latitude!, longitude!]}
            zoom={15}
            style={{ height: 180, width: "100%" }}
            scrollWheelZoom={false}
            dragging={false}
            zoomControl={false}
          >
            <MapComponents.TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <MapComponents.Marker
              position={[latitude!, longitude!]}
              icon={leafletIcon}
            >
              <MapComponents.Popup>
                <span style={{ fontSize: 12 }}>{address}</span>
              </MapComponents.Popup>
            </MapComponents.Marker>
          </MapComponents.MapContainer>
        </div>
      )}
    </div>
  );
}
