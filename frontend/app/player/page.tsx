"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { readCurrentUser } from "../auth-sync";

export default function PlayerPage() {
  const router = useRouter();

  useEffect(() => {
    const currentUser = readCurrentUser();
    router.replace(currentUser ? "/admin" : "/login");
  }, [router]);

  return (
    <main className="auth-page flex min-h-screen items-center justify-center px-5 text-zinc-200">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-[#84d8e8]">
        Opening dashboard...
      </p>
    </main>
  );
}
