import { FastifyInstance } from 'fastify';
import { buildAuthenticateRequest } from '../middlewares/auth.middleware';
import { AuthTokenPayload } from '../services/jwt.service';
import {
  LearningRepository,
  QuizAnswerSubmission,
} from '../repositories/learning.repository';
import { assertStudent, requireUnlockedQuiz } from './learning-guards';

type RegisterLearningRoutesOptions = {
  jwtSecret: string;
  learningRepository: LearningRepository;
};

type AuthenticatedRequest = {
  user: AuthTokenPayload;
};

type QuizSubmissionBody = {
  answers?: QuizAnswerSubmission[];
};

export async function registerLearningRoutes(
  fastify: FastifyInstance,
  options: RegisterLearningRoutesOptions,
) {
  const authenticateRequest = buildAuthenticateRequest({
    jwtSecret: options.jwtSecret,
  });

  fastify.get(
    '/learning/modules',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) return;

      return options.learningRepository.listModulesByStudent(
        Number(authenticatedRequest.user.sub),
      );
    },
  );

  fastify.get(
    '/learning/modules/:moduleId',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) return;

      const moduleId = Number((request.params as { moduleId: string }).moduleId);
      if (!Number.isFinite(moduleId) || moduleId <= 0) {
        return reply.status(400).send({ message: 'moduleId invalido.' });
      }

      const module = await options.learningRepository.findModuleById(
        moduleId,
        Number(authenticatedRequest.user.sub),
      );

      if (!module) {
        return reply.status(404).send({ message: 'Modulo nao encontrado.' });
      }

      return module;
    },
  );

  fastify.get(
    '/learning/contents/:contentId',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) return;

      const contentId = Number((request.params as { contentId: string }).contentId);
      if (!Number.isFinite(contentId) || contentId <= 0) {
        return reply.status(400).send({ message: 'contentId invalido.' });
      }

      const content = await options.learningRepository.findContentById(contentId);
      if (!content) {
        return reply.status(404).send({ message: 'Conteudo nao encontrado.' });
      }

      return content;
    },
  );

  fastify.post(
    '/learning/contents/:contentId/progress',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) return;

      const contentId = Number((request.params as { contentId: string }).contentId);
      if (!Number.isFinite(contentId) || contentId <= 0) {
        return reply.status(400).send({ message: 'contentId invalido.' });
      }

      const content = await options.learningRepository.findContentById(contentId);
      if (!content) {
        return reply.status(404).send({ message: 'Conteudo nao encontrado.' });
      }

      await options.learningRepository.recordContentProgress(
        Number(authenticatedRequest.user.sub),
        contentId,
      );

      return reply.status(204).send();
    },
  );

  fastify.get(
    '/learning/modules/:moduleId/quiz',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) return;

      const moduleId = Number((request.params as { moduleId: string }).moduleId);
      if (!Number.isFinite(moduleId) || moduleId <= 0) {
        return reply.status(400).send({ message: 'moduleId invalido.' });
      }

      const status = await requireUnlockedQuiz({
        learningRepository: options.learningRepository,
        studentId: Number(authenticatedRequest.user.sub),
        moduleId,
        reply,
        purpose: 'start',
      });
      if (!status) return;

      return options.learningRepository.listQuizQuestionsByModule(moduleId);
    },
  );

  fastify.post<{ Body: QuizSubmissionBody }>(
    '/learning/modules/:moduleId/quiz/submit',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) return;

      const moduleId = Number((request.params as { moduleId: string }).moduleId);
      if (!Number.isFinite(moduleId) || moduleId <= 0) {
        return reply.status(400).send({ message: 'moduleId invalido.' });
      }

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
        request.body?.answers ?? [],
      );
      await options.learningRepository.recordQuizAttempt(
        Number(authenticatedRequest.user.sub),
        moduleId,
        result,
      );

      return result;
    },
  );
}
