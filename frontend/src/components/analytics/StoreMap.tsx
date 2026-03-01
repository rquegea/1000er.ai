"use client";

import { useEffect, useState } from "react";

interface Store {
  id: string;
  name: string;
  chain: string;
  lat: number;
  lng: number;
  brandShare: number;
  oosRate: number;
}

interface StoreMapProps {
  stores: Store[];
}

function getMarkerColor(store: Store): string {
  if (store.brandShare < 10 || store.oosRate > 5) return "#ff3b30";
  if (store.brandShare >= 10 && store.brandShare <= 20) return "#ff9500";
  return "#34c759";
}

export default function StoreMap({ stores }: StoreMapProps) {
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    CircleMarker: typeof import("react-leaflet").CircleMarker;
    Popup: typeof import("react-leaflet").Popup;
  } | null>(null);

  useEffect(() => {
    // @ts-expect-error -- CSS module imported at runtime for SSR safety
    import("leaflet/dist/leaflet.css");
    import("react-leaflet").then((mod) => {
      setMapComponents({
        MapContainer: mod.MapContainer,
        TileLayer: mod.TileLayer,
        CircleMarker: mod.CircleMarker,
        Popup: mod.Popup,
      });
    });
  }, []);

  if (!MapComponents) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-2xl bg-[#fafafa]">
        <p className="text-[13px] text-[#86868b]">Cargando mapa...</p>
      </div>
    );
  }

  const { MapContainer, TileLayer, CircleMarker, Popup } = MapComponents;

  return (
    <div className="animate-fade-in">
      <p className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
        Mapa de tiendas
      </p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#e5e5ea]">
        <MapContainer
          center={[40.4168, -3.7038]}
          zoom={12}
          style={{ height: 400, width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {stores.map((store) => {
            const color = getMarkerColor(store);
            return (
              <CircleMarker
                key={store.id}
                center={[store.lat, store.lng]}
                radius={10}
                pathOptions={{
                  fillColor: color,
                  color: "white",
                  weight: 2,
                  fillOpacity: 0.9,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: "system-ui", fontSize: 13 }}>
                    <p style={{ fontWeight: 600, color: "#1d1d1f", margin: 0 }}>
                      {store.name}
                    </p>
                    <p style={{ color: "#86868b", margin: "2px 0 8px", fontSize: 12 }}>
                      {store.chain}
                    </p>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#86868b", margin: 0 }}>
                          Brand Share
                        </p>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f", margin: 0 }}>
                          {store.brandShare}%
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "#86868b", margin: 0 }}>
                          OOS Rate
                        </p>
                        <p
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: store.oosRate > 5 ? "#ff3b30" : "#1d1d1f",
                            margin: 0,
                          }}
                        >
                          {store.oosRate}%
                        </p>
                      </div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#34c759]" />
          <span className="text-[11px] text-[#86868b]">&gt; 20%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#ff9500]" />
          <span className="text-[11px] text-[#86868b]">10-20%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#ff3b30]" />
          <span className="text-[11px] text-[#86868b]">&lt; 10% o OOS &gt; 5%</span>
        </div>
      </div>
    </div>
  );
}
