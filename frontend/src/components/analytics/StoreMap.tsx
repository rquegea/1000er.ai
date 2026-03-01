"use client";

import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useRef, useState } from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

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
  const mapRef = useRef<MapRef>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-2xl bg-[#fafafa]">
        <p className="text-[13px] text-[#86868b]">Token de Mapbox no configurado</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <p className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
        Mapa de tiendas
      </p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#e5e5ea]">
        <Map
          ref={mapRef}
          initialViewState={{
            latitude: 40.4168,
            longitude: -3.7038,
            zoom: 12,
          }}
          style={{ width: "100%", height: 400 }}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          scrollZoom={false}
        >
          <NavigationControl position="top-right" />

          {stores.map((store) => {
            const color = getMarkerColor(store);
            return (
              <Marker
                key={store.id}
                latitude={store.lat}
                longitude={store.lng}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedStore(store);
                }}
              >
                <div
                  className="cursor-pointer rounded-full border-2 border-white shadow-md"
                  style={{
                    width: 20,
                    height: 20,
                    backgroundColor: color,
                  }}
                />
              </Marker>
            );
          })}

          {selectedStore && (
            <Popup
              latitude={selectedStore.lat}
              longitude={selectedStore.lng}
              anchor="bottom"
              offset={14}
              closeOnClick={false}
              onClose={() => setSelectedStore(null)}
            >
              <div style={{ fontFamily: "system-ui", fontSize: 13 }}>
                <p style={{ fontWeight: 600, color: "#1d1d1f", margin: 0 }}>
                  {selectedStore.name}
                </p>
                <p style={{ color: "#86868b", margin: "2px 0 8px", fontSize: 12 }}>
                  {selectedStore.chain}
                </p>
                <div style={{ display: "flex", gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 11, color: "#86868b", margin: 0 }}>
                      Brand Share
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f", margin: 0 }}>
                      {selectedStore.brandShare}%
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
                        color: selectedStore.oosRate > 5 ? "#ff3b30" : "#1d1d1f",
                        margin: 0,
                      }}
                    >
                      {selectedStore.oosRate}%
                    </p>
                  </div>
                </div>
              </div>
            </Popup>
          )}
        </Map>
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
