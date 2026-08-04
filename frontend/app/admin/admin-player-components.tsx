"use client";

import type React from "react";
import { ChevronDown } from "lucide-react";

export type PlayerStatus = "ACTIVE" | "INACTIVE" | "PENDING";
export type StatusFilter = "ALL" | PlayerStatus;

// Shared admin player UI primitives stay presentation-only so page.tsx can focus on state and API workflows.
export function MenuItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[49px] w-full items-center gap-4 px-6 text-left tracking-[0.03em] ${
        active
          ? "border-l-4 border-[#e9feff] bg-[#263b43] text-white"
          : "text-[#d7e4e8]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function StatCard({
  title,
  value,
  detail,
  icon,
  meter,
}: {
  title: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
  meter?: boolean;
}) {
  return (
    <div className="min-h-[144px] rounded border border-[#3a4d54] bg-[#0d252d] px-6 py-6 shadow-[0_2px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.1em] text-[#c8d6db]">
            {title}
          </h3>
          <p className="mt-2 text-[36px] font-black leading-none text-white">
            {value}
          </p>
        </div>
        <div className="flex h-[54px] w-[49px] items-center justify-center rounded bg-[#213740] text-white">
          {icon}
        </div>
      </div>

      {meter ? (
        <div className="mt-6 h-[4px] w-[118px] rounded bg-[#203940]">
          <div className="h-full w-[62px] rounded bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
        </div>
      ) : (
        <p className="mt-4 text-xs font-bold text-white">{detail}</p>
      )}
    </div>
  );
}

export function StatusFilterSelect({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}) {
  return (
    <label className="relative flex h-[38px] w-full max-w-[244px] items-center rounded border border-[#3a4d54] bg-[#0d252d] px-4 text-sm font-black uppercase tracking-[0.08em] text-[#dce8eb]">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as StatusFilter)}
        className="h-full w-full appearance-none bg-transparent pr-8 font-black uppercase tracking-[0.08em] text-[#dce8eb] outline-none"
      >
        <option className="bg-[#0d252d] text-white" value="ALL">
          Status: All
        </option>
        <option className="bg-[#0d252d] text-white" value="ACTIVE">
          Status: Active
        </option>
        <option className="bg-[#0d252d] text-white" value="INACTIVE">
          Status: Inactive
        </option>
        <option className="bg-[#0d252d] text-white" value="PENDING">
          Status: Pending
        </option>
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-4 text-[#dce8eb]"
      />
    </label>
  );
}

export function StatusBadge({ status }: { status: PlayerStatus }) {
  const className =
    status === "ACTIVE"
      ? "border-l-2 border-white bg-[#162b32] text-white"
      : status === "INACTIVE"
        ? "border-l-2 border-[#ff6b6b] bg-[#35171b] text-[#ffb0b0]"
        : "border-l-2 border-[#f4c95d] bg-[#302713] text-[#ffe8a3]";

  return (
    <span
      className={`inline-flex h-[27px] items-center px-3 text-xs font-black uppercase ${className}`}
    >
      {status}
    </span>
  );
}

export function PageButton({
  children,
  active,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[32px] min-w-[32px] items-center justify-center border border-[#3a4d54] text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-[#a2ecf5] text-[#06161b]" : "bg-[#0d252d] text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  children,
  tone = "normal",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "normal" | "danger";
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div
        className={`w-full max-w-[520px] rounded-lg border bg-[#101818] p-5 sm:p-7 ${
          tone === "danger"
            ? "border-[#ff6b6b66] shadow-[0_0_50px_rgba(255,107,107,0.12)]"
            : "border-[#84d8e855] shadow-[0_0_50px_rgba(132,216,232,0.18)]"
        }`}
      >
        <h2
          className={`mb-6 text-2xl font-black ${
            tone === "danger" ? "text-[#ff6b6b]" : "text-[#84d8e8]"
          }`}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function ModalActions({
  cancel,
  confirm,
  confirmText,
  disabled,
  danger = false,
}: {
  cancel: () => void;
  confirm: () => void;
  confirmText: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={cancel}
        className="h-[46px] rounded border border-white/10 px-5 text-zinc-300"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={confirm}
        disabled={disabled}
        className={`h-[46px] rounded px-5 font-black disabled:opacity-60 ${
          danger
            ? "border border-[#ff8a8a] bg-[#d94747] text-white transition hover:bg-[#ef5757]"
            : "bg-[#84d8e8] text-[#102026] transition hover:bg-[#a5e9f3]"
        }`}
      >
        {confirmText}
      </button>
    </div>
  );
}