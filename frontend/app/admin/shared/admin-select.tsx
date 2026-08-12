"use client";

import type React from "react";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AdminSelectOption = {
  value: string;
  label: string;
};

export function AdminSelect({
  value,
  options,
  onChange,
  ariaLabel,
  icon,
  size = "default",
  className = "",
  disabled = false,
}: {
  value: string;
  options: AdminSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  icon?: React.ReactNode;
  size?: "default" | "compact";
  className?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? options[0]?.label;
  const buttonHeight = size === "compact" ? "h-9" : "h-12";
  const textSize = size === "compact" ? "text-xs" : "text-sm";
  const menuTop = size === "compact" ? "top-[42px]" : "top-[54px]";
  const isDropdownOpen = isOpen && !disabled;

  useEffect(() => {
    function closeDropdown(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeDropdown);

    return () => {
      document.removeEventListener("mousedown", closeDropdown);
    };
  }, []);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen((open) => !open);
          }
        }}
        disabled={disabled}
        className={`flex ${buttonHeight} w-full items-center gap-3 rounded-sm border bg-[#0d252d] px-4 text-left ${textSize} font-black uppercase tracking-[0.08em] text-[#dce8eb] transition ${
          disabled
            ? "cursor-not-allowed border-[#243c43] opacity-60"
          : isDropdownOpen
            ? "border-[#84d8e8] shadow-[0_0_0_1px_#84d8e8]"
            : "border-[#3a4d54] hover:border-[#84d8e8]"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen}
        aria-label={ariaLabel}
      >
        {icon && <span className="shrink-0 text-[#84d8e8]">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#dce8eb] transition ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isDropdownOpen && (
        <div
          role="listbox"
          className={`absolute left-0 ${menuTop} z-40 w-full rounded-sm border border-[#84d8e8] bg-[#0d252d] p-1 shadow-[0_12px_28px_rgba(0,0,0,0.35)]`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`flex h-9 w-full items-center rounded-sm px-3 text-left ${textSize} font-black uppercase tracking-[0.08em] transition ${
                option.value === value
                  ? "bg-[#6f7778] text-white"
                  : "text-white hover:bg-[#14272e] hover:text-[#84d8e8]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
