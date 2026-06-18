import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import mysql from 'mysql2/promise';
import { APPOINTMENT_REMINDER_QUEUE, AppointmentReminderJobData } from '../queues/appointment-reminder.queue';
import { createRedisConnection } from '../queues/redis-connection';
import { MySqlAppointmentRepository } from '../repositories/appointment.repository';
import { MySqlNotificationRepository } from '../repositories/notification.repository';
import { MySqlUserRepository } from '../repositories/user.repository';

dotenv.config();

async function startWorker() {
  const mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'autecno',
  });

  const userRepository = new MySqlUserRepository(mysqlPool);
  const appointmentRepository = new MySqlAppointmentRepository(mysqlPool);
  const notificationRepository = new MySqlNotificationRepository(mysqlPool);
  await userRepository.ensureSchema();
  await appointmentRepository.ensureSchema();
  await notificationRepository.ensureSchema();

  const connection = createRedisConnection();
  await connection.ping();
  console.info('Redis connected for appointment reminder worker.');

  const worker = new Worker<AppointmentReminderJobData>(
    APPOINTMENT_REMINDER_QUEUE,
    async (job) => {
      console.info(
        `Processing reminder job ${job.id} for appointment ${job.data.appointmentId} (${job.data.reminderType}).`,
      );

      const appointment = await appointmentRepository.findById(
        job.data.appointmentId,
      );

      if (!appointment) {
        console.info(`Appointment ${job.data.appointmentId} not found. Skipping.`);
        return;
      }

      if (!['pending', 'confirmed'].includes(appointment.status)) {
        console.info(
          `Appointment ${appointment.id} has status ${appointment.status}. Skipping reminder.`,
        );
        return;
      }

      if (appointment.scheduledAt.getTime() <= Date.now()) {
        console.info(`Appointment ${appointment.id} is no longer upcoming. Skipping.`);
        return;
      }

      const formattedDate = appointment.scheduledAt.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      });

      await notificationRepository.createAppointmentReminder({
        userId: appointment.studentId,
        appointmentId: appointment.id,
        reminderType: job.data.reminderType,
        title: 'Lembrete de aula',
        message: `Sua aula com ${appointment.instructorName} sera em ${formattedDate}.`,
      });

      console.info(
        `Reminder ${job.data.reminderType} processed for appointment ${appointment.id}.`,
      );
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, error) => {
    console.error(
      `Reminder job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      error,
    );
  });

  worker.on('error', (error) => {
    console.error(`Reminder worker error: ${error.message}`, error);
  });

  worker.on('active', (job) => {
    console.info(`Reminder job ${job.id} is active.`);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`Reminder job ${jobId} stalled and will be retried.`);
  });

  worker.on('completed', (job) => {
    console.info(`Reminder job ${job.id} completed.`);
  });

  const shutdown = async () => {
    await worker.close();
    await connection.quit();
    await mysqlPool.end();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  console.info(`Worker listening on queue ${APPOINTMENT_REMINDER_QUEUE}.`);
}

startWorker().catch((error) => {
  console.error(error);
  process.exit(1);
});
