"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FloatingNavbar } from "@/components/layout/floating-navbar";
import { AUTH_CHANGED_EVENT, getValidStoredToken } from "@/lib/auth";

export default function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(() => getValidStoredToken());

  useEffect(() => {
    const syncToken = () => {
      const validToken = getValidStoredToken();
      setToken(validToken);

      if (!validToken) {
        router.replace("/auth/login?session=expired");
      }
    };

    syncToken();
    window.addEventListener(AUTH_CHANGED_EVENT, syncToken);
    window.addEventListener("storage", syncToken);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncToken);
      window.removeEventListener("storage", syncToken);
    };
  }, [pathname, router]);

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Validando sessão...
      </main>
    );
  }

  return (
    <>
      <FloatingNavbar privateArea />
      {children}
    </>
  );
}
