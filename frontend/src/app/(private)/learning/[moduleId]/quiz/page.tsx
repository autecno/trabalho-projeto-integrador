'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuizComponent, QuizQuestion, QuizResult } from '@/components/quiz/quiz-component';
import { apiFetch, getFriendlyErrorMessage, readApiJson } from '@/lib/api';
import { getValidStoredToken } from '@/lib/auth';

export default function QuizPage() {
  const params = useParams<{ moduleId: string }>();
  const router = useRouter();
  const token = getValidStoredToken();
  const moduleId = Number(params.moduleId);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }

    if (!Number.isFinite(moduleId) || moduleId <= 0) {
      setError('ID do módulo inválido.');
      setLoading(false);
      return;
    }

    const loadQuestions = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiFetch(`/quiz/modules/${moduleId}/start`);
        const data = await readApiJson<{ questions: QuizQuestion[] }>(
          response,
          'Erro ao carregar as questões',
        );

        setQuestions(data.questions);
      } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Erro ao carregar o simulado'));
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [token, moduleId, router]);

  const handleSubmitQuiz = async (
    answers: Array<{ questionId: number; selectedOptionIndex: number }>
  ): Promise<QuizResult> => {
    const response = await apiFetch(`/quiz/modules/${moduleId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answers }),
    });

    return readApiJson<QuizResult>(response, 'Erro ao avaliar o simulado');
  };

  const handleClose = () => {
    setShowQuiz(false);
    router.back();
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <p className="text-gray-600">Redirecionando...</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card>
          <p className="text-gray-600">Carregando simulado...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <div className="space-y-4">
            <p className="font-semibold text-red-600">Erro ao carregar simulado</p>
            <p className="text-gray-600">{error}</p>
            <Button onClick={() => router.back()} variant="outline">
              Voltar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <div className="space-y-4">
            <p className="font-semibold text-gray-900">Nenhuma questão disponível</p>
            <p className="text-gray-600">Este módulo não possui simulado disponível</p>
            <Button onClick={() => router.back()} variant="outline">
              Voltar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8">
      <div className="mb-6">
        <Button onClick={() => router.back()} variant="outline" className="mb-4">
          ← Voltar
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Simulado Teórico</h1>
        <p className="mt-2 text-gray-600">
          {questions.length} questões de múltipla escolha
        </p>
      </div>

      {!showQuiz ? (
        <Card>
          <div className="space-y-6">
            <div>
              <h2 className="mb-4 text-2xl font-semibold text-gray-900">
                Bem-vindo ao Simulado!
              </h2>
              <div className="space-y-3 text-gray-700">
                <p>Este é um simulado teórico com as seguintes características:</p>
                <ul className="space-y-2 pl-5">
                  <li>• {questions.length} questões de múltipla escolha</li>
                  <li>• Cada questão possui 4 alternativas</li>
                  <li>• Você pode navegar entre as questões livremente</li>
                  <li>• Todas as questões devem ser respondidas para finalizar</li>
                  <li>
                    • Ao final, você receberá o resultado com o percentual de acertos
                  </li>
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Dica:</span> Responda com cuidado, pois não
                será possível alterar suas respostas após finalizar o simulado.
              </p>
            </div>

            <Button
              onClick={() => setShowQuiz(true)}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Iniciar Prova
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <QuizComponent
            questions={questions}
            onSubmit={handleSubmitQuiz}
            onClose={handleClose}
          />
        </Card>
      )}
    </main>
  );
}
