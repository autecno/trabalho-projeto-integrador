'use client';

import { useState } from 'react';
import { Button } from './button';
import { Card } from './card';

export interface QuizQuestion {
  id: number;
  moduleId: number;
  prompt: string;
  options: string[];
}

export interface QuizResult {
  moduleId: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  percentageCorrect: number;
  passed: boolean;
  results: Array<{
    questionId: number;
    isCorrect: boolean;
    selectedOptionIndex: number;
    correctOptionIndex: number;
    explanation: string | null;
  }>;
}

interface QuizComponentProps {
  questions: QuizQuestion[];
  onSubmit: (answers: Array<{ questionId: number; selectedOptionIndex: number }>) => Promise<QuizResult>;
  onClose: () => void;
}

export function QuizComponent({ questions, onSubmit, onClose }: QuizComponentProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{
    [questionId: number]: number;
  }>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const selectedOption = answers[currentQuestion.id];

  const handleSelectOption = (optionIndex: number) => {
    setAnswers({
      ...answers,
      [currentQuestion.id]: optionIndex,
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const answersArray = questions.map((q) => ({
        questionId: q.id,
        selectedOptionIndex: answers[q.id] ?? -1,
      }));

      const quizResult = await onSubmit(answersArray);
      setResult(quizResult);
    } catch (error) {
      console.error('Erro ao enviar simulado:', error);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        {/* Result Summary */}
        <Card>
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-gray-900">Resultado do Simulado</h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-blue-600">{result.correctAnswers}</p>
                <p className="text-sm text-gray-600">Acertos</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-red-600">{result.wrongAnswers}</p>
                <p className="text-sm text-gray-600">Erros</p>
              </div>
              <div className="text-center">
                <p
                  className={`text-4xl font-bold ${
                    result.passed ? 'text-green-600' : 'text-orange-600'
                  }`}
                >
                  {result.percentageCorrect}%
                </p>
                <p className="text-sm text-gray-600">Aproveitamento</p>
              </div>
            </div>

            <div
              className={`rounded-lg p-4 text-center font-semibold ${
                result.passed
                  ? 'bg-green-50 text-green-700'
                  : 'bg-orange-50 text-orange-700'
              }`}
            >
              {result.passed ? '✓ Você foi aprovado!' : '⚠ Você não foi aprovado'}
            </div>
          </div>
        </Card>

        {/* Detailed Results */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900">Respostas Detalhadas</h4>
          {result.results.map((res, idx) => {
            const question = questions.find((q) => q.id === res.questionId);
            return (
              <Card key={res.questionId} className={res.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="font-semibold text-gray-900">Questão {idx + 1}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        res.isCorrect
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {res.isCorrect ? '✓ Correta' : '✗ Incorreta'}
                    </span>
                  </div>

                  <p className="text-gray-700">{question?.prompt}</p>

                  <div className="space-y-2">
                    {question?.options.map((option, optIdx) => (
                      <div
                        key={optIdx}
                        className={`rounded-lg border-2 p-3 ${
                          optIdx === res.correctOptionIndex
                            ? 'border-green-500 bg-green-100'
                            : optIdx === res.selectedOptionIndex && !res.isCorrect
                            ? 'border-red-500 bg-red-100'
                            : 'border-gray-200'
                        }`}
                      >
                        <p className="text-sm">
                          <span className="font-semibold">{String.fromCharCode(65 + optIdx)})</span> {option}
                          {optIdx === res.correctOptionIndex && ' ✓'}
                          {optIdx === res.selectedOptionIndex && !res.isCorrect && ' (Sua resposta)'}
                        </p>
                      </div>
                    ))}
                  </div>

                  {res.explanation && (
                    <div className="mt-3 rounded-lg bg-blue-50 p-3">
                      <p className="text-sm text-blue-900">
                        <span className="font-semibold">Explicação:</span> {res.explanation}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Questão {currentQuestionIndex + 1} de {questions.length}</span>
          <span>
            {Object.keys(answers).length}/{questions.length} respondidas
          </span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{
              width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Question Card */}
      <Card>
        <div className="space-y-4">
          <p className="text-lg font-semibold text-gray-900">{currentQuestion.prompt}</p>

          <div className="space-y-2">
            {currentQuestion.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                  selectedOption === idx
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="font-semibold">{String.fromCharCode(65 + idx)})</span> {option}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-3">
        <Button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          variant="outline"
        >
          Anterior
        </Button>

        {currentQuestionIndex === questions.length - 1 ? (
          <Button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length !== questions.length || loading}
          >
            {loading ? 'Enviando...' : 'Finalizar Prova'}
          </Button>
        ) : (
          <Button onClick={handleNext}>Próxima</Button>
        )}
      </div>

      {Object.keys(answers).length !== questions.length && (
        <p className="text-center text-sm text-gray-500">
          Responda todas as questões para finalizar
        </p>
      )}
    </div>
  );
}
