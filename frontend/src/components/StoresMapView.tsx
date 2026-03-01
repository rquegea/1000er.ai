"use client";

import { useRef, useMemo } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Store } from "@/types";
import ChainLogo from "@/components/ChainLogo";
import { useState } from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface StoresMapViewProps {
  stores: Store[];
}

export default function StoresMapView({ stores }: StoresMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  const mappableStores = useMemo(
    () => stores.filter((s) => s.latitude !== null && s.longitude !== null),
    [stores]
  );

  const center = useMemo(() => {
    if (mappableStores.length === 0) return { latitude: 40.4168, longitude: -3.7038 };
    return {
      latitude:
        mappableStores.reduce((sum, s) => sum + s.latitude!, 0) / mappableStores.length,
      longitude:
        mappableStores.reduce((sum, s) => sum + s.longitude!, 0) / mappableStores.length,
    };
  }, [mappableStores]);

  const storesWithoutLocation = stores.length - mappableStores.length;

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-2xl bg-[#fafafa]">
        <div className="text-center">
          <p className="text-[13px] text-[#86868b]">Token de Mapbox no configurado</p>
          <p className="mt-1 text-[11px] text-[#c7c7cc]">
            Añade NEXT_PUBLIC_MAPBOX_TOKEN en .env.local
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="overflow-hidden rounded-2xl border border-[#e5e5ea]">
        <Map
          ref={mapRef}
          initialViewState={{
            ...center,
            zoom: mappableStores.length > 0 ? 6 : 5,
          }}
          style={{ width: "100%", height: 500 }}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
        >
          <NavigationControl position="top-right" />

          {mappableStores.map((store) => (
            <Marker
              key={store.id}
              latitude={store.latitude!}
              longitude={store.longitude!}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedStore(store);
              }}
            >
              <div
                className="flex cursor-pointer items-center justify-center rounded-full bg-white shadow-lg shadow-black/10 border border-[#e5e5ea] transition-transform hover:scale-110"
                style={{ width: 36, height: 36 }}
              >
                {store.chain ? (
                  <ChainLogo chain={store.chain} size={24} className="rounded-full" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1d1d1f]">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M6 1C4 1 2.5 2.5 2.5 4.5C2.5 7.5 6 11 6 11S9.5 7.5 9.5 4.5C9.5 2.5 8 1 6 1Z"
                        fill="white"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </Marker>
          ))}

          {selectedStore && selectedStore.latitude && selectedStore.longitude && (
            <Popup
              latitude={selectedStore.latitude}
              longitude={selectedStore.longitude}
              anchor="bottom"
              offset={22}
              closeOnClick={false}
              onClose={() => setSelectedStore(null)}
              className="store-popup"
            >
              <div style={{ fontFamily: "system-ui", fontSize: 13, padding: "2px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {selectedStore.chain && (
                    <ChainLogo chain={selectedStore.chain} size={18} className="rounded-sm" />
                  )}
                  <p style={{ fontWeight: 600, color: "#1d1d1f", margin: 0 }}>
                    {selectedStore.name}
                  </p>
                </div>
                {selectedStore.chain && (
                  <p style={{ color: "#86868b", margin: "2px 0 0", fontSize: 12 }}>
                    {selectedStore.chain}
                  </p>
                )}
                {selectedStore.address && (
                  <p style={{ color: "#86868b", margin: "2px 0 0", fontSize: 12 }}>
                    {selectedStore.address}
                  </p>
                )}
              </div>
            </Popup>
          )}
        </Map>
      </div>

      {storesWithoutLocation > 0 && (
        <p className="mt-3 text-[12px] text-[#86868b]">
          {storesWithoutLocation}{" "}
          {storesWithoutLocation === 1 ? "tienda sin" : "tiendas sin"}{" "}
          ubicacion (edita la tienda y añade una direccion para mostrarla en el mapa)
        </p>
      )}
    </div>
  );
}
