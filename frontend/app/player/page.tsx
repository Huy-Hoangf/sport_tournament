"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CurrentUser } from "../api";
import { logoutAll, readCurrentUser } from "../auth-sync";

export default function PlayerPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const currentUser = readCurrentUser() as CurrentUser | null;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    setUser(currentUser);

    function handleStorage(event: StorageEvent) {
      if (event.key === "logoutEvent" || event.key === "currentUser") {
        if (!localStorage.getItem("currentUser")) {
          router.push("/login");
        }
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [router]);

  function logout() {
    logoutAll();
    router.push("/login");
  }

  return (
    <main className="auth-page flex min-h-screen items-center justify-center px-5 text-zinc-200">
      <section className="w-full max-w-[620px] rounded-lg border border-[#8ed8ec33] bg-[#111a1acc] p-10 text-center shadow-[0_0_70px_rgba(75,190,210,0.16)]">
        <h1 className="text-4xl font-black text-[#9ddff2]">Player Portal</h1>
        <p className="mt-4 text-lg text-zinc-400">
          Logged in as {user?.fullName ?? "Player"}
        </p>
        <p className="mt-2 text-sm uppercase tracking-[0.2em] text-zinc-500">
          {user?.email}
        </p>

        <button
          onClick={logout}
          className="mt-10 h-[56px] rounded bg-[#8ed8ec] px-8 font-black uppercase tracking-[0.18em] text-[#102026]"
        >
          Logout
        </button>
      </section>
    </main>
  );
}
