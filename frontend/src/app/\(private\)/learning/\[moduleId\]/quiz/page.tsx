'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { QuizComponent, QuizQuestion, QuizResult } from '@/components/quiz/quiz-component';
import { api } from '@/lib/api';

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = Number(params.moduleId);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/quiz/modules/${moduleId}/start`);
        setQuestions(response.data.questions);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar as questões');
      } finally {
        setLoading(false);
      }
    };

    if (moduleId) {
      loadQuestions();
    }
  }, [moduleId]);

  const handleSubmitQuiz = async (
    answers: Array<{ questionId: number; selectedOptionIndex: number }>
  ): Promise<QuizResult> => {
    const response = await api.post(`/quiz/modules/${moduleId}/submit`, {
      answers,
    });
    return response.data;
  };

  const handleClose = () => {
    setShowQuiz(false);
    router.back();
  };

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
            <p className="text-red-600 font-semibold">Erro ao carregar simulado</p>
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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button onClick={() => router.back()} variant="outline" className="mb-4">
            ← Voltar
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Simulado Teórico</h1>
          <p className="text-gray-600 mt-2">
            {questions.length} questões de múltipla escolha
          </p>
        </div>

        {!showQuiz ? (
          <Card className="max-w-2xl">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  Bem-vindo ao Simulado!
                </h2>
                <div className="space-y-3 text-gray-700">
                  <p>Este é um simulado teórico com as seguintes características:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>{questions.length} questões de múltipla escolha</li>
                    <li>Cada questão possui 4 alternativas</li>
                    <li>Você pode navegar entre as questões livremente</li>
                    <li>Todas as questões devem ser respondidas para finalizar</li>
                    <li>
                      Ao final, você receberá o resultado com o percentual de acertos
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-900 text-sm">
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
          <Card className="max-w-4xl">
            <QuizComponent
              questions={questions}
              onSubmit={handleSubmitQuiz}
              onClose={handleClose}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
