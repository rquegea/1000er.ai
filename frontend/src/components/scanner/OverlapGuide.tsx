"use client";

interface OverlapGuideProps {
  imageUrl: string;
}

export default function OverlapGuide({ imageUrl }: OverlapGuideProps) {
  return (
    <div className="absolute left-0 top-0 z-20 h-full w-1/4 pointer-events-none">
      <div className="relative h-full w-full">
        {/* Previous photo right edge */}
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover opacity-40"
          style={{ objectPosition: "right center" }}
        />
        {/* Dashed border on right edge */}
        <div className="absolute right-0 top-0 h-full w-px border-r border-dashed border-white/50" />
        {/* Label */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="rounded-full bg-black/50 px-2 py-1 text-[11px] font-light text-white/60 backdrop-blur-sm">
            Solapa esta zona
          </span>
        </div>
      </div>
    </div>
  );
}
