import { FastifyReply, FastifyRequest } from 'fastify';
import { InvalidTokenError, verifyToken } from '../services/jwt.service';

type AuthenticateRequestOptions = {
  jwtSecret: string;
};

export function buildAuthenticateRequest(options: AuthenticateRequestOptions) {
  return async function authenticateRequest(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        message: 'Sua sessão expirou ou não foi informada. Faça login novamente.',
      });
    }

    const token = authorizationHeader.slice('Bearer '.length);

    try {
      const authenticatedRequest = request as FastifyRequest & {
        user: ReturnType<typeof verifyToken>;
      };
      authenticatedRequest.user = verifyToken(token, options.jwtSecret);
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        return reply.status(401).send({
          message: 'Sua sessão expirou ou não foi informada. Faça login novamente.',
        });
      }

      throw error;
    }
  };
}
