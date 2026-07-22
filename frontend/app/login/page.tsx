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
import { useState } from "react";
import { apiRequest, type CurrentUser } from "../api";

type LoginResponse = {
  message: string;
  user: CurrentUser;
};

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = username.trim().toLowerCase();

    if (!email || !password) {
      alert("Please enter email and password.");
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

      localStorage.setItem("currentUser", JSON.stringify(data.user));
      router.push(data.user.role === "ADMIN" ? "/admin" : "/player");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-page flex min-h-screen flex-col overflow-hidden">
      <header className="flex h-[90px] shrink-0 items-center justify-between border-b border-white/10 px-8">
        <h1 className="text-[30px] font-black tracking-[-0.06em] text-[#9ddff2] drop-shadow-[0_0_10px_rgba(142,216,236,0.45)]">
          GOALCRYSTAL
        </h1>

        <div className="flex items-center gap-8 text-zinc-300">
          <CircleHelp size={26} />
          <Globe2 size={28} />
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 py-12">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-[560px] rounded-lg border border-[#8ed8ec44] bg-[#111a1acc] px-10 py-11 shadow-[0_0_55px_rgba(75,190,210,0.12)] backdrop-blur"
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
            placeholder="son.vu@twenty-tech.com"
            className="mb-8 h-[72px] w-full rounded border border-white/10 bg-[#080f0f] px-5 text-xl font-bold text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-[#8ed8ec88]"
          />

          <label className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
            <Lock size={17} />
            Password
          </label>

          <div className="mb-8 flex h-[72px] items-center rounded border border-white/10 bg-[#080f0f] px-5 focus-within:border-[#8ed8ec88]">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="123456"
              className="w-full bg-transparent text-xl font-bold text-zinc-200 outline-none placeholder:text-zinc-600"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-zinc-400 hover:text-[#8ed8ec]"
            >
              <EyeOff size={28} />
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-[72px] w-full items-center justify-center gap-4 rounded bg-[#8ed8ec] text-[18px] font-black uppercase tracking-[0.28em] text-[#122226] shadow-[0_0_22px_rgba(142,216,236,0.35)] transition hover:bg-[#a4e7f5] disabled:opacity-60"
          >
            {isLoading ? "Logging in..." : "Login"}
            <LogIn size={24} />
          </button>

          <div className="mt-12 flex justify-between text-sm font-semibold text-zinc-300">
            <Link href="/forgot-password" className="hover:text-[#8ed8ec]">
              Forgot password?
            </Link>
            <span className="text-zinc-500">Admin default: 123456</span>
          </div>

          <div className="mt-10 flex items-center gap-5 text-[13px] font-medium uppercase tracking-[0.45em] text-zinc-600">
            <span className="h-px flex-1 bg-white/10" />
            <span>Secure Portal</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </form>
      </section>

      <footer className="flex h-[78px] shrink-0 items-center justify-between border-t border-white/10 px-10 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
        <p>2024 GoalCrystal Predictor. All data is encrypted.</p>

        <div className="flex gap-10">
          <span>Terms</span>
          <span>Security</span>
          <span>System Status</span>
        </div>
      </footer>
    </main>
  );
}
