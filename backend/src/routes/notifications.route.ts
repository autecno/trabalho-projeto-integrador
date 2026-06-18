import { FastifyInstance } from 'fastify';
import { buildAuthenticateRequest } from '../middlewares/auth.middleware';
import { NotificationRepository } from '../repositories/notification.repository';
import { AuthTokenPayload } from '../services/jwt.service';

type RegisterNotificationsRoutesOptions = {
  jwtSecret: string;
  notificationRepository: NotificationRepository;
};

type AuthenticatedRequest = {
  user: AuthTokenPayload;
};

export async function registerNotificationsRoutes(
  fastify: FastifyInstance,
  options: RegisterNotificationsRoutesOptions,
) {
  const authenticateRequest = buildAuthenticateRequest({
    jwtSecret: options.jwtSecret,
  });

  fastify.get(
    '/notifications',
    { preHandler: authenticateRequest },
    async (request) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      const userId = Number(authenticatedRequest.user.sub);
      const [items, unreadCount] = await Promise.all([
        options.notificationRepository.listByUser(userId, 10),
        options.notificationRepository.countUnreadByUser(userId),
      ]);

      return {
        unreadCount,
        items: items.map((notification) => ({
          id: notification.id,
          appointmentId: notification.appointmentId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          readAt: notification.readAt?.toISOString() ?? null,
          createdAt: notification.createdAt.toISOString(),
        })),
      };
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      const userId = Number(authenticatedRequest.user.sub);
      const notificationId = Number(request.params.id);

      if (!Number.isFinite(notificationId) || notificationId <= 0) {
        return reply.status(400).send({
          message: 'Notificação inválida.',
        });
      }

      const updated = await options.notificationRepository.markAsRead(
        notificationId,
        userId,
      );

      if (!updated) {
        return reply.status(404).send({
          message: 'Notificação não encontrada.',
        });
      }

      return reply.status(204).send();
    },
  );

  fastify.patch(
    '/notifications/read-all',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      const userId = Number(authenticatedRequest.user.sub);

      await options.notificationRepository.markAllAsRead(userId);

      return reply.status(204).send();
    },
  );
}
