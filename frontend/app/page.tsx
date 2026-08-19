"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const hasSession =
      localStorage.getItem("currentUser") &&
      localStorage.getItem("accessToken");

    router.replace(hasSession ? "/admin" : "/login");
  }, [router]);

  return null;
}
