import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { Appointment } from '../repositories/appointment.repository';

export const APPOINTMENT_REMINDER_QUEUE = 'appointment-reminders';

export type AppointmentReminderType = '24h-before' | '1h-before' | '15m-before';

export type AppointmentReminderJobData = {
  appointmentId: number;
  reminderType: AppointmentReminderType;
};

type ReminderOffset = {
  type: AppointmentReminderType;
  milliseconds: number;
};

const REMINDER_OFFSETS: ReminderOffset[] = [
  { type: '24h-before', milliseconds: 24 * 60 * 60 * 1000 },
  { type: '1h-before', milliseconds: 60 * 60 * 1000 },
  { type: '15m-before', milliseconds: 15 * 60 * 1000 },
];

export type AppointmentReminderQueue = Queue<AppointmentReminderJobData>;

export type ScheduledAppointmentReminderJob = {
  reminderType: AppointmentReminderType;
  delay: number;
  jobId: string;
};

export type AppointmentReminderScheduleResult = {
  scheduled: ScheduledAppointmentReminderJob[];
  skipped: AppointmentReminderType[];
};

export function createAppointmentReminderQueue(
  connection: Redis,
): AppointmentReminderQueue {
  return new Queue<AppointmentReminderJobData>(APPOINTMENT_REMINDER_QUEUE, {
    connection,
  });
}

export async function scheduleAppointmentReminderJobs(
  queue: AppointmentReminderQueue,
  appointment: Pick<Appointment, 'id' | 'scheduledAt'>,
): Promise<AppointmentReminderScheduleResult> {
  const scheduledAtTime = appointment.scheduledAt.getTime();
  const now = Date.now();
  const scheduled: ScheduledAppointmentReminderJob[] = [];
  const skipped: AppointmentReminderType[] = [];

  await Promise.all(
    REMINDER_OFFSETS.map(async (reminder) => {
      const delay = scheduledAtTime - reminder.milliseconds - now;

      if (delay <= 0) {
        skipped.push(reminder.type);
        return;
      }

      const jobId = buildAppointmentReminderJobId(appointment.id, reminder.type);
      await queue.add(
        'appointment-reminder',
        {
          appointmentId: appointment.id,
          reminderType: reminder.type,
        },
        {
          delay,
          jobId,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            count: 100,
          },
          removeOnFail: {
            count: 50,
          },
        },
      );
      scheduled.push({
        reminderType: reminder.type,
        delay,
        jobId,
      });
    }),
  );

  if (scheduled.length === 0 && scheduledAtTime > now) {
    const reminderType: AppointmentReminderType = '15m-before';
    const jobId = buildAppointmentReminderJobId(appointment.id, reminderType);

    await queue.add(
      'appointment-reminder',
      {
        appointmentId: appointment.id,
        reminderType,
      },
      {
        delay: 0,
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 50,
        },
      },
    );
    scheduled.push({
      reminderType,
      delay: 0,
      jobId,
    });
  }

  return {
    scheduled,
    skipped,
  };
}

export async function removeAppointmentReminderJobs(
  queue: AppointmentReminderQueue,
  appointmentId: number,
) {
  await Promise.all(
    REMINDER_OFFSETS.map(async (reminder) => {
      const job = await queue.getJob(
        buildAppointmentReminderJobId(appointmentId, reminder.type),
      );

      if (job) {
        await job.remove();
      }
    }),
  );
}

function buildAppointmentReminderJobId(
  appointmentId: number,
  reminderType: AppointmentReminderType,
) {
  return `appointment-reminder:${appointmentId}:${reminderType}`;
}
