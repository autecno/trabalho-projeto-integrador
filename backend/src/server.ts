import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { buildApp } from './app';
import { createAppointmentReminderQueue } from './queues/appointment-reminder.queue';
import { createRedisConnection } from './queues/redis-connection';
import { MySqlAppointmentRatingRepository } from './repositories/appointment-rating.repository';
import { MySqlAppointmentRepository } from './repositories/appointment.repository';
import { MySqlNotificationRepository } from './repositories/notification.repository';
import { MySqlUserRepository } from './repositories/user.repository';

dotenv.config();

// Variables
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333;

// Prepare connections (Optional check on boot)
async function start() {
  try {
    const redis = createRedisConnection();
    await redis.ping();
    const appointmentReminderQueue = createAppointmentReminderQueue(redis);

    // Basic MySQL connection test
    const mysqlPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'autecno',
    });

    await mysqlPool.query('SELECT 1');
    const userRepository = new MySqlUserRepository(mysqlPool);
    await userRepository.ensureSchema();
    const appointmentRepository = new MySqlAppointmentRepository(mysqlPool);
    await appointmentRepository.ensureSchema();
    const appointmentRatingRepository = new MySqlAppointmentRatingRepository(mysqlPool);
    await appointmentRatingRepository.ensureSchema();
    const notificationRepository = new MySqlNotificationRepository(mysqlPool);
    await notificationRepository.ensureSchema();

    const fastify = await buildApp({
      userRepository,
      appointmentRepository,
      appointmentRatingRepository,
      appointmentReminderQueue,
    });

    fastify.log.info('Redis connected for appointment reminder queue.');
    fastify.log.info('MySQL connected (preparado)');

    fastify.addHook('onClose', async () => {
      await appointmentReminderQueue.close();
      await redis.quit();
      await mysqlPool.end();
    });

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Server listening on http://0.0.0.0:${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
