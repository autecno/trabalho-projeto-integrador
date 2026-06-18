import { FastifyInstance } from 'fastify';
import { buildAuthenticateRequest } from '../middlewares/auth.middleware';
import { AuthTokenPayload } from '../services/jwt.service';
import {
  LearningRepository,
  QuizAnswerSubmission,
} from '../repositories/learning.repository';
import { assertStudent, requireUnlockedQuiz } from './learning-guards';

type RegisterQuizRoutesOptions = {
  jwtSecret: string;
  learningRepository: LearningRepository;
};

type AuthenticatedRequest = {
  user: AuthTokenPayload;
};

type QuizSubmissionBody = {
  answers?: QuizAnswerSubmission[];
};

export async function registerQuizRoutes(
  fastify: FastifyInstance,
  options: RegisterQuizRoutesOptions,
) {
  const authenticateRequest = buildAuthenticateRequest({
    jwtSecret: options.jwtSecret,
  });

  fastify.get(
    '/quiz/modules/:moduleId/start',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) return;

      const moduleId = Number((request.params as { moduleId: string }).moduleId);
      if (!Number.isFinite(moduleId) || moduleId <= 0) {
        return reply.status(400).send({ message: 'ID do modulo invalido.' });
      }

      try {
        const status = await requireUnlockedQuiz({
          learningRepository: options.learningRepository,
          studentId: Number(authenticatedRequest.user.sub),
          moduleId,
          reply,
          purpose: 'start',
        });
        if (!status) return;

        const questions = await options.learningRepository.listQuizQuestionsByModule(
          moduleId,
        );

        if (questions.length === 0) {
          return reply.status(404).send({
            message: 'Nenhuma questao encontrada para este modulo.',
          });
        }

        return {
          moduleId,
          latestQuizResult: status.latestQuizResult,
          totalQuestions: questions.length,
          questions: questions.map(({ id, moduleId: questionModuleId, prompt, options }) => ({
            id,
            moduleId: questionModuleId,
            prompt,
            options,
          })),
        };
      } catch (error) {
        return reply.status(500).send({ message: 'Erro ao iniciar o simulado.' });
      }
    },
  );

  fastify.post(
    '/quiz/modules/:moduleId/submit',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) return;

      const moduleId = Number((request.params as { moduleId: string }).moduleId);
      const { answers } = request.body as QuizSubmissionBody;

      if (!Number.isFinite(moduleId) || moduleId <= 0) {
        return reply.status(400).send({ message: 'ID do modulo invalido.' });
      }

      if (!Array.isArray(answers)) {
        return reply.status(400).send({ message: 'Formato de respostas invalido.' });
      }

      try {
        const status = await requireUnlockedQuiz({
          learningRepository: options.learningRepository,
          studentId: Number(authenticatedRequest.user.sub),
          moduleId,
          reply,
          purpose: 'submit',
        });
        if (!status) return;

        const result = await options.learningRepository.evaluateQuizAnswers(
          moduleId,
          answers,
        );
        const savedAttempt = await options.learningRepository.recordQuizAttempt(
          Number(authenticatedRequest.user.sub),
          moduleId,
          result,
        );

        return {
          moduleId,
          totalQuestions: savedAttempt.totalQuestions,
          correctAnswers: savedAttempt.correctAnswers,
          wrongAnswers: savedAttempt.wrongAnswers,
          percentageCorrect: savedAttempt.percentageCorrect,
          passed: savedAttempt.passed,
          completedAt: savedAttempt.completedAt,
          results: result.results.map((item) => ({
            questionId: item.questionId,
            isCorrect: item.correct,
            selectedOptionIndex: item.selectedOptionIndex,
            correctOptionIndex: item.correctOptionIndex,
            explanation: item.explanation,
          })),
        };
      } catch (error) {
        return reply.status(500).send({ message: 'Erro ao avaliar o simulado.' });
      }
    },
  );
}
