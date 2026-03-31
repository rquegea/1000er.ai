"use client";

import { useRef, useState, useEffect } from "react";

interface UseCameraStreamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  error: string | null;
}

/**
 * Hook that manages a live camera stream.
 *
 * The stream starts automatically when the component mounts
 * and the videoRef is attached to a <video> element.
 *
 * IMPORTANT for iOS Safari:
 * - The <video> element MUST have: autoPlay, playsInline, muted
 * - Never call video.pause() on the stream
 * - After drawing to canvas, call video.play() to resume
 */
export function useCameraStream(): UseCameraStreamReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      const constraints: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        },
        { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;

      for (const c of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch {
          // try next
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (!stream) {
        setError("Camara no disponible. Permite el acceso en tu navegador.");
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      // Assign stream to video element
      video.srcObject = stream;

      // Wait for video to be ready, then play
      try {
        await video.play();
        if (!cancelled) setIsReady(true);
      } catch {
        // On iOS, play() might need user gesture — try on loadedmetadata
        const onMeta = async () => {
          try {
            await video.play();
            if (!cancelled) setIsReady(true);
          } catch {
            if (!cancelled) setIsReady(true); // still mark ready, autoPlay might handle it
          }
          video.removeEventListener("loadedmetadata", onMeta);
        };
        video.addEventListener("loadedmetadata", onMeta);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  return { videoRef, isReady, error };
}
