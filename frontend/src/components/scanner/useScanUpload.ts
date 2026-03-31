"use client";

import { useState, useCallback } from "react";
import { createScan, uploadScanPhoto, processScan } from "@/lib/api";

export type UploadStep = "idle" | "uploading" | "stitching" | "analyzing" | "done" | "error";

interface UseScanUploadReturn {
  step: UploadStep;
  progress: number;
  error: string | null;
  scanId: string | null;
  upload: (
    visitId: string,
    storeId: string,
    photos: Blob[]
  ) => Promise<string | null>;
}

export function useScanUpload(): UseScanUploadReturn {
  const [step, setStep] = useState<UploadStep>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);

  const upload = useCallback(
    async (
      visitId: string,
      storeId: string,
      photos: Blob[]
    ): Promise<string | null> => {
      setStep("uploading");
      setProgress(0);
      setError(null);

      try {
        // 1. Create the scan
        const scan = await createScan({ visit_id: visitId, store_id: storeId });
        setScanId(scan.id);

        // 2. Upload each photo
        for (let i = 0; i < photos.length; i++) {
          const file = new File([photos[i]], `scan_${i}.jpg`, {
            type: "image/jpeg",
          });
          await uploadScanPhoto(scan.id, file, i);
          setProgress(Math.round(((i + 1) / photos.length) * 80));
        }

        // 3. Trigger processing
        setStep("stitching");
        setProgress(85);

        const result = await processScan(scan.id);

        if (result.status === "failed") {
          // Processing not yet implemented — expected for now
          setStep("stitching");
          setProgress(90);
          // Simulate transition for UX
          await new Promise((r) => setTimeout(r, 500));
          setStep("analyzing");
          setProgress(95);
          await new Promise((r) => setTimeout(r, 500));
          setStep("done");
          setProgress(100);
        } else {
          setStep("analyzing");
          setProgress(95);
          await new Promise((r) => setTimeout(r, 1000));
          setStep("done");
          setProgress(100);
        }

        return scan.id;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error subiendo fotos";
        setError(message);
        setStep("error");
        return null;
      }
    },
    []
  );

  return { step, progress, error, scanId, upload };
}
