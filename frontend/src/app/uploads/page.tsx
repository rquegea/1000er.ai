"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadAndAnalyze } from "@/lib/api";
import Spinner from "@/components/Spinner";

export default function UploadsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Solo se permiten archivos de imagen");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await uploadAndAnalyze(file);
      router.push(`/analysis/${result.analysis.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar");
      setLoading(false);
    }
  };

  const clearSelection = () => {
    setFile(null);
    setPreview(null);
    setError(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center pt-12">
        <div className="animate-fade-up flex flex-col items-center gap-5">
          <Spinner size="lg" />
          <div className="text-center">
            <p className="text-[15px] font-medium text-[#1d1d1f]">
              Analizando imagen...
            </p>
            <p className="mt-1 text-[13px] text-[#86868b]">
              Esto puede tardar unos segundos
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Preview state
  if (preview) {
    return (
      <div className="mx-auto max-w-2xl px-6 pt-24 pb-16">
        <div className="animate-fade-up">
          <div className="overflow-hidden rounded-2xl bg-[#f5f5f7]">
            <img
              src={preview}
              alt="Preview"
              className="w-full object-contain"
              style={{ maxHeight: "420px" }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[13px] text-[#86868b]">
              {file?.name}
              <span className="ml-2">
                {file ? (file.size / 1024 / 1024).toFixed(1) : 0} MB
              </span>
            </p>
            <button
              onClick={clearSelection}
              className="text-[13px] text-[#86868b] transition-colors duration-200 hover:text-[#1d1d1f]"
            >
              Cambiar
            </button>
          </div>

          <button
            onClick={handleAnalyze}
            className="mt-6 w-full rounded-full bg-[#1d1d1f] px-8 py-3.5 text-[15px] font-medium text-white transition-all duration-300 hover:bg-[#000000] hover:shadow-lg active:scale-[0.98]"
          >
            Analizar Lineal
          </button>
        </div>
      </div>
    );
  }

  // Hero + upload state
  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center px-6 pt-12">
      <div className="animate-fade-up w-full max-w-lg text-center">
        <h1 className="text-[40px] font-semibold leading-[1.1] tracking-tight text-[#1d1d1f] sm:text-[56px]">
          Shelf
          <br />
          Intelligence.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-[17px] leading-relaxed text-[#86868b]">
          Sube una foto de un lineal y detectaremos cada producto, facing, precio
          y fuera de stock.
        </p>

        {/* Primary CTA */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-10 inline-flex rounded-full bg-[#1d1d1f] px-8 py-3.5 text-[15px] font-medium text-white transition-all duration-300 hover:bg-[#000000] hover:shadow-lg active:scale-[0.98]"
        >
          Analizar Lineal
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {/* Secondary: camera */}
        <div className="mt-3">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="text-[15px] font-medium text-[#0066cc] transition-colors duration-200 hover:text-[#004499]"
          >
            Capturar con cámara
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`mx-auto mt-16 max-w-sm rounded-2xl border border-dashed p-10 transition-all duration-300 ${
            dragging
              ? "border-[#0066cc]/40 bg-[#0066cc]/[0.02]"
              : "border-[#d2d2d7] hover:border-[#86868b]"
          }`}
        >
          <p className="text-[13px] text-[#86868b]">
            o arrastra una imagen aquí
          </p>
          <p className="mt-1 text-[11px] text-[#d2d2d7]">
            JPG, PNG, WebP
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-6 text-[13px] text-[#ff3b30]">{error}</p>
        )}
      </div>
    </div>
  );
}
