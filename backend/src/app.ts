import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerAppointmentsRoutes } from './routes/appointments.route';
import { registerAuthRoutes } from './routes/auth.route';
import { registerHealthRoutes } from './routes/health.route';
import { registerInstructorRoutes } from './routes/instructors.route';
import { registerLearningRoutes } from './routes/learning.route';
import { registerNotificationsRoutes } from './routes/notifications.route';
import { registerProfileRoutes } from './routes/profile.route';
import { registerQuizRoutes } from './routes/quiz.route';
import { registerUserRoutes } from './routes/users.route';
import { AppointmentRepository } from './repositories/appointment.repository';
import { LearningRepository } from './repositories/learning.repository';
import { NotificationRepository } from './repositories/notification.repository';
import { UserRepository } from './repositories/user.repository';
import { AppointmentReminderQueue } from './queues/appointment-reminder.queue';

type BuildAppOptions = {
  userRepository: UserRepository;
  appointmentRepository: AppointmentRepository;
  learningRepository: LearningRepository;
  notificationRepository?: NotificationRepository;
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
  await registerLearningRoutes(fastify, {
    jwtSecret,
    learningRepository: options.learningRepository,
  });
  await registerQuizRoutes(fastify, {
    jwtSecret,
    learningRepository: options.learningRepository,
  });
  if (options.notificationRepository) {
    await registerNotificationsRoutes(fastify, {
      jwtSecret,
      notificationRepository: options.notificationRepository,
    });
  }
  await registerInstructorRoutes(fastify, {
    jwtSecret,
    userRepository: options.userRepository,
  });
  await registerAppointmentsRoutes(fastify, {
    jwtSecret,
    userRepository: options.userRepository,
    appointmentRepository: options.appointmentRepository,
    ...(options.notificationRepository
      ? { notificationRepository: options.notificationRepository }
      : {}),
    ...(options.appointmentReminderQueue
      ? { appointmentReminderQueue: options.appointmentReminderQueue }
      : {}),
  });
  await registerUserRoutes(fastify, {
    userRepository: options.userRepository,
  });

  return fastify;
}
