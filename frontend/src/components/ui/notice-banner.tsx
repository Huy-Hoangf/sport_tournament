"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type NoticeTone = "info" | "success" | "warning" | "error";

export type Notice = {
  message: string;
  tone?: NoticeTone;
};

type NoticeBannerProps = {
  notice: Notice | null;
  onClose: () => void;
};

export default function NoticeBanner({ notice, onClose }: NoticeBannerProps) {
  if (!notice) {
    return null;
  }

  const tone = notice.tone ?? "info";
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "warning"
        ? AlertTriangle
        : tone === "error"
          ? XCircle
          : Info;
  const toneClass =
    tone === "success"
      ? "border-emerald-300/40 bg-emerald-950/90 text-emerald-100"
      : tone === "warning"
        ? "border-[#f4c95d80] bg-[#302713]/95 text-[#ffe8a3]"
      : tone === "error"
        ? "border-[#ff6b6b80] bg-[#35171b]/95 text-[#ffd4d4]"
        : "border-[#84d8e866] bg-[#0f2529]/95 text-[#d7f7ff]";

  return (
    <div className="fixed left-1/2 top-5 z-[100] w-[min(560px,calc(100vw-32px))] -translate-x-1/2">
      <div
        className={`flex items-start gap-3 rounded border px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur ${toneClass}`}
      >
        <Icon className="mt-0.5 shrink-0" size={20} />
        <p className="min-w-0 flex-1 whitespace-pre-line text-sm font-bold leading-6">
          {notice.message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-1 opacity-75 transition hover:bg-white/10 hover:opacity-100"
          aria-label="Close notification"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
