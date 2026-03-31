"use client";

import { useState, useCallback } from "react";

interface CaptureButtonProps {
  onCapture: () => void;
  disabled?: boolean;
}

export default function CaptureButton({ onCapture, disabled }: CaptureButtonProps) {
  const [flashing, setFlashing] = useState(false);

  const handlePress = useCallback(() => {
    if (disabled || flashing) return;
    setFlashing(true);
    onCapture();
    setTimeout(() => setFlashing(false), 300);
  }, [onCapture, disabled, flashing]);

  return (
    <button
      onClick={handlePress}
      disabled={disabled}
      className="relative h-[70px] w-[70px] rounded-full border-[3px] border-white/90 bg-white/10 transition-all duration-200 active:scale-95 disabled:opacity-40"
      aria-label="Capturar foto"
    >
      <span
        className={`absolute inset-[4px] rounded-full transition-all duration-300 ${
          flashing ? "bg-white scale-100" : "bg-white/20 scale-90"
        }`}
      />
    </button>
  );
}
