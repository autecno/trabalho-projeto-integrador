"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredTokenPayload } from "@/lib/auth";

type LearningLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function LearningLayout({ children }: LearningLayoutProps) {
  const router = useRouter();
  const tokenPayload = getStoredTokenPayload();

  useEffect(() => {
    if (!tokenPayload) {
      router.replace("/auth/login");
      return;
    }

    if (tokenPayload.role !== "student") {
      router.replace("/dashboard");
    }
  }, [router, tokenPayload]);

  if (!tokenPayload || tokenPayload.role !== "student") {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Validando acesso...
      </main>
    );
  }

  return children;
}
