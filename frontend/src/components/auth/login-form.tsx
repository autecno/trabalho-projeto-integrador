"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApiUrl, getFriendlyErrorMessage, readApiJson } from "@/lib/api";
import { setStoredToken } from "@/lib/auth";

type LoginFormData = {
  email: string;
  password: string;
};

export function LoginForm() {
  const router = useRouter();
  const [data, setData] = useState<LoginFormData>({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("session") === "expired"
      ? "Sua sessão expirou. Entre novamente para continuar."
      : null,
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${getApiUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const payload = await readApiJson<{ token: string }>(
        response,
        "Não foi possível fazer login. Confira seu e-mail e senha.",
      );

      setStoredToken(payload.token);
      router.push("/dashboard");
    } catch (err) {
      setError(
        getFriendlyErrorMessage(
          err,
          "Não foi possível fazer login. Confira sua conexão e tente novamente.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-blue)]">Acesse sua conta</h1>
        <p className="text-sm text-slate-600">
          Entre para acessar a área privada da plataforma Autecno.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="email">
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(event) => setData((current) => ({ ...current, email: event.target.value }))}
            placeholder="voce@email.com"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="password">
            Senha
          </label>
          <Input
            id="password"
            type="password"
            value={data.password}
            onChange={(event) => setData((current) => ({ ...current, password: event.target.value }))}
            placeholder="Digite sua senha"
            required
          />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Ainda não tem conta?{" "}
        <Link href="/auth/cadastro" className="font-semibold text-[var(--brand-blue)] underline">
          Criar cadastro
        </Link>
      </p>
    </Card>
  );
}
