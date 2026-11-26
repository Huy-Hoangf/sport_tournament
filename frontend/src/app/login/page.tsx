"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { apiRequest, type CurrentUser } from "../../lib/api/client";
import NoticeBanner, { type Notice } from "../../components/ui/notice-banner";

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
    <main className="auth-page flex min-h-screen flex-col">
      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />
      <header className="flex h-16 items-center border-b border-white/10 px-5 sm:px-8">
        <p className="text-xl font-black tracking-tight text-[#84d8e8]">TWENTY-TECH</p>
      </header>

      <section className="flex flex-1 items-start justify-center px-4 py-5 sm:items-center sm:px-6 sm:py-10">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md space-y-5 rounded-xl border border-[#3a4d54] bg-[#0d252d] p-5 sm:p-8"
        >
          <div>
            <h1 className="text-balance text-2xl font-black tracking-tight text-white sm:text-3xl">
              Sign in to predict matches
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#c8d6db]">
              Pick match results and see how you rank on the leaderboard.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1 block text-sm font-bold text-[#dce8eb]">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-12 w-full rounded border border-[#3a4d54] bg-[#06161b] px-3 text-white focus-visible:outline-2 focus-visible:outline-[#84d8e8]"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1 block text-sm font-bold text-[#dce8eb]">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded border border-[#3a4d54] bg-[#06161b] pl-3 pr-14 text-white focus-visible:outline-2 focus-visible:outline-[#84d8e8]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded text-[#c8d6db] hover:text-white focus-visible:outline-2 focus-visible:outline-[#84d8e8]"
                >
                  {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-2.5">
            <button
              type="submit"
              disabled={isLoading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded bg-[#84d8e8] px-4 py-2 font-black text-[#06161b] hover:bg-[#a6e5ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84d8e8] disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign in"}
              <LogIn size={19} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void handleGoogleLogin()}
              disabled={isLoading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded border border-[#3a4d54] bg-[#06161b] px-4 py-2 text-sm font-bold text-white hover:border-[#84d8e8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84d8e8] disabled:opacity-60"
            >
              <GoogleLogo />
              Continue with Google
            </button>
          </div>

          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-bold text-[#84d8e8] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#84d8e8]">
            Forgot password?
          </Link>
        </form>
      </section>
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
