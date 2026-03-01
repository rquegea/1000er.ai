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

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900">
          Analizar Lineal
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sube una foto de un lineal de supermercado y la IA detectará todos los
          productos, facings, precios y fuera de stock.
        </p>

        {/* Loading overlay */}
        {loading && (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-12">
            <Spinner size="lg" />
            <p className="text-sm font-medium text-indigo-700">
              Analizando imagen con IA...
            </p>
            <p className="text-xs text-indigo-500">
              Esto puede tardar unos segundos
            </p>
          </div>
        )}

        {/* Drop zone — when no file selected and not loading */}
        {!preview && !loading && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-8 flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-colors ${
              dragging
                ? "border-indigo-400 bg-indigo-50"
                : "border-slate-300 bg-white hover:border-indigo-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
              <svg
                className="h-7 w-7 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">
                Arrastra una imagen aquí o{" "}
                <span className="text-indigo-600">haz clic para seleccionar</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                JPG, PNG o WebP — máx. 20 MB
              </p>
            </div>

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
          </div>
        )}

        {/* Camera button for mobile */}
        {!preview && !loading && (
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <svg
              className="h-5 w-5 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
              />
            </svg>
            Capturar foto con cámara
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
          </button>
        )}

        {/* Preview */}
        {preview && !loading && (
          <div className="mt-8">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img
                src={preview}
                alt="Preview del lineal"
                className="w-full object-contain"
                style={{ maxHeight: "400px" }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {file?.name} —{" "}
                {file ? (file.size / 1024 / 1024).toFixed(1) : 0} MB
              </p>
              <button
                onClick={clearSelection}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Cambiar imagen
              </button>
            </div>
            <button
              onClick={handleAnalyze}
              className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Analizar Lineal
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
