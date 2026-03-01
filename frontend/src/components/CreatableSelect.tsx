"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

interface CreatableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  /** Optional render function to show a prefix icon/image for each option */
  renderPrefix?: (value: string) => ReactNode;
}

export default function CreatableSelect({
  value,
  onChange,
  options,
  placeholder,
  renderPrefix,
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

  const displayValue = open ? search : value;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative mt-1">
        {/* Prefix icon for the input (shown when not open and value exists) */}
        {!open && value && renderPrefix && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            {renderPrefix(value)}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
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
          className={`w-full rounded-xl border border-[#d2d2d7] py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc] ${
            !open && value && renderPrefix ? "pl-10 pr-3" : "px-3"
          }`}
        />
      </div>

      {open && (filtered.length > 0 || (search.trim() && !exactMatch)) && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-[#d2d2d7] bg-white py-1 shadow-lg">
          {filtered.map((opt) => (
            <li
              key={opt}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(opt)}
              className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[14px] transition-colors hover:bg-[#f5f5f7] ${
                opt === value ? "font-medium text-[#0066cc]" : "text-[#1d1d1f]"
              }`}
            >
              {renderPrefix && renderPrefix(opt)}
              {opt}
            </li>
          ))}
          {search.trim() && !exactMatch && (
            <li
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(search.trim())}
              className="flex cursor-pointer items-center gap-2.5 border-t border-[#f5f5f7] px-3 py-2 text-[14px] text-[#0066cc] transition-colors hover:bg-[#f5f5f7]"
            >
              {renderPrefix && renderPrefix(search.trim())}
              Crear &ldquo;{search.trim()}&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
