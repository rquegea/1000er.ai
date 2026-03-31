"use client";

import { Check } from "lucide-react";
import type { UploadStep } from "./useScanUpload";

interface CapturedPhoto {
  blob: Blob;
  thumbnailUrl: string;
  index: number;
}

interface ScanProgressProps {
  photos: CapturedPhoto[];
  step: UploadStep;
  progress: number;
  error: string | null;
  onRetry?: () => void;
}

const STEPS: { key: UploadStep; label: string }[] = [
  { key: "uploading", label: "Subiendo fotos..." },
  { key: "stitching", label: "Generando panorama..." },
  { key: "analyzing", label: "Analizando productos..." },
  { key: "done", label: "Completado" },
];

function getStepIndex(step: UploadStep): number {
  const idx = STEPS.findIndex((s) => s.key === step);
  return idx >= 0 ? idx : 0;
}

export default function ScanProgress({
  photos,
  step,
  progress,
  error,
  onRetry,
}: ScanProgressProps) {
  const currentIdx = getStepIndex(step);

  return (
    <div className="flex h-full w-full flex-col bg-black">
      {/* Photo thumbnails reference */}
      <div className="flex gap-1 overflow-x-auto px-6 pt-12 pb-8">
        {photos.map((photo, i) => (
          <div
            key={i}
            className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg"
          >
            <img
              src={photo.thumbnailUrl}
              alt={`Foto ${i + 1}`}
              className="h-full w-full object-cover opacity-60"
            />
          </div>
        ))}
      </div>

      {/* Progress area */}
      <div className="flex flex-1 flex-col items-center justify-center px-8">
        {error ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-[15px] font-light text-red-400">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-full bg-white/10 px-6 py-2 text-[14px] text-white/70"
              >
                Reintentar
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="mb-10 w-full max-w-xs">
              <div className="h-[2px] w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#10B981] transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-4">
              {STEPS.map((s, i) => {
                const isDone = i < currentIdx || step === "done";
                const isCurrent = i === currentIdx && step !== "done";
                return (
                  <div
                    key={s.key}
                    className={`flex items-center gap-3 transition-opacity duration-300 ${
                      isDone || isCurrent ? "opacity-100" : "opacity-30"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4 text-[#10B981]" />
                    ) : (
                      <span
                        className={`h-4 w-4 rounded-full border ${
                          isCurrent
                            ? "border-[#10B981] bg-[#10B981]/20"
                            : "border-white/30"
                        }`}
                      />
                    )}
                    <span
                      className={`text-[14px] font-light ${
                        isDone
                          ? "text-white/50"
                          : isCurrent
                            ? "text-white"
                            : "text-white/30"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
