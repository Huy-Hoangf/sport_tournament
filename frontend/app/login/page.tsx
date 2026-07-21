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

const ADMIN_EMAIL = "son.vu@twenty-tech.com";
const DEFAULT_PASSWORD = "123456";

type DemoUser = {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: "ADMIN" | "PLAYER";
};

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = username.trim().toLowerCase();

    if (!email || !password) {
      alert("Vui lòng nhập email và mật khẩu.");
      return;
    }

    if (email === ADMIN_EMAIL) {
  const adminPassword = localStorage.getItem("adminPassword") || "123456";

      if (password !== adminPassword) {
        alert("Sai email hoặc mật khẩu.");
        return;
      }

      localStorage.setItem(
        "currentUser",
        JSON.stringify({
          email: ADMIN_EMAIL,
          fullName: "Son Vu",
          role: "ADMIN",
        })
      );

      router.push("/admin");
      return;
    }

    const users: DemoUser[] = JSON.parse(
      localStorage.getItem("users") || "[]"
    );

    const foundUser = users.find(
      (user) =>
        user.email.toLowerCase() === email && user.password === password
    );

    if (!foundUser) {
      alert("Sai email hoặc mật khẩu. User demo có mật khẩu mặc định là 123456.");
      return;
    }

    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        email: foundUser.email,
        fullName: foundUser.fullName,
        role: foundUser.role,
      })
    );

    alert("Player monitor under construction")
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
            Truy Cập Hệ Thống
          </h2>

          <label className="mb-3 flex items-center gap-2 text-[15px] font-bold uppercase tracking-[0.18em] text-zinc-400">
            <UserCircle size={18} />
            Email / Tên đăng nhập
          </label>

          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Email/User"
            className="mb-8 h-[72px] w-full rounded border border-white/10 bg-[#080f0f] px-5 text-xl font-bold text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-[#8ed8ec88]"
          />

          <label className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
            <Lock size={17} />
            Mật khẩu
          </label>

          <div className="mb-8 flex h-[72px] items-center rounded border border-white/10 bg-[#080f0f] px-5 focus-within:border-[#8ed8ec88]">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your pass"
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
            className="flex h-[72px] w-full items-center justify-center gap-4 rounded bg-[#8ed8ec] text-[18px] font-black uppercase tracking-[0.28em] text-[#122226] shadow-[0_0_22px_rgba(142,216,236,0.35)] transition hover:bg-[#a4e7f5]"
          >
            Đăng nhập
            <LogIn size={24} />
          </button>

          <div className="mt-12 flex justify-between text-sm font-semibold text-zinc-300">


            <Link href="/forgot-password" className="hover:text-[#8ed8ec]">
              Quên mật khẩu?
            </Link>
          </div>

          <div className="mt-10 flex items-center gap-5 text-[13px] font-medium uppercase tracking-[0.45em] text-zinc-600">
            <span className="h-px flex-1 bg-white/10" />
            <span>CỔNG BẢO MẬT</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </form>
      </section>

      <footer className="flex h-[78px] shrink-0 items-center justify-between border-t border-white/10 px-10 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
        <p>© 2024 GoalCrystal Predictor. Tất cả dữ liệu được mã hóa.</p>

        <div className="flex gap-10">
          <span>Điều khoản</span>
          <span>Bảo mật</span>
          <span>Trạng thái hệ thống</span>
        </div>
      </footer>
    </main>
  );
}