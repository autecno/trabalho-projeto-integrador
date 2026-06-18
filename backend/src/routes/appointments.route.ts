import { FastifyInstance } from 'fastify';
import { buildAuthenticateRequest } from '../middlewares/auth.middleware';
import { AuthTokenPayload } from '../services/jwt.service';
import {
  AppointmentRepository,
  AppointmentStatus,
  UpsertInstructorAvailabilityData,
} from '../repositories/appointment.repository';
import { UserRepository } from '../repositories/user.repository';
import {
  AppointmentReminderQueue,
  removeAppointmentReminderJobs,
  scheduleAppointmentReminderJobs,
} from '../queues/appointment-reminder.queue';
import {
  NotificationRepository,
  NotificationType,
} from '../repositories/notification.repository';

type RegisterAppointmentsRoutesOptions = {
  jwtSecret: string;
  userRepository: UserRepository;
  appointmentRepository: AppointmentRepository;
  notificationRepository?: NotificationRepository;
  appointmentReminderQueue?: AppointmentReminderQueue;
};

type CreateAppointmentBody = {
  instructorId?: number;
  scheduledAt?: string;
  notes?: string;
};

type UpdateAppointmentStatusBody = {
  status?: AppointmentStatus;
  cancellationReason?: string;
};

type AvailabilitySettingsBody = {
  intervals?: UpsertInstructorAvailabilityData[];
};

const STUDENT_ALLOWED_STATUS: AppointmentStatus[] = ['cancelled'];
const INSTRUCTOR_ALLOWED_STATUS: AppointmentStatus[] = [
  'confirmed',
  'rejected',
  'cancelled',
  'completed',
];
const STATUS_WITHOUT_PENDING_REMINDERS: AppointmentStatus[] = [
  'cancelled',
  'rejected',
  'completed',
];
const STATUS_NOTIFICATION: Record<
  AppointmentStatus,
  { type: NotificationType; title: string }
> = {
  pending: {
    type: 'appointment-requested',
    title: 'Nova solicitação de aula',
  },
  confirmed: {
    type: 'appointment-confirmed',
    title: 'Aula confirmada',
  },
  rejected: {
    type: 'appointment-rejected',
    title: 'Aula recusada',
  },
  cancelled: {
    type: 'appointment-cancelled',
    title: 'Aula cancelada',
  },
  completed: {
    type: 'appointment-completed',
    title: 'Aula concluída',
  },
};

type AuthenticatedRequest = {
  user: AuthTokenPayload;
};

export async function registerAppointmentsRoutes(
  fastify: FastifyInstance,
  options: RegisterAppointmentsRoutesOptions,
) {
  const authenticateRequest = buildAuthenticateRequest({
    jwtSecret: options.jwtSecret,
  });

  fastify.get(
    '/appointments',
    { preHandler: authenticateRequest },
    async (request) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      const userId = Number(authenticatedRequest.user.sub);

      const appointments =
        authenticatedRequest.user.role === 'student'
          ? await options.appointmentRepository.listByStudent(userId)
          : await options.appointmentRepository.listByInstructor(userId);

      return appointments.map((appointment) => ({
        id: appointment.id,
        studentId: appointment.studentId,
        studentName: appointment.studentName,
        instructorId: appointment.instructorId,
        instructorName: appointment.instructorName,
        scheduledAt: appointment.scheduledAt.toISOString(),
        status: appointment.status,
        notes: appointment.notes,
        cancellationReason: appointment.cancellationReason,
      }));
    },
  );

  fastify.get(
    '/appointments/next',
    { preHandler: authenticateRequest },
    async (request) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      const userId = Number(authenticatedRequest.user.sub);

      if (authenticatedRequest.user.role !== 'student') {
        return { nextAppointment: null };
      }

      const appointment = await options.appointmentRepository.findNextByStudent(
        userId,
        new Date(),
      );

      return {
        nextAppointment: appointment
          ? {
              id: appointment.id,
              instructorId: appointment.instructorId,
              instructorName: appointment.instructorName,
              scheduledAt: appointment.scheduledAt.toISOString(),
              status: appointment.status,
            }
          : null,
      };
    },
  );

  fastify.get(
    '/appointments/availability-settings',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;

      if (authenticatedRequest.user.role !== 'instructor') {
        return reply.status(403).send({
          message: 'Somente instrutores podem configurar disponibilidade.',
        });
      }

      const instructorId = Number(authenticatedRequest.user.sub);
      const intervals =
        await options.appointmentRepository.listAvailabilityByInstructor(
          instructorId,
        );

      return { intervals };
    },
  );

  fastify.put<{ Body: AvailabilitySettingsBody }>(
    '/appointments/availability-settings',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;

      if (authenticatedRequest.user.role !== 'instructor') {
        return reply.status(403).send({
          message: 'Somente instrutores podem configurar disponibilidade.',
        });
      }

      const intervals = request.body?.intervals ?? [];
      const validationError = validateAvailabilityIntervals(intervals);
      if (validationError) {
        return reply.status(400).send({
          message: validationError,
        });
      }

      const instructorId = Number(authenticatedRequest.user.sub);
      const savedIntervals =
        await options.appointmentRepository.replaceAvailability(
          instructorId,
          intervals,
        );

      return { intervals: savedIntervals };
    },
  );

  fastify.get(
    '/appointments/availability',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const query = request.query as { instructorId?: string; date?: string };
      const instructorId = Number(query.instructorId);
      const dateRaw = query.date;

      if (!Number.isFinite(instructorId) || instructorId <= 0 || !dateRaw) {
        return reply.status(400).send({
          message: 'instructorId e date são obrigatórios.',
        });
      }

      const instructor = await options.userRepository.findById(instructorId);
      if (!instructor || instructor.role !== 'instructor') {
        return reply.status(404).send({
          message: 'Instrutor não encontrado.',
        });
      }

      const dateStart = buildSaoPauloDate(dateRaw, 0, 0);
      if (Number.isNaN(dateStart.getTime())) {
        return reply.status(400).send({
          message: 'Data inválida.',
        });
      }

      const dateEnd = new Date(dateStart);
      dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);

      const appointments = await options.appointmentRepository.listForInstructorOnDate(
        instructorId,
        dateStart,
        dateEnd,
      );

      const busySlots = new Set(
        appointments
          .filter((appointment) =>
            ['pending', 'confirmed'].includes(appointment.status),
          )
          .map((appointment) => appointment.scheduledAt.toISOString()),
      );

      const weekday = getSaoPauloWeekday(dateStart);
      const intervals = (
        await options.appointmentRepository.listAvailabilityByInstructor(
          instructorId,
        )
      ).filter((interval) => interval.weekday === weekday);

      const daySlots = intervals.flatMap((interval) => {
        const slots: Array<{ scheduledAt: string; available: boolean }> = [];
        const startParts = parseTimeParts(interval.startTime);
        const endParts = parseTimeParts(interval.endTime);
        if (!startParts || !endParts) {
          return slots;
        }

        const [startHour, startMinute] = startParts;
        const [endHour, endMinute] = endParts;
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        for (
          let slotMinutes = startMinutes;
          slotMinutes + 60 <= endMinutes;
          slotMinutes += 60
        ) {
          const hour = Math.floor(slotMinutes / 60);
          const minute = slotMinutes % 60;
          const slotDate = buildSaoPauloDate(dateRaw, hour, minute);
        const iso = slotDate.toISOString();
          slots.push({
            scheduledAt: iso,
            available: !busySlots.has(iso) && slotDate.getTime() > Date.now(),
          });
        }

        return slots;
      });

      return {
        instructorId,
        date: dateRaw,
        slots: daySlots,
      };
    },
  );

  fastify.post<{ Body: CreateAppointmentBody }>(
    '/appointments',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      if (authenticatedRequest.user.role !== 'student') {
        return reply.status(403).send({
          message: 'Somente alunos podem criar agendamentos.',
        });
      }

      const studentId = Number(authenticatedRequest.user.sub);
      const instructorId = Number(request.body?.instructorId);
      const scheduledAtRaw = request.body?.scheduledAt;

      if (!Number.isFinite(instructorId) || instructorId <= 0 || !scheduledAtRaw) {
        return reply.status(400).send({
          message: 'instructorId e scheduledAt são obrigatórios.',
        });
      }

      if (studentId === instructorId) {
        return reply.status(400).send({
          message: 'Você não pode agendar uma aula consigo mesmo.',
        });
      }

      const instructor = await options.userRepository.findById(instructorId);
      if (!instructor || instructor.role !== 'instructor') {
        return reply.status(400).send({
          message: 'O instructorId informado é inválido.',
        });
      }

      const scheduledAt = new Date(scheduledAtRaw);
      if (Number.isNaN(scheduledAt.getTime())) {
        return reply.status(400).send({
          message: 'Data/hora inválida.',
        });
      }

      if (scheduledAt.getTime() <= Date.now()) {
        return reply.status(400).send({
          message: 'A data/hora deve ser futura.',
        });
      }

      const availableAt =
        await options.appointmentRepository.isInstructorAvailableAt(
          instructorId,
          scheduledAt,
        );

      if (!availableAt) {
        return reply.status(409).send({
          message: 'O instrutor não está disponível neste horário.',
        });
      }

      const hasConflict = await options.appointmentRepository.hasConflict(
        instructorId,
        scheduledAt,
      );

      if (hasConflict) {
        return reply.status(409).send({
          message: 'Este horário não está mais disponível.',
        });
      }

      const created = await options.appointmentRepository.create(
        request.body?.notes
          ? {
              studentId,
              instructorId,
              scheduledAt,
              notes: request.body.notes,
            }
          : {
              studentId,
              instructorId,
              scheduledAt,
            },
      );

      if (options.appointmentReminderQueue) {
        try {
          const reminderSchedule = await scheduleAppointmentReminderJobs(
            options.appointmentReminderQueue,
            created,
          );
          request.log.info(
            {
              appointmentId: created.id,
              scheduledReminders: reminderSchedule.scheduled,
              skippedReminders: reminderSchedule.skipped,
            },
            'Appointment reminder jobs scheduled.',
          );
        } catch (error) {
          request.log.error({ err: error }, 'Failed to schedule appointment reminders.');
        }
      }

      if (options.notificationRepository) {
        try {
          await options.notificationRepository.create({
            userId: instructorId,
            appointmentId: created.id,
            type: 'appointment-requested',
            title: 'Nova solicitação de aula',
            message: `${authenticatedRequest.user.name} solicitou uma aula para ${formatNotificationDate(scheduledAt)}.`,
          });
        } catch (error) {
          request.log.error({ err: error }, 'Failed to create appointment request notification.');
        }
      }

      return reply.status(201).send({
        id: created.id,
        studentId: created.studentId,
        instructorId: created.instructorId,
        scheduledAt: created.scheduledAt.toISOString(),
        status: created.status,
        notes: created.notes,
      });
    },
  );

  fastify.patch<{ Params: { id: string }; Body: UpdateAppointmentStatusBody }>(
    '/appointments/:id/status',
    { preHandler: authenticateRequest },
    async (request, reply) => {
      const authenticatedRequest = request as typeof request & AuthenticatedRequest;
      const appointmentId = Number(request.params.id);
      const status = request.body?.status;

      if (!Number.isFinite(appointmentId) || appointmentId <= 0 || !status) {
        return reply.status(400).send({
          message: 'Parâmetros inválidos.',
        });
      }

      const appointment = await options.appointmentRepository.findById(appointmentId);
      if (!appointment) {
        return reply.status(404).send({
          message: 'Agendamento não encontrado.',
        });
      }

      const userId = Number(authenticatedRequest.user.sub);
      if (authenticatedRequest.user.role === 'student') {
        if (appointment.studentId !== userId) {
          return reply.status(403).send({
            message: 'Você não pode alterar esse agendamento.',
          });
        }

        if (!STUDENT_ALLOWED_STATUS.includes(status)) {
          return reply.status(403).send({
            message: 'Aluno só pode cancelar agendamentos.',
          });
        }
      } else if (authenticatedRequest.user.role === 'instructor') {
        if (appointment.instructorId !== userId) {
          return reply.status(403).send({
            message: 'Você não pode alterar esse agendamento.',
          });
        }

        if (!INSTRUCTOR_ALLOWED_STATUS.includes(status)) {
          return reply.status(403).send({
            message: 'Status inválido para instrutor.',
          });
        }
      }

      const updated = await options.appointmentRepository.updateStatus(
        appointmentId,
        request.body?.cancellationReason
          ? {
              status,
              cancellationReason: request.body.cancellationReason,
            }
          : { status },
      );

      if (!updated) {
        return reply.status(404).send({
          message: 'Agendamento não encontrado.',
        });
      }

      if (
        options.appointmentReminderQueue &&
        STATUS_WITHOUT_PENDING_REMINDERS.includes(updated.status)
      ) {
        try {
          await removeAppointmentReminderJobs(
            options.appointmentReminderQueue,
            updated.id,
          );
        } catch (error) {
          request.log.error({ err: error }, 'Failed to remove appointment reminders.');
        }
      }

      if (options.notificationRepository) {
        try {
          const targetUserId =
            authenticatedRequest.user.role === 'student'
              ? updated.instructorId
              : updated.studentId;
          const statusNotification = STATUS_NOTIFICATION[updated.status];

          await options.notificationRepository.create({
            userId: targetUserId,
            appointmentId: updated.id,
            type: statusNotification.type,
            title: statusNotification.title,
            message: buildAppointmentStatusNotificationMessage(
              authenticatedRequest.user.name,
              updated.status,
              updated.scheduledAt,
            ),
          });
        } catch (error) {
          request.log.error({ err: error }, 'Failed to create appointment status notification.');
        }
      }

      return {
        id: updated.id,
        studentId: updated.studentId,
        studentName: updated.studentName,
        instructorId: updated.instructorId,
        instructorName: updated.instructorName,
        scheduledAt: updated.scheduledAt.toISOString(),
        status: updated.status,
        notes: updated.notes,
        cancellationReason: updated.cancellationReason,
      };
    },
  );
}

function validateAvailabilityIntervals(
  intervals: UpsertInstructorAvailabilityData[],
) {
  if (intervals.length > 28) {
    return 'Informe no máximo 28 intervalos de disponibilidade.';
  }

  const byWeekday = new Map<number, Array<{ start: number; end: number }>>();

  for (const interval of intervals) {
    if (!Number.isInteger(interval.weekday) || interval.weekday < 0 || interval.weekday > 6) {
      return 'Dia da semana inválido.';
    }

    const start = parseTimeToMinutes(interval.startTime);
    const end = parseTimeToMinutes(interval.endTime);

    if (start === null || end === null) {
      return 'Use horários no formato HH:mm.';
    }

    if (end - start < 60) {
      return 'Cada intervalo precisa ter pelo menos 1 hora.';
    }

    const current = byWeekday.get(interval.weekday) ?? [];
    if (current.some((saved) => start < saved.end && end > saved.start)) {
      return 'Os intervalos de um mesmo dia não podem se sobrepor.';
    }

    current.push({ start, end });
    byWeekday.set(interval.weekday, current);
  }

  return null;
}

function parseTimeToMinutes(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

    const parts = parseTimeParts(value);
    if (!parts) {
      return null;
    }

    const [hour, minute] = parts;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }

  return hour * 60 + minute;
}

