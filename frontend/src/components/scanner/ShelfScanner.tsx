"use client";

import { useState, useCallback } from "react";
import { ScanLine } from "lucide-react";
import CameraView from "./CameraView";
import ScanReview from "./ScanReview";
import ScanProgress from "./ScanProgress";
import { useScanUpload } from "./useScanUpload";

interface CapturedPhoto {
  blob: Blob;
  thumbnailUrl: string;
  index: number;
}

interface ShelfScannerProps {
  visitId: string;
  storeId: string;
  onComplete?: (scanId: string) => void;
  onCancel?: () => void;
}

type Phase = "intro" | "capture" | "review" | "uploading";

export default function ShelfScanner({
  visitId,
  storeId,
  onComplete,
  onCancel,
}: ShelfScannerProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [overlapStrip, setOverlapStrip] = useState<string | null>(null);
  const { step, progress, error, upload } = useScanUpload();

  const generateOverlapStrip = useCallback((blob: Blob): string => {
    // Create a canvas showing the right 25% of the captured photo
    const url = URL.createObjectURL(blob);
    // For the overlap guide, we pass the full image URL and use CSS object-position
    // to show only the right portion
    return url;
  }, []);

  const handleCapture = useCallback(
    (blob: Blob) => {
      const thumbnailUrl = URL.createObjectURL(blob);
      const newPhoto: CapturedPhoto = {
        blob,
        thumbnailUrl,
        index: photos.length,
      };
      const updated = [...photos, newPhoto];
      setPhotos(updated);

      // Generate overlap strip from this photo's right 25%
      setOverlapStrip(generateOverlapStrip(blob));

      // Auto-finish at 8 photos
      if (updated.length >= 8) {
        setPhase("review");
      }
    },
    [photos, generateOverlapStrip]
  );

  const handleDelete = useCallback(
    (index: number) => {
      const updated = photos.filter((_, i) => i !== index).map((p, i) => ({
        ...p,
        index: i,
      }));
      setPhotos(updated);

      // Update overlap strip
      if (updated.length > 0) {
        setOverlapStrip(generateOverlapStrip(updated[updated.length - 1].blob));
      } else {
        setOverlapStrip(null);
      }
    },
    [photos, generateOverlapStrip]
  );

  const handleAnalyze = useCallback(async () => {
    setPhase("uploading");
    const blobs = photos.map((p) => p.blob);
    const scanId = await upload(visitId, storeId, blobs);
    if (scanId && onComplete) {
      onComplete(scanId);
    }
  }, [photos, upload, visitId, storeId, onComplete]);

  const handleCancel = useCallback(() => {
    // Clean up object URLs
    photos.forEach((p) => URL.revokeObjectURL(p.thumbnailUrl));
    if (overlapStrip) URL.revokeObjectURL(overlapStrip);
    onCancel?.();
  }, [photos, overlapStrip, onCancel]);

  // ── INTRO ─────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-black px-6">
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          {/* Shelf icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
            <ScanLine className="h-7 w-7 text-white/60" />
          </div>

          <h1 className="text-[16px] font-medium text-white">
            Escanear lineal
          </h1>
          <p className="text-[14px] font-light text-white/50">
            Haz fotos de izquierda a derecha
          </p>

          <button
            onClick={() => setPhase("capture")}
            className="mt-4 rounded-full bg-[#10B981] px-8 py-3 text-[15px] font-medium text-white transition-all hover:bg-[#0ea573] active:scale-[0.98]"
          >
            Comenzar
          </button>
        </div>

        <p className="absolute bottom-8 text-[12px] font-light text-white/25">
          Esc para cancelar
        </p>
      </div>
    );
  }

  // ── CAPTURE ───────────────────────────────
  if (phase === "capture") {
    return (
      <CameraView
        photos={photos}
        overlapStrip={overlapStrip}
        onCapture={handleCapture}
        onFinish={() => setPhase("review")}
        onCancel={handleCancel}
      />
    );
  }

  // ── REVIEW ────────────────────────────────
  if (phase === "review") {
    return (
      <ScanReview
        photos={photos}
        onDelete={handleDelete}
        onAddMore={() => setPhase("capture")}
        onAnalyze={handleAnalyze}
      />
    );
  }

  // ── UPLOADING / PROCESSING ────────────────
  return (
    <ScanProgress
      photos={photos}
      step={step}
      progress={progress}
      error={error}
      onRetry={handleAnalyze}
    />
  );
}
