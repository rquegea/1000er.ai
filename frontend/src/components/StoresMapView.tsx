"use client";

import { useEffect, useState } from "react";
import type { Store } from "@/types";

interface StoresMapViewProps {
  stores: Store[];
}

export default function StoresMapView({ stores }: StoresMapViewProps) {
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

  if (!MapComponents || !leafletIcon) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-2xl bg-[#fafafa]">
        <p className="text-[13px] text-[#86868b]">Cargando mapa...</p>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = MapComponents;

  // Filter stores that have coordinates
  const mappableStores = stores.filter(
    (s) => s.latitude !== null && s.longitude !== null
  );

  // Calculate center from stores or default to Madrid
  const center: [number, number] =
    mappableStores.length > 0
      ? [
          mappableStores.reduce((sum, s) => sum + s.latitude!, 0) /
            mappableStores.length,
          mappableStores.reduce((sum, s) => sum + s.longitude!, 0) /
            mappableStores.length,
        ]
      : [40.4168, -3.7038];

  const storesWithoutLocation = stores.length - mappableStores.length;

  return (
    <div className="animate-fade-in">
      <div className="overflow-hidden rounded-2xl border border-[#e5e5ea]">
        <MapContainer
          center={center}
          zoom={mappableStores.length > 0 ? 6 : 5}
          style={{ height: 500, width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {mappableStores.map((store) => (
            <Marker
              key={store.id}
              position={[store.latitude!, store.longitude!]}
              icon={leafletIcon}
            >
              <Popup>
                <div style={{ fontFamily: "system-ui", fontSize: 13 }}>
                  <p
                    style={{
                      fontWeight: 600,
                      color: "#1d1d1f",
                      margin: 0,
                    }}
                  >
                    {store.name}
                  </p>
                  {store.chain && (
                    <p
                      style={{
                        color: "#86868b",
                        margin: "2px 0 0",
                        fontSize: 12,
                      }}
                    >
                      {store.chain}
                    </p>
                  )}
                  {store.address && (
                    <p
                      style={{
                        color: "#86868b",
                        margin: "2px 0 0",
                        fontSize: 12,
                      }}
                    >
                      {store.address}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {storesWithoutLocation > 0 && (
        <p className="mt-3 text-[12px] text-[#86868b]">
          {storesWithoutLocation}{" "}
          {storesWithoutLocation === 1 ? "tienda sin" : "tiendas sin"}{" "}
          ubicación (edita la tienda y añade una dirección para mostrarla en
          el mapa)
        </p>
      )}
    </div>
  );
}