function parseTimeParts(value: string): [number, number] | null {
  const [hourRaw, minuteRaw] = value.split(':');
  if (hourRaw === undefined || minuteRaw === undefined) {
    return null;
  }

  return [Number(hourRaw), Number(minuteRaw)];
}

function getSaoPauloWeekday(date: Date) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return weekdays[weekday] ?? date.getUTCDay();
}

function buildSaoPauloDate(dateRaw: string, hour: number, minute: number) {
  const hourText = String(hour).padStart(2, '0');
  const minuteText = String(minute).padStart(2, '0');

  return new Date(`${dateRaw}T${hourText}:${minuteText}:00-03:00`);
}

function buildAppointmentStatusNotificationMessage(
  actorName: string,
  status: AppointmentStatus,
  scheduledAt: Date,
) {
  const formattedDate = formatNotificationDate(scheduledAt);

  if (status === 'confirmed') {
    return `${actorName} confirmou a aula de ${formattedDate}.`;
  }

  if (status === 'rejected') {
    return `${actorName} recusou a aula de ${formattedDate}.`;
  }

  if (status === 'cancelled') {
    return `${actorName} cancelou a aula de ${formattedDate}.`;
  }

  if (status === 'completed') {
    return `${actorName} marcou a aula de ${formattedDate} como concluída.`;
  }

  return `${actorName} atualizou a aula de ${formattedDate}.`;
}

function formatNotificationDate(date: Date) {
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}
