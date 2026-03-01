"use client";

import { useState, useRef, useEffect } from "react";

interface CreatableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export default function CreatableSelect({
  value,
  onChange,
  options,
  placeholder,
}: CreatableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sync search field with external value
  useEffect(() => {
    if (!open) setSearch(value);
  }, [value, open]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );
  const exactMatch = options.some(
    (o) => o.toLowerCase() === search.trim().toLowerCase()
  );

  const select = (val: string) => {
    onChange(val);
    setSearch(val);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={open ? search : value}
        placeholder={placeholder}
        onFocus={() => {
          setSearch(value);
          setOpen(true);
        }}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
      />

      {open && (filtered.length > 0 || (search.trim() && !exactMatch)) && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-[#d2d2d7] bg-white py-1 shadow-lg">
          {filtered.map((opt) => (
            <li
              key={opt}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(opt)}
              className={`cursor-pointer px-3 py-2 text-[14px] transition-colors hover:bg-[#f5f5f7] ${
                opt === value ? "font-medium text-[#0066cc]" : "text-[#1d1d1f]"
              }`}
            >
              {opt}
            </li>
          ))}
          {search.trim() && !exactMatch && (
            <li
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(search.trim())}
              className="cursor-pointer border-t border-[#f5f5f7] px-3 py-2 text-[14px] text-[#0066cc] transition-colors hover:bg-[#f5f5f7]"
            >
              Crear &ldquo;{search.trim()}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
