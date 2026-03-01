export default function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-8 w-8" };

  return (
    <div
      className={`${dims[size]} animate-spin rounded-full border-[1.5px] border-[#e5e5ea] border-t-[#1d1d1f]`}
    />
  );
}
