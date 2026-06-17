"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getApiUrl } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";

type ModuleDetail = {
  id: number;
  title: string;
  description: string;
  videosCount: number;
  progressPercent: number;
  contents: Array<{
    id: number;
    moduleId: number;
    title: string;
    type: 'video' | 'text';
    summary: string | null;
  }>;
  quizCount: number;
};

type QuizQuestion = {
  id: number;
  moduleId: number;
  prompt: string;
  options: string[];
  explanation: string | null;
};

type QuizAnswerState = Record<number, number>;

type QuizResult = {
  total: number;
  correct: number;
  results: Array<{
    questionId: number;
    correct: boolean;
    selectedOptionIndex: number;
    correctOptionIndex: number;
    explanation: string | null;
  }>;
};

export default function ModulePage() {
  const params = useParams<{ moduleId: string }>();
  const router = useRouter();
  const token = getStoredToken();
  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<QuizAnswerState>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'video' | 'text'>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const moduleId = Number(params.moduleId);
  const filteredContents = useMemo(
    () =>
      module?.contents.filter((content) =>
        filter === 'all' ? true : content.type === filter,
      ) ?? [],
    [module, filter],
  );

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }

    if (!Number.isFinite(moduleId) || moduleId <= 0) {
      setError('moduleId inválido.');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [moduleResponse, quizResponse] = await Promise.all([
          fetch(`${getApiUrl()}/learning/modules/${moduleId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${getApiUrl()}/learning/modules/${moduleId}/quiz`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const modulePayload = await moduleResponse.json();
        if (!moduleResponse.ok) {
          throw new Error(modulePayload.message || 'Não foi possível carregar o módulo.');
        }

        const quizPayload = await quizResponse.json();
        if (!quizResponse.ok) {
          throw new Error(quizPayload.message || 'Não foi possível carregar o simulado.');
        }

        setModule(modulePayload);
        setQuizQuestions(quizPayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar o módulo.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, moduleId, router]);

  const handleSelectAnswer = (questionId: number, optionIndex: number) => {
    setSelectedAnswers((current) => ({ ...current, [questionId]: optionIndex }));
  };

  const handleSubmitQuiz = async () => {
    if (!token) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = Object.entries(selectedAnswers).map(([questionId, selectedOptionIndex]) => ({
        questionId: Number(questionId),
        selectedOptionIndex,
      }));

      const response = await fetch(`${getApiUrl()}/learning/modules/${moduleId}/quiz/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: payload }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Falha ao enviar o simulado.');
      }

      setQuizResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar o simulado.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-28">
      <div className="mb-8 flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{module?.title ?? 'Módulo'}</h1>
          <p className="mt-2 text-slate-600">{module?.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/learning">
            <Button variant="outline">Voltar aos conteúdos</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Dashboard</Button>
          </Link>
        </div>
      </div>

      {loading && <p>Carregando módulo...</p>}
      {error && <p className="text-rose-600">{error}</p>}

      {module && (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="space-y-6">
            <Card>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Progresso
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">
                      {module.progressPercent}%
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                    {module.videosCount} vídeos
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${module.progressPercent}%` }}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                >
                  Todos
                </Button>
                <Button
                  variant={filter === 'video' ? 'default' : 'outline'}
                  onClick={() => setFilter('video')}
                >
                  Vídeos
                </Button>
                <Button
                  variant={filter === 'text' ? 'default' : 'outline'}
                  onClick={() => setFilter('text')}
                >
                  Texto
                </Button>
              </div>
            </Card>

            {filteredContents.length === 0 && (
              <Card>
                <p className="text-slate-600">Nenhum conteúdo disponível para este filtro.</p>
              </Card>
            )}

            {filteredContents.map((content) => (
              <Card key={content.id}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">{content.title}</h2>
                      <p className="mt-2 text-sm text-slate-600">{content.summary}</p>
                    </div>
                    <Link href={`/learning/${moduleId}/${content.id}`}>
                      <Button variant="default">Abrir</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </section>

          <aside className="space-y-6">
            <Card>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Simulado do módulo</h2>
                <p className="mt-2 text-slate-600">
                  Resolva as questões abaixo para praticar o conteúdo antes da prova.
                </p>
              </div>
            </Card>

            {quizQuestions.map((question) => (
              <Card key={question.id}>
                <div className="space-y-4">
                  <p className="font-semibold text-slate-900">{question.prompt}</p>
                  {question.options.map((option, index) => (
                    <button
                      key={option}
                      className={`block w-full rounded-2xl border p-3 text-left transition ${
                        selectedAnswers[question.id] === index
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 bg-white'
                      }`}
                      onClick={() => handleSelectAnswer(question.id, index)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </Card>
            ))}

            <div className="space-y-4">
              <Button onClick={handleSubmitQuiz} disabled={submitting}>
                {submitting ? 'Enviando...' : 'Enviar simulado'}
              </Button>

              {quizResult && (
                <Card>
                  <div className="space-y-3">
                    <p className="text-lg font-semibold text-slate-900">
                      Resultado: {quizResult.correct} de {quizResult.total}
                    </p>
                    {quizResult.results.map((result) => (
                      <div key={result.questionId} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-700">
                          Questão {result.questionId} ? {result.correct ? 'Correta' : 'Incorreta'}
                        </p>
                        <p className="text-sm text-slate-600">Resposta selecionada: opção {result.selectedOptionIndex + 1}</p>
                        <p className="text-sm text-slate-600">Resposta correta: opção {result.correctOptionIndex + 1}</p>
                        {result.explanation && (
                          <p className="text-sm text-slate-600">Explicação: {result.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
