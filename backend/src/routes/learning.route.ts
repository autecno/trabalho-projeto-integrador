import { FastifyInstance } from 'fastify';
import { buildAuthenticateRequest } from '../middlewares/auth.middleware';
import { AuthTokenPayload } from '../services/jwt.service';
import {
  LearningRepository,
  QuizAnswerSubmission,
} from '../repositories/learning.repository';

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

function assertStudent(user: AuthTokenPayload, reply: any) {
  if (user.role !== 'student') {
    reply.status(403).send({ message: 'Apenas alunos podem acessar este recurso.' });
    return false;
  }

  return true;
}

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
      if (!assertStudent(authenticatedRequest.user, reply)) {
        return;
      }

      const modules = await options.learningRepository.listModulesByStudent(
        Number(authenticatedRequest.user.sub),
      );

      return modules;
    },
  );

  fastify.get(
    '/learning/modules/:moduleId',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) {
        return;
      }

      const params = request.params as { moduleId: string };
      const moduleId = Number(params.moduleId);
      if (!Number.isFinite(moduleId) || moduleId <= 0) {
        return reply.status(400).send({ message: 'moduleId inválido.' });
      }

      const module = await options.learningRepository.findModuleById(
        moduleId,
        Number(authenticatedRequest.user.sub),
      );

      if (!module) {
        return reply.status(404).send({ message: 'Módulo não encontrado.' });
      }

      return module;
    },
  );

  fastify.get(
    '/learning/contents/:contentId',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) {
        return;
      }

      const params = request.params as { contentId: string };
      const contentId = Number(params.contentId);
      if (!Number.isFinite(contentId) || contentId <= 0) {
        return reply.status(400).send({ message: 'contentId inválido.' });
      }

      const content = await options.learningRepository.findContentById(contentId);
      if (!content) {
        return reply.status(404).send({ message: 'Conteúdo não encontrado.' });
      }

      return content;
    },
  );

  fastify.post(
    '/learning/contents/:contentId/progress',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) {
        return;
      }

      const params = request.params as { contentId: string };
      const contentId = Number(params.contentId);
      if (!Number.isFinite(contentId) || contentId <= 0) {
        return reply.status(400).send({ message: 'contentId inválido.' });
      }

      const content = await options.learningRepository.findContentById(contentId);
      if (!content) {
        return reply.status(404).send({ message: 'Conteúdo não encontrado.' });
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
      if (!assertStudent(authenticatedRequest.user, reply)) {
        return;
      }

      const params = request.params as { moduleId: string };
      const moduleId = Number(params.moduleId);
      if (!Number.isFinite(moduleId) || moduleId <= 0) {
        return reply.status(400).send({ message: 'moduleId inválido.' });
      }

      const questions = await options.learningRepository.listQuizQuestionsByModule(moduleId);
      return questions;
    },
  );

  fastify.post<{ Body: QuizSubmissionBody }>(
    '/learning/modules/:moduleId/quiz/submit',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (!assertStudent(authenticatedRequest.user, reply)) {
        return;
      }

      const params = request.params as { moduleId: string };
      const moduleId = Number(params.moduleId);
      if (!Number.isFinite(moduleId) || moduleId <= 0) {
        return reply.status(400).send({ message: 'moduleId inválido.' });
      }

      const result = await options.learningRepository.evaluateQuizAnswers(
        moduleId,
        request.body?.answers ?? [],
      );

      return result;
    },
  );
}
