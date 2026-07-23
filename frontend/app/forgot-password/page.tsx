"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { apiRequest } from "../api";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function verifyEmail() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      alert("Please enter your company email.");
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest<{ message: string; email: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail }),
      });

      setEmail(normalizedEmail);
      setIsVerified(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Email verification failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resetPassword() {
    if (!newPassword || !confirmPassword) {
      alert("Please enter and confirm the new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Confirm password does not match.");
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email,
          newPassword,
        }),
      });

      alert("Password reset successfully.");
      router.push("/login");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Reset password failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-page flex min-h-screen flex-col overflow-hidden bg-[#0c1111] text-zinc-200">
      <header className="flex h-[90px] shrink-0 items-center justify-between border-b border-white/10 px-8">
        <h1 className="text-[30px] font-black tracking-[-0.06em] text-[#9ddff2] drop-shadow-[0_0_10px_rgba(142,216,236,0.45)]">
          GOALCRYSTAL
        </h1>

        <Link
          href="/login"
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-zinc-300 hover:text-[#8ed8ec]"
        >
          <ArrowLeft size={18} />
          Back to login
        </Link>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[560px] rounded-lg border border-[#8ed8ec44] bg-[#111a1acc] px-10 py-11 shadow-[0_0_55px_rgba(75,190,210,0.12)] backdrop-blur">
          <h2 className="mb-3 text-center text-[38px] font-bold tracking-[-0.02em] text-zinc-200">
            Forgot Password
          </h2>

          <p className="mb-10 text-center text-zinc-400">
            Reset password for admin or player accounts
          </p>

          <label className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
            <Mail size={17} />
            Company Email
          </label>

          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isVerified}
            placeholder="YOUR COMPANY EMAIL"
            className="mb-6 h-[64px] w-full rounded border border-white/10 bg-[#080f0f] px-5 text-lg font-bold text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-[#8ed8ec88] disabled:opacity-60"
          />

          {!isVerified ? (
            <button
              onClick={verifyEmail}
              disabled={isLoading}
              className="flex h-[64px] w-full items-center justify-center gap-3 rounded bg-[#8ed8ec] text-[16px] font-black uppercase tracking-[0.22em] text-[#122226] shadow-[0_0_22px_rgba(142,216,236,0.35)] transition hover:bg-[#a4e7f5] disabled:opacity-60"
            >
              {isLoading ? "Verifying..." : "Verify Email"}
              <KeyRound size={22} />
            </button>
          ) : (
            <>
              <label className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
                <Lock size={17} />
                New Password
              </label>

              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mb-6 h-[64px] w-full rounded border border-white/10 bg-[#080f0f] px-5 text-lg font-bold text-zinc-200 outline-none transition focus:border-[#8ed8ec88]"
              />

              <label className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
                <Lock size={17} />
                Confirm Password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mb-8 h-[64px] w-full rounded border border-white/10 bg-[#080f0f] px-5 text-lg font-bold text-zinc-200 outline-none transition focus:border-[#8ed8ec88]"
              />

              <button
                onClick={resetPassword}
                disabled={isLoading}
                className="flex h-[64px] w-full items-center justify-center gap-3 rounded bg-[#8ed8ec] text-[16px] font-black uppercase tracking-[0.22em] text-[#122226] shadow-[0_0_22px_rgba(142,216,236,0.35)] transition hover:bg-[#a4e7f5] disabled:opacity-60"
              >
                {isLoading ? "Resetting..." : "Reset Password"}
                <KeyRound size={22} />
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
