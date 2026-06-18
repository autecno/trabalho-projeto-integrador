import { FastifyInstance } from 'fastify';
import { buildAuthenticateRequest } from '../middlewares/auth.middleware';
import { AuthTokenPayload } from '../services/jwt.service';
import {
  LearningRepository,
  QuizAnswerSubmission,
} from '../repositories/learning.repository';

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

function assertStudent(user: AuthTokenPayload, reply: any) {
  if (user.role !== 'student') {
    reply.status(403).send({ message: 'Apenas alunos podem acessar este recurso.' });
    return false;
  }

  return true;
}

export async function registerQuizRoutes(
  fastify: FastifyInstance,
  options: RegisterQuizRoutesOptions,
) {
  const authenticateRequest = buildAuthenticateRequest({
    jwtSecret: options.jwtSecret,
  });

  /**
   * GET /quiz/modules/:moduleId/start
   * Returns quiz questions for a module to start a new mock exam
   * Requires authentication and student role
   */
  fastify.get(
    '/quiz/modules/:moduleId/start',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) {
        return;
      }

      const { moduleId } = request.params as { moduleId: string };
      const moduleIdNumber = Number(moduleId);

      if (isNaN(moduleIdNumber)) {
        reply.status(400).send({ message: 'ID do módulo inválido.' });
        return;
      }

      try {
        const status = await options.learningRepository.getModuleStatus(
          Number(authenticatedRequest.user.sub),
          moduleIdNumber,
        );
        if (!status) {
          reply.status(404).send({ message: 'MÃ³dulo nÃ£o encontrado.' });
          return;
        }

        if (!status.quizUnlocked) {
          reply.status(409).send({
            message: 'Conclua todos os conteÃºdos do mÃ³dulo antes de iniciar a prova.',
            progress: status,
          });
          return;
        }

        const questions = await options.learningRepository.listQuizQuestionsByModule(
          moduleIdNumber,
        );

        if (!questions || questions.length === 0) {
          reply.status(404).send({ message: 'Nenhuma questão encontrada para este módulo.' });
          return;
        }

        reply.send({
          moduleId: moduleIdNumber,
          latestQuizResult: status.latestQuizResult,
          questions: questions.map((q) => ({
            id: q.id,
            moduleId: q.moduleId,
            prompt: q.prompt,
            options: q.options,
          })),
          totalQuestions: questions.length,
        });
      } catch (error) {
        reply.status(500).send({ message: 'Erro ao iniciar o simulado.' });
      }
    },
  );

  /**
   * POST /quiz/modules/:moduleId/submit
   * Evaluates quiz answers and returns result with scores
   * Requires authentication and student role
   */
  fastify.post(
    '/quiz/modules/:moduleId/submit',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) {
        return;
      }

      const { moduleId } = request.params as { moduleId: string };
      const { answers } = request.body as QuizSubmissionBody;

      const moduleIdNumber = Number(moduleId);

      if (isNaN(moduleIdNumber)) {
        reply.status(400).send({ message: 'ID do módulo inválido.' });
        return;
      }

      if (!answers || !Array.isArray(answers)) {
        reply.status(400).send({ message: 'Formato de respostas inválido.' });
        return;
      }

      try {
        const status = await options.learningRepository.getModuleStatus(
          Number(authenticatedRequest.user.sub),
          moduleIdNumber,
        );
        if (!status) {
          reply.status(404).send({ message: 'MÃ³dulo nÃ£o encontrado.' });
          return;
        }

        if (!status.quizUnlocked) {
          reply.status(409).send({
            message: 'Conclua todos os conteÃºdos do mÃ³dulo antes de enviar a prova.',
            progress: status,
          });
          return;
        }

        const result = await options.learningRepository.evaluateQuizAnswers(
          moduleIdNumber,
          answers,
        );
        const savedAttempt = await options.learningRepository.recordQuizAttempt(
          Number(authenticatedRequest.user.sub),
          moduleIdNumber,
          result,
        );

        reply.send({
          moduleId: moduleIdNumber,
          totalQuestions: savedAttempt.totalQuestions,
          correctAnswers: savedAttempt.correctAnswers,
          wrongAnswers: savedAttempt.wrongAnswers,
          percentageCorrect: savedAttempt.percentageCorrect,
          passed: savedAttempt.passed,
          completedAt: savedAttempt.completedAt,
          results: result.results.map((r) => ({
            questionId: r.questionId,
            isCorrect: r.correct,
            selectedOptionIndex: r.selectedOptionIndex,
            correctOptionIndex: r.correctOptionIndex,
            explanation: r.explanation,
          })),
        });
      } catch (error) {
        reply.status(500).send({ message: 'Erro ao avaliar o simulado.' });
      }
    },
  );
}
