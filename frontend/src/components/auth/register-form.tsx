"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApiUrl, getFriendlyErrorMessage, readApiJson } from "@/lib/api";

type RegisterFormData = {
  name: string;
  email: string;
  password: string;
  role: "student" | "instructor";
};

export function RegisterForm() {
  const router = useRouter();
  const [data, setData] = useState<RegisterFormData>({
    name: "",
    email: "",
    password: "",
    role: "student",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${getApiUrl()}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      await readApiJson(response, "Não foi possível concluir o cadastro.");

      setSuccess("Cadastro realizado com sucesso. Você já pode entrar.");
      setData({ name: "", email: "", password: "", role: "student" });
      setTimeout(() => router.push("/auth/login"), 700);
    } catch (err) {
      setError(
        getFriendlyErrorMessage(
          err,
          "Não foi possível concluir o cadastro. Confira os dados e tente novamente.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-blue)]">Crie sua conta</h1>
        <p className="text-sm text-slate-600">
          Faça seu cadastro para acessar a experiência da plataforma Autecno.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="name">
            Nome completo
          </label>
          <Input
            id="name"
            type="text"
            value={data.name}
            onChange={(event) => setData((current) => ({ ...current, name: event.target.value }))}
            placeholder="Digite seu nome"
            required
          />
        </div>

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
            placeholder="Crie uma senha"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="role">
            Perfil
          </label>
          <select
            id="role"
            value={data.role}
            onChange={(event) =>
              setData((current) => ({
                ...current,
                role: event.target.value as RegisterFormData["role"],
              }))
            }
            className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-blue)_18%,white)]"
            required
          >
            <option value="student">Aluno</option>
            <option value="instructor">Instrutor</option>
          </select>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Cadastrando..." : "Cadastrar"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Já possui conta?{" "}
        <Link href="/auth/login" className="font-semibold text-[var(--brand-blue)] underline">
          Entrar agora
        </Link>
      </p>
    </Card>
  );
}
