"use client";

import { useState } from "react";
import { Trash2, Plus, ArrowRight } from "lucide-react";

interface CapturedPhoto {
  blob: Blob;
  thumbnailUrl: string;
  index: number;
}

interface ScanReviewProps {
  photos: CapturedPhoto[];
  onDelete: (index: number) => void;
  onAddMore: () => void;
  onAnalyze: () => void;
}

export default function ScanReview({
  photos,
  onDelete,
  onAddMore,
  onAnalyze,
}: ScanReviewProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex !== null ? photos[selectedIndex] : null;

  return (
    <div className="flex h-full w-full flex-col bg-black">
      {/* Fullscreen preview */}
      {selected !== null && selectedIndex !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSelectedIndex(null)}
              className="text-[14px] font-light text-white/70"
            >
              Cerrar
            </button>
            <span className="text-[14px] font-light text-white/50">
              Foto {selectedIndex + 1}
            </span>
            <button
              onClick={() => {
                onDelete(selectedIndex);
                setSelectedIndex(null);
              }}
              className="flex items-center gap-1 text-[14px] font-light text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-4">
            <img
              src={selected.thumbnailUrl}
              alt={`Foto ${selectedIndex + 1}`}
              className="max-h-full max-w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-center gap-2 px-6 pt-12 pb-6">
        <h2 className="text-[16px] font-medium text-white">Revisar scan</h2>
        <p className="text-[14px] font-light text-white/50">
          {photos.length} fotos &middot; 1 lineal
        </p>
      </div>

      {/* Photo strip */}
      <div className="flex-1 overflow-hidden px-4">
        <div className="flex h-48 gap-1 overflow-x-auto pb-4 snap-x snap-mandatory">
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className="relative h-full flex-shrink-0 snap-start overflow-hidden rounded-xl first:rounded-l-2xl last:rounded-r-2xl"
              style={{ width: `${Math.max(100 / photos.length, 20)}%`, minWidth: 80 }}
            >
              <img
                src={photo.thumbnailUrl}
                alt={`Foto ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white/80 backdrop-blur-sm">
                {i + 1}
              </span>
            </button>
          ))}
        </div>

        {photos.length < 2 && (
          <p className="mt-4 text-center text-[13px] font-light text-orange-400/80">
            Se necesitan al menos 2 fotos
          </p>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex gap-3 px-6 pb-8 pt-4">
        {photos.length < 8 && (
          <button
            onClick={onAddMore}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-[14px] font-light text-white/70 transition-colors hover:bg-white/5"
          >
            <Plus className="h-4 w-4" />
            Anadir mas
          </button>
        )}
        <button
          onClick={onAnalyze}
          disabled={photos.length < 2}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#10B981] py-3 text-[14px] font-medium text-white transition-all hover:bg-[#0ea573] active:scale-[0.98] disabled:opacity-40"
        >
          Analizar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
