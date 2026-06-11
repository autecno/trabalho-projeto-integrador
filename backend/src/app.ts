import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerAppointmentsRoutes } from './routes/appointments.route';
import { registerAuthRoutes } from './routes/auth.route';
import { registerHealthRoutes } from './routes/health.route';
import { registerInstructorRoutes } from './routes/instructors.route';
import { registerProfileRoutes } from './routes/profile.route';
import { registerUserRoutes } from './routes/users.route';
import { AppointmentRatingRepository } from './repositories/appointment-rating.repository';
import { AppointmentRepository } from './repositories/appointment.repository';
import { UserRepository } from './repositories/user.repository';
import { AppointmentReminderQueue } from './queues/appointment-reminder.queue';

type BuildAppOptions = {
  userRepository: UserRepository;
  appointmentRepository: AppointmentRepository;
  appointmentRatingRepository: AppointmentRatingRepository;
  jwtSecret?: string;
  appointmentReminderQueue?: AppointmentReminderQueue;
};

export async function buildApp(options: BuildAppOptions) {
  const fastify = Fastify({ logger: true });
  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET ?? 'supersecretjwt';

  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await registerHealthRoutes(fastify);
  await registerAuthRoutes(fastify, {
    userRepository: options.userRepository,
    jwtSecret,
  });
  await registerProfileRoutes(fastify, {
    jwtSecret,
  });
  await registerInstructorRoutes(fastify, {
    jwtSecret,
    userRepository: options.userRepository,
    appointmentRatingRepository: options.appointmentRatingRepository,
  });
  await registerAppointmentsRoutes(
    fastify,
    options.appointmentReminderQueue
      ? {
          jwtSecret,
          userRepository: options.userRepository,
          appointmentRepository: options.appointmentRepository,
          appointmentRatingRepository: options.appointmentRatingRepository,
          appointmentReminderQueue: options.appointmentReminderQueue,
        }
      : {
          jwtSecret,
          userRepository: options.userRepository,
          appointmentRepository: options.appointmentRepository,
          appointmentRatingRepository: options.appointmentRatingRepository,
        },
  );
  await registerUserRoutes(fastify, {
    userRepository: options.userRepository,
  });

  return fastify;
}
