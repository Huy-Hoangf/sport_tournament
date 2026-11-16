import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page flex min-h-screen flex-col bg-[#0c1111] text-zinc-200">
      <header className="flex min-h-[90px] items-center justify-between gap-4 border-b border-white/10 px-5 sm:px-8">
        <h1 className="text-2xl font-black tracking-[-0.04em] text-[#84d8e8] sm:text-[30px]">
          TWENTY-TECH
        </h1>
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm font-bold text-zinc-200 underline-offset-4 hover:text-[#84d8e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#84d8e8]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Back to login
        </Link>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[560px] rounded-lg border border-[#3a4d54] bg-[#0d1b1e] px-6 py-10 sm:px-10">
          <LockKeyhole size={28} className="mb-6 text-[#84d8e8]" aria-hidden="true" />
          <h2 className="text-3xl font-bold tracking-[-0.02em]">
            Forgot your password?
          </h2>
          <p className="mt-5 leading-7 text-zinc-300">
            Contact your tournament administrator to request a password reset.
            For account security, entering an email here cannot verify that you
            own it.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded bg-[#84d8e8] px-6 font-bold text-[#102026] hover:bg-[#a5e9f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Return to login
          </Link>
        </div>
      </section>
    </main>
  );
}
