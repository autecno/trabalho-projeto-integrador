"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, getFriendlyErrorMessage, readApiJson } from "@/lib/api";
import { getValidStoredToken } from "@/lib/auth";

type ModuleSummary = {
  id: number;
  title: string;
  description: string;
  videosCount: number;
  progressPercent: number;
};

export default function LearningPage() {
  const token = getValidStoredToken();
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const authError = token
    ? null
    : 'Você precisa fazer login para acessar os conteúdos.';

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadModules = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiFetch("/learning/modules");
        const payload = await readApiJson<ModuleSummary[]>(
          response,
          'Não foi possível carregar os módulos.',
        );

        setModules(payload);
      } catch (err) {
        setError(
          getFriendlyErrorMessage(err, 'Erro ao carregar os módulos.'),
        );
      } finally {
        setLoading(false);
      }
    };

    loadModules();
  }, [token]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-28">
      <div className="mb-8 flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Conteúdos para alunos</h1>
          <p className="mt-2 text-slate-600">
            Acesse vídeos, resumos e simulados de cada módulo para estudar para a prova do DETRAN.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button variant="outline">Voltar ao dashboard</Button>
          </Link>
        </div>
      </div>

      {loading && <p>Carregando módulos...</p>}
      {(error || authError) && <p className="text-rose-600">{error ?? authError}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <Card key={module.id}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{module.title}</h2>
                <p className="mt-2 text-slate-600">{module.description}</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                {module.videosCount} vídeos
              </span>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                <span>Progresso</span>
                <span>{module.progressPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${module.progressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Link href={`/learning/${module.id}`}>
                <Button variant="default">Ver módulo</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
