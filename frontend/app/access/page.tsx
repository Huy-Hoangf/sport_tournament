"use client";

import type { FormEvent } from "react";
import Link from "next/link";

export default function AccessPage() {
  function handleAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    alert("Xác nhận cấp quyền giả lập, chưa có backend.");
  }

  return (
    <main className="auth-page flex min-h-screen items-center justify-center px-5">
      <section className="w-full max-w-[560px] text-center">
        <form
          onSubmit={handleAccess}
          className="rounded-lg border border-[#8ed8ec33] bg-[#111a1acc] px-12 py-14 shadow-[0_0_70px_rgba(75,190,210,0.16)] backdrop-blur"
        >
          <h1 className="text-4xl font-black text-[#9ddff2] drop-shadow-[0_0_8px_rgba(142,216,236,0.45)]">
            Cấp Quyền Truy Cập
          </h1>

          <p className="mt-4 text-lg font-semibold text-zinc-400">
            Nhập email để kích hoạt tài khoản
          </p>

          <input
            type="email"
            placeholder="name@corp.com"
            className="mt-14 h-[92px] w-full border border-white/10 bg-[#080f0f] px-6 text-center text-xl text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-[#8ed8ec88]"
          />

          <button
            type="submit"
            className="mt-8 h-[90px] w-full rounded bg-[#8ed8ec] text-[19px] font-black uppercase tracking-[0.42em] text-[#061112] shadow-[0_0_24px_rgba(142,216,236,0.35)] transition hover:bg-[#a4e7f5]"
          >
            Xác nhận cấp quyền
          </button>
        </form>

        <Link
          href="/login"
          className="mt-10 inline-block text-sm font-bold uppercase tracking-[0.28em] text-zinc-400 hover:text-[#8ed8ec]"
        >
          Admin Portal
        </Link>
      </section>
    </main>
  );
}