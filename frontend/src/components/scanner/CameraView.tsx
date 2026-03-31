"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { X, Camera } from "lucide-react";
import { useCameraStream } from "./useCameraStream";
import CaptureButton from "./CaptureButton";
import OverlapGuide from "./OverlapGuide";

interface CapturedPhoto {
  blob: Blob;
  thumbnailUrl: string;
  index: number;
}

interface CameraViewProps {
  photos: CapturedPhoto[];
  overlapStrip: string | null;
  onCapture: (blob: Blob) => void;
  onFinish: () => void;
  onCancel: () => void;
}

export default function CameraView({
  photos,
  overlapStrip,
  onCapture,
  onFinish,
  onCancel,
}: CameraViewProps) {
  const { videoRef, isReady, error } = useCameraStream();
  const [instruction, setInstruction] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  const useFallback = !!error;

  // Show contextual instructions
  useEffect(() => {
    if (!isReady && !useFallback) return;
    const msg =
      photos.length === 0
        ? "Empieza por el extremo izquierdo"
        : "Muevete a la derecha";
    setInstruction(msg);
    const timer = setTimeout(
      () => setInstruction(null),
      photos.length === 0 ? 2000 : 1500
    );
    return () => clearTimeout(timer);
  }, [photos.length, isReady, useFallback]);

  // Stream capture — grabs one frame from live video, then ensures video keeps playing
  const handleStreamCapture = useCallback(() => {
    if (isCapturing) return;
    const video = videoRef.current;
    if (!video) return;

    setIsCapturing(true);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsCapturing(false);
      return;
    }

    // Draw current frame
    ctx.drawImage(video, 0, 0);

    // CRITICAL: ensure video keeps streaming after canvas draw (iOS Safari can pause)
    video.play().catch(() => {});

    canvas.toBlob(
      (blob) => {
        if (blob) onCaptureRef.current(blob);
        setIsCapturing(false);

        // Double-ensure video is still playing after blob callback
        video.play().catch(() => {});
      },
      "image/jpeg",
      0.85
    );
  }, [isCapturing, videoRef]);

  // Fallback: native file input
  const handleFileCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      Array.from(files).forEach((file) => {
        onCaptureRef.current(file);
      });
      e.target.value = "";
    },
    []
  );

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // ── Shared UI ──────────────────────────────

  const topBar = (
    <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-4">
      <button
        onClick={onCancel}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm"
        aria-label="Cancelar"
      >
        <X className="h-4 w-4 text-white" />
      </button>
      <span className="text-[14px] font-light text-white/70">
        Foto {photos.length + 1}
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: Math.max(photos.length + 1, 2) }).map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${
              i < photos.length ? "bg-[#10B981]" : "bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );

  const bottomBar = (onCapturePress: () => void) => (
    <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-6 pb-8 pt-12">
      <div className="w-24">
        {photos.length >= 2 && (
          <button
            onClick={onFinish}
            className="rounded-full border border-white/40 px-4 py-2 text-[13px] font-light text-white/80 transition-colors hover:bg-white/10"
          >
            Terminar
          </button>
        )}
      </div>
      <CaptureButton
        onCapture={onCapturePress}
        disabled={isCapturing || photos.length >= 8}
      />
      <div className="flex w-24 justify-end">
        {photos.length > 0 && (
          <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-white/40">
            <img
              src={photos[photos.length - 1].thumbnailUrl}
              alt={`Foto ${photos.length}`}
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );

  const instructionOverlay = instruction && (
    <div className="absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 text-center animate-fade-in">
      <span className="rounded-full bg-black/50 px-5 py-2 text-[15px] font-light text-white/80 backdrop-blur-sm">
        {instruction}
      </span>
    </div>
  );

  // ── FALLBACK MODE ─────────────────────────

  if (useFallback) {
    return (
      <div className="relative flex h-full w-full flex-col bg-black">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileCapture}
        />
        {topBar}
        <div className="flex flex-1 items-center justify-center">
          {photos.length > 0 ? (
            <div className="relative h-full w-full">
              <img
                src={photos[photos.length - 1].thumbnailUrl}
                alt={`Foto ${photos.length}`}
                className="h-full w-full object-contain opacity-60"
              />
              {overlapStrip && (
                <div className="absolute inset-y-0 left-0 w-1/4">
                  <OverlapGuide imageUrl={overlapStrip} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Camera className="h-10 w-10 text-white/20" />
              <p className="text-[14px] font-light text-white/40">
                Pulsa el boton para hacer una foto
              </p>
            </div>
          )}
        </div>
        {instructionOverlay}
        {bottomBar(triggerFileInput)}
      </div>
    );
  }

  // ── STREAM MODE ───────────────────────────

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {topBar}

      {/* Viewfinder corners */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-x-[8%] inset-y-[12%] bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
        <svg className="absolute inset-x-[8%] inset-y-[12%] h-[76%] w-[84%]">
          <path d="M 0 24 L 0 0 L 24 0" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
          <line x1="100%" y1="0" x2="calc(100% - 24)" y2="0" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
          <line x1="100%" y1="0" x2="100%" y2="24" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
          <line x1="0" y1="100%" x2="24" y2="100%" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
          <line x1="0" y1="100%" x2="0" y2="calc(100% - 24)" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
          <line x1="100%" y1="100%" x2="calc(100% - 24)" y2="100%" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
          <line x1="100%" y1="100%" x2="100%" y2="calc(100% - 24)" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
        </svg>
      </div>

      {overlapStrip && (
        <div className="absolute inset-x-[8%] inset-y-[12%] z-20">
          <OverlapGuide imageUrl={overlapStrip} />
        </div>
      )}

      {instructionOverlay}
      {bottomBar(handleStreamCapture)}

      {isCapturing && (
        <div className="pointer-events-none absolute inset-0 z-50 animate-pulse bg-white/20" />
      )}
    </div>
  );
}
