"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { apiFetch, readApiJson } from "@/lib/api";
import {
  clearStoredToken,
  getStoredTokenPayload,
  getValidStoredToken,
} from "@/lib/auth";

type FloatingNavbarProps = {
  privateArea?: boolean;
};

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  unreadCount: number;
  items: NotificationItem[];
};

export function FloatingNavbar({ privateArea = false }: FloatingNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const token = getValidStoredToken();
  const hasToken = !!token;
  const isLanding = pathname === "/";
  const tokenPayload = getStoredTokenPayload();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const handleLogout = () => {
    clearStoredToken();
    router.push("/auth/login");
  };

  const loadNotifications = useCallback(async () => {
    if (!privateArea || !hasToken) {
      return;
    }

    try {
      setNotificationError(null);
      const response = await apiFetch("/notifications");
      const payload = await readApiJson<NotificationsResponse>(
        response,
        "Não foi possível carregar notificações.",
      );
      setNotifications(payload.items);
      setUnreadCount(payload.unreadCount);
    } catch (error) {
      setNotificationError(
        error instanceof Error ? error.message : "Não foi possível carregar notificações.",
      );
    }
  }, [hasToken, privateArea]);

  const markAllNotificationsAsRead = async () => {
    try {
      await apiFetch("/notifications/read-all", {
        method: "PATCH",
      });
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (error) {
      setNotificationError(
        error instanceof Error ? error.message : "Não foi possível atualizar notificações.",
      );
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 60000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadNotifications, pathname]);

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
              {tokenPayload?.role === "student" && (
                <Link href="/learning">
                  <Button
                    variant={pathname.startsWith("/learning") ? "default" : "outline"}
                  >
                    Conteúdos
                  </Button>
                </Link>
              )}
              <div className="relative">
                <button
                  aria-label="Abrir notificações"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-soft)] text-[var(--brand-blue)] transition hover:border-[var(--brand-yellow)] hover:bg-[rgba(249,181,46,0.08)]"
                  onClick={() => setNotificationsOpen((current) => !current)}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 text-xs font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 top-12 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--border-soft)] bg-white p-3 shadow-xl">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--brand-blue)]">
                        Notificações
                      </p>
                      <button
                        className="text-xs font-semibold text-[var(--brand-blue)] underline disabled:opacity-50"
                        disabled={unreadCount === 0}
                        onClick={() => void markAllNotificationsAsRead()}
                        type="button"
                      >
                        Marcar lidas
                      </button>
                    </div>

                    {notificationError && (
                      <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {notificationError}
                      </p>
                    )}

                    {!notificationError && notifications.length === 0 && (
                      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Você ainda não tem notificações.
                      </p>
                    )}

                    <div className="max-h-80 space-y-2 overflow-auto">
                      {notifications.map((notification) => (
                        <article
                          key={notification.id}
                          className={`rounded-lg border px-3 py-2 text-sm ${
                            notification.readAt
                              ? "border-slate-100 bg-white text-slate-600"
                              : "border-amber-200 bg-amber-50 text-slate-800"
                          }`}
                        >
                          <p className="font-semibold">{notification.title}</p>
                          <p className="mt-1 leading-5">{notification.message}</p>
                          <p className="mt-2 text-xs text-slate-500">
                            {new Date(notification.createdAt).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
