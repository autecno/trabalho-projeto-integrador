import { FastifyInstance } from 'fastify';
import { buildAuthenticateRequest } from '../middlewares/auth.middleware';
import { AppointmentRatingRepository } from '../repositories/appointment-rating.repository';
import { UserRepository } from '../repositories/user.repository';

type RegisterInstructorRoutesOptions = {
  jwtSecret: string;
  userRepository: UserRepository;
  appointmentRatingRepository: AppointmentRatingRepository;
};

export async function registerInstructorRoutes(
  fastify: FastifyInstance,
  options: RegisterInstructorRoutesOptions,
) {
  const authenticateRequest = buildAuthenticateRequest({
    jwtSecret: options.jwtSecret,
  });

  fastify.get(
    '/instructors',
    { preHandler: authenticateRequest },
    async () => {
      const instructors = await options.userRepository.listInstructors();
      const ratingSummaries =
        await options.appointmentRatingRepository.listReceivedSummariesByUserIds(
          instructors.map((instructor) => instructor.id),
        );
      const ratingSummaryByUserId = new Map(
        ratingSummaries.map((summary) => [summary.userId, summary]),
      );

      return instructors.map((instructor) => ({
        id: instructor.id,
        name: instructor.name,
        averageRating: ratingSummaryByUserId.get(instructor.id)?.averageScore ?? null,
        totalRatings: ratingSummaryByUserId.get(instructor.id)?.totalRatings ?? 0,
      }));
    },
  );
}
