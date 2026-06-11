"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { clearStoredToken, getStoredToken } from "@/lib/auth";

type FloatingNavbarProps = {
  privateArea?: boolean;
};

export function FloatingNavbar({ privateArea = false }: FloatingNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const hasToken = !!getStoredToken();
  const isLanding = pathname === "/";

  const handleLogout = () => {
    clearStoredToken();
    router.push("/auth/login");
  };

  return (
    <header className="fixed left-0 right-0 top-4 z-50 px-4">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl border border-[var(--border-soft)] bg-white/88 px-4 py-3 shadow-lg backdrop-blur">
        <Logo />

        <nav className="flex items-center gap-2">
          {!privateArea && (
            <>
              {isLanding && (
                <>
                  <Link href="/#inicio" className="hidden md:block">
                    <Button variant="ghost">Início</Button>
                  </Link>
                  <Link href="/#funcionalidades" className="hidden md:block">
                    <Button variant="ghost">Funcionalidades</Button>
                  </Link>
                  <Link href="/#como-funciona" className="hidden md:block">
                    <Button variant="ghost">Como funciona</Button>
                  </Link>
                  <Link href="/#contato" className="hidden md:block">
                    <Button variant="ghost">Contato</Button>
                  </Link>
                </>
              )}
              <Link href="/auth/login">
                <Button variant={pathname === "/auth/login" ? "default" : "outline"}>
                  Entrar
                </Button>
              </Link>
              <Link href="/auth/cadastro">
                <Button variant={pathname === "/auth/cadastro" ? "default" : "outline"}>
                  Cadastrar
                </Button>
              </Link>
            </>
          )}

          {privateArea && (
            <>
              <Link href="/dashboard">
                <Button variant={pathname === "/dashboard" ? "default" : "outline"}>
                  Dashboard
                </Button>
              </Link>
              <Link href="/learning">
                <Button variant={pathname === "/learning" ? "default" : "outline"}>
                  Conteúdos
                </Button>
              </Link>
              {hasToken && (
                <Button variant="ghost" onClick={handleLogout}>
                  Sair
                </Button>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
