"use client";

import { useState } from "react";
import { getChainFavicon } from "@/lib/favicon";

interface ChainLogoProps {
  chain: string;
  size?: number;
  className?: string;
}

export default function ChainLogo({ chain, size = 24, className = "" }: ChainLogoProps) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = getChainFavicon(chain);

  if (!faviconUrl || failed) {
    const letter = chain ? chain.charAt(0).toUpperCase() : "?";
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-md bg-[#f5f5f7] font-semibold text-[#86868b] ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.45,
          lineHeight: 1,
        }}
      >
        {letter}
      </div>
    );
  }

  return (
    <img
      src={faviconUrl}
      alt={chain}
      width={size}
      height={size}
      className={`shrink-0 rounded-md ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
