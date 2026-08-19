"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleHelp,
  EyeOff,
  Globe2,
  LogIn,
  Lock,
  UserCircle,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { apiRequest, type CurrentUser } from "../api";
import NoticeBanner, { type Notice } from "../notice-banner";

type LoginResponse = {
  message: string;
  user: CurrentUser;
  accessToken: string;
  requiresPasswordChange: boolean;
};

type GoogleLoginUrlResponse = {
  url: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  function showNotice(message: string, tone: Notice["tone"] = "info") {
    setNotice({ message, tone });
  }

  useEffect(() => {
    const hash = window.location.hash;
    const prefix = "#google=";

    if (!hash.startsWith(prefix)) {
      return;
    }

    const params = new URLSearchParams(
      decodeURIComponent(hash.slice(prefix.length)),
    );
    const error = params.get("error");
    const accessToken = params.get("accessToken");
    const rawUser = params.get("user");

    window.history.replaceState(null, "", window.location.pathname);

    if (error) {
      queueMicrotask(() => showNotice(error, "error"));
      return;
    }

    if (!accessToken || !rawUser) {
      queueMicrotask(() => showNotice("Google login failed.", "error"));
      return;
    }

    try {
      const user = JSON.parse(rawUser) as CurrentUser;

      sessionStorage.removeItem("pendingPasswordChangeUser");
      sessionStorage.removeItem("pendingPasswordChangeToken");
      localStorage.setItem("currentUser", JSON.stringify(user));
      localStorage.setItem("accessToken", accessToken);
      router.replace("/admin");
    } catch {
      queueMicrotask(() =>
        showNotice("Cannot read Google login response.", "error"),
      );
    }
  }, [router]);

  async function handleGoogleLogin() {
    setIsLoading(true);

    try {
      const data = await apiRequest<GoogleLoginUrlResponse>("/auth/google/url");
      window.location.href = data.url;
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Google login failed.",
        "error",
      );
      setIsLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = username.trim().toLowerCase();

    if (!email || !password) {
      showNotice("Please enter email and password.", "error");
      return;
    }

    setIsLoading(true);

    try {
      const data = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (data.requiresPasswordChange) {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("accessToken");
        sessionStorage.setItem(
          "pendingPasswordChangeUser",
          JSON.stringify(data.user),
        );
        sessionStorage.setItem("pendingPasswordChangeToken", data.accessToken);
        router.replace("/change-password");
        return;
      }

      sessionStorage.removeItem("pendingPasswordChangeUser");
      sessionStorage.removeItem("pendingPasswordChangeToken");
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      localStorage.setItem("accessToken", data.accessToken);
      router.replace("/admin");
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Login failed.",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-page flex min-h-screen flex-col overflow-hidden">
      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />
      <header className="flex h-[90px] shrink-0 items-center justify-between border-b border-white/10 px-8">
        <h1 className="text-[30px] font-black tracking-[-0.06em] text-[#84d8e8] drop-shadow-[0_0_10px_rgba(132,216,232,0.35)]">
          TWENTY-TECH
        </h1>

        <div className="flex items-center gap-8 text-zinc-300">
          <CircleHelp size={26} />
          <Globe2 size={28} />
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 py-12">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-[560px] rounded-lg border border-[#84d8e844] bg-[#0d1b1ecc] px-10 py-11 shadow-[0_0_45px_rgba(132,216,232,0.1)] backdrop-blur"
        >
          <h2 className="mb-12 text-center text-[40px] font-bold tracking-[-0.02em] text-zinc-200">
            System Access
          </h2>

          <label className="mb-3 flex items-center gap-2 text-[15px] font-bold uppercase tracking-[0.18em] text-zinc-400">
            <UserCircle size={18} />
            Email
          </label>

          <input
            type="email"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="YOUR EMAIL"
            className="mb-8 h-[72px] w-full rounded border border-white/10 bg-[#080f0f] px-5 text-xl font-bold text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-[#84d8e888]"
          />

          <label className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
            <Lock size={17} />
            Password
          </label>

          <div className="mb-8 flex h-[72px] items-center rounded border border-white/10 bg-[#080f0f] px-5 focus-within:border-[#84d8e888]">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="YOUR PASSWORD"
              className="w-full bg-transparent text-xl font-bold text-zinc-200 outline-none placeholder:text-zinc-600"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-zinc-400 hover:text-[#84d8e8]"
            >
              <EyeOff size={28} />
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-[72px] w-full items-center justify-center gap-4 rounded bg-[#84d8e8] text-[18px] font-black uppercase tracking-[0.28em] text-[#102026] shadow-[0_0_20px_rgba(132,216,232,0.28)] transition hover:bg-[#a5e9f3] disabled:opacity-60"
          >
            {isLoading ? "Logging in..." : "Login"}
            <LogIn size={24} />
          </button>

          <div className="mt-12 flex items-center justify-between gap-4 text-sm font-semibold text-zinc-300">
            <Link href="/forgot-password" className="hover:text-[#84d8e8]">
              Forgot password?
            </Link>
            <button
              type="button"
              onClick={() => void handleGoogleLogin()}
              disabled={isLoading}
              className="flex h-9 items-center gap-2 rounded border border-white/10 bg-[#080f0f] px-3 text-xs font-black uppercase tracking-[0.08em] text-zinc-300 transition hover:border-[#84d8e888] hover:text-[#84d8e8]"
            >
              <GoogleLogo />
              Login with Google
            </button>
          </div>

          <div className="mt-10 flex items-center gap-5 text-[13px] font-medium uppercase tracking-[0.45em] text-zinc-600">
            <span className="h-px flex-1 bg-white/10" />
            <span>Secure Portal</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </form>
      </section>

      <footer className="flex h-[78px] shrink-0 items-center justify-between border-t border-white/10 px-10 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
        <p>2026 TWENTY-TECH Predictor. All data is encrypted.</p>
        <div className="flex gap-10">
          <span>Terms</span>
          <span>Security</span>
          <span>System Status</span>
        </div>
      </footer>
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
