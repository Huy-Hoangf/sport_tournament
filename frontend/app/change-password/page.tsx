"use client";

import {
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { apiRequest, type CurrentUser } from "../api";
import NoticeBanner, { type Notice } from "../notice-banner";

type CompleteFirstLoginResponse = {
  message: string;
  user: CurrentUser;
  accessToken: string;
};

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const pendingUserRaw = useSyncExternalStore(
    subscribeToPendingLogin,
    readPendingUserSnapshot,
    getEmptySnapshot,
  );
  const pendingToken = useSyncExternalStore(
    subscribeToPendingLogin,
    readPendingTokenSnapshot,
    getEmptySnapshot,
  );
  const pendingUser = useMemo(
    () => parsePendingUser(pendingUserRaw),
    [pendingUserRaw],
  );

  useEffect(() => {
    const redirectTimer = window.setTimeout(() => {
      const storedUser = parsePendingUser(readPendingUserSnapshot());
      const storedToken = readPendingTokenSnapshot();

      if (!storedUser || !storedToken) {
        clearPendingLogin();
        router.replace("/login");
      }
    }, 0);

    return () => window.clearTimeout(redirectTimer);
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newPassword || !confirmPassword) {
      setNotice({
        message: "Please enter and confirm your new password.",
        tone: "error",
      });
      return;
    }

    if (newPassword.length < 6) {
      setNotice({
        message: "Password must contain at least 6 characters.",
        tone: "error",
      });
      return;
    }

    if (newPassword === "123456") {
      setNotice({
        message: "New password must be different from the default password.",
        tone: "error",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setNotice({
        message: "Confirm password does not match.",
        tone: "error",
      });
      return;
    }

    if (!pendingToken) {
      clearPendingLogin();
      router.replace("/login");
      return;
    }

    setIsLoading(true);

    try {
      const data = await apiRequest<CompleteFirstLoginResponse>(
        "/auth/complete-first-login",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pendingToken}`,
          },
          body: JSON.stringify({ newPassword }),
        },
      );

      localStorage.setItem("currentUser", JSON.stringify(data.user));
      localStorage.setItem("accessToken", data.accessToken);
      clearPendingLogin();
      router.replace("/admin");
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Password change failed.",
        tone: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function cancelFirstLogin() {
    clearPendingLogin();
    router.replace("/login");
  }

  return (
    <main className="auth-page flex min-h-screen flex-col overflow-hidden">
      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />

      <header className="flex h-[90px] shrink-0 items-center justify-between border-b border-white/10 px-8">
        <h1 className="text-[30px] font-black text-[#84d8e8] drop-shadow-[0_0_10px_rgba(132,216,232,0.35)]">
          TWENTY-TECH
        </h1>
        <div className="flex items-center gap-3 text-sm font-bold uppercase text-zinc-300">
          <ShieldCheck size={22} className="text-[#84d8e8]" />
          Secure account setup
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 py-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[600px] rounded-lg border border-[#84d8e844] bg-[#0d1b1ecc] px-10 py-10 shadow-[0_0_45px_rgba(132,216,232,0.1)] backdrop-blur"
        >
          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[#15323a] text-[#84d8e8]">
              <KeyRound size={26} />
            </div>
            <div>
              <h2 className="text-[30px] font-bold text-zinc-100">
                Create a new password
              </h2>
              <p className="mt-1 text-zinc-400">
                Your account is using the default password. Change it before
                opening the dashboard.
              </p>
            </div>
          </div>

          <div className="mb-7 rounded border border-white/10 bg-[#091111] px-4 py-3">
            <p className="text-xs font-bold uppercase text-zinc-500">
              Signed in as
            </p>
            <p className="mt-1 font-bold text-zinc-200">
              {pendingUser?.fullName ?? "Player"}
            </p>
            <p className="text-sm text-[#84d8e8]">{pendingUser?.email}</p>
          </div>

          <PasswordField
            label="New password"
            value={newPassword}
            visible={showNewPassword}
            onChange={setNewPassword}
            onToggle={() => setShowNewPassword((value) => !value)}
          />

          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            visible={showConfirmPassword}
            onChange={setConfirmPassword}
            onToggle={() => setShowConfirmPassword((value) => !value)}
          />

          <p className="mb-7 text-sm text-zinc-400">
            Use at least 6 characters. The new password cannot be{" "}
            <span className="font-bold text-zinc-200">123456</span>.
          </p>

          <button
            type="submit"
            disabled={isLoading || !pendingUser}
            className="flex h-[62px] w-full items-center justify-center gap-3 rounded bg-[#84d8e8] text-base font-black uppercase text-[#102026] shadow-[0_0_20px_rgba(132,216,232,0.25)] transition hover:bg-[#a5e9f3] disabled:opacity-60"
          >
            {isLoading ? "Saving..." : "Save password and continue"}
            <LockKeyhole size={21} />
          </button>

          <button
            type="button"
            onClick={cancelFirstLogin}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-zinc-100"
          >
            <LogOut size={17} />
            Sign in with another account
          </button>
        </form>
      </section>
    </main>
  );
}

function PasswordField({
  label,
  value,
  visible,
  onChange,
  onToggle,
}: {
  label: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <label className="mb-6 block">
      <span className="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-zinc-400">
        <LockKeyhole size={16} />
        {label}
      </span>
      <span className="flex h-[62px] items-center rounded border border-white/10 bg-[#080f0f] px-4 focus-within:border-[#84d8e888]">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          className="min-w-0 flex-1 bg-transparent text-lg font-bold text-zinc-200 outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          className="ml-3 text-zinc-500 transition hover:text-[#84d8e8]"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? <EyeOff size={22} /> : <Eye size={22} />}
        </button>
      </span>
    </label>
  );
}

function clearPendingLogin() {
  sessionStorage.removeItem("pendingPasswordChangeUser");
  sessionStorage.removeItem("pendingPasswordChangeToken");
}

function subscribeToPendingLogin() {
  return () => undefined;
}

function readPendingUserSnapshot() {
  return sessionStorage.getItem("pendingPasswordChangeUser");
}

function readPendingTokenSnapshot() {
  return sessionStorage.getItem("pendingPasswordChangeToken");
}

function getEmptySnapshot() {
  return null;
}

function parsePendingUser(rawUser: string | null): CurrentUser | null {
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as CurrentUser;
  } catch {
    return null;
  }
}
