import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import {
  AppointmentRating,
  AppointmentRatingRepository,
  CreateAppointmentRatingData,
} from '../repositories/appointment-rating.repository';
import {
  Appointment,
  AppointmentRepository,
  AppointmentStatus,
  AppointmentWithNames,
  CreateAppointmentData,
  InstructorAvailability,
  UpdateAppointmentStatusData,
  UpsertInstructorAvailabilityData,
} from '../repositories/appointment.repository';
import { CreateUserData, User, UserRepository } from '../repositories/user.repository';

export class InMemoryUserRepository implements UserRepository {
  private users: User[] = [];
  private sequence = 1;

  async create(data: CreateUserData): Promise<User> {
    const user: User = {
      id: this.sequence++,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      createdAt: new Date(),
    };

    this.users.push(user);

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findById(id: number): Promise<User | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async listInstructors() {
    return this.users
      .filter((user) => user.role === 'instructor')
      .map((user) => ({
        id: user.id,
        name: user.name,
      }));
  }

  list() {
    return this.users;
  }
}

export class InMemoryAppointmentRepository implements AppointmentRepository {
  private appointments: Appointment[] = [];
  private sequence = 1;

  constructor(private readonly userRepository: InMemoryUserRepository) {}

  async ensureSchema() {}

  async create(data: CreateAppointmentData): Promise<Appointment> {
    const now = new Date();
    const appointment: Appointment = {
      id: this.sequence++,
      studentId: data.studentId,
      instructorId: data.instructorId,
      scheduledAt: data.scheduledAt,
      status: 'pending',
      notes: data.notes ?? null,
      cancellationReason: null,
      createdAt: now,
      updatedAt: now,
    };

    this.appointments.push(appointment);
    return appointment;
  }

  async findById(id: number): Promise<AppointmentWithNames | null> {
    const appointment = this.appointments.find((item) => item.id === id);
    if (!appointment) {
      return null;
    }

    return this.mapWithNames(appointment);
  }

  async findNextByStudent(
    studentId: number,
    referenceDate: Date,
  ): Promise<AppointmentWithNames | null> {
    const appointment = this.appointments
      .filter(
        (item) =>
          item.studentId === studentId &&
          item.scheduledAt > referenceDate &&
          ['pending', 'confirmed'].includes(item.status),
      )
      .sort((first, second) => first.scheduledAt.getTime() - second.scheduledAt.getTime())[0];

    return appointment ? this.mapWithNames(appointment) : null;
  }

  async listByStudent(studentId: number): Promise<AppointmentWithNames[]> {
    return this.appointments
      .filter((appointment) => appointment.studentId === studentId)
      .map((appointment) => this.mapWithNames(appointment));
  }

  async listByInstructor(instructorId: number): Promise<AppointmentWithNames[]> {
    return this.appointments
      .filter((appointment) => appointment.instructorId === instructorId)
      .map((appointment) => this.mapWithNames(appointment));
  }

  async listForInstructorOnDate(
    instructorId: number,
    dateStart: Date,
    dateEnd: Date,
  ): Promise<Appointment[]> {
    return this.appointments.filter(
      (appointment) =>
        appointment.instructorId === instructorId &&
        appointment.scheduledAt >= dateStart &&
        appointment.scheduledAt < dateEnd,
    );
  }

  async hasConflict(instructorId: number, scheduledAt: Date): Promise<boolean> {
    return this.appointments.some(
      (appointment) =>
        appointment.instructorId === instructorId &&
        Math.abs(appointment.scheduledAt.getTime() - scheduledAt.getTime()) <
          60 * 60 * 1000 &&
        ['pending', 'confirmed'].includes(appointment.status),
    );
  }

  async listAvailabilityByInstructor(): Promise<InstructorAvailability[]> {
    return [];
  }

  async replaceAvailability(
    instructorId: number,
    intervals: UpsertInstructorAvailabilityData[],
  ): Promise<InstructorAvailability[]> {
    return intervals.map((interval, index) => ({
      id: index + 1,
      instructorId,
      weekday: interval.weekday,
      startTime: interval.startTime,
      endTime: interval.endTime,
    }));
  }

  async isInstructorAvailableAt(): Promise<boolean> {
    return true;
  }

  async updateStatus(
    id: number,
    data: UpdateAppointmentStatusData,
  ): Promise<AppointmentWithNames | null> {
    const appointment = this.appointments.find((item) => item.id === id);
    if (!appointment) {
      return null;
    }

    appointment.status = data.status;
    appointment.cancellationReason = data.cancellationReason ?? null;
    appointment.updatedAt = new Date();

    return this.mapWithNames(appointment);
  }

  private mapWithNames(appointment: Appointment): AppointmentWithNames {
    const student = this.userRepository.list().find((u) => u.id === appointment.studentId);
    const instructor = this.userRepository
      .list()
      .find((u) => u.id === appointment.instructorId);

    return {
      ...appointment,
      studentName: student?.name ?? 'Aluno',
      instructorName: instructor?.name ?? 'Instrutor',
    };
  }
}

export class InMemoryAppointmentRatingRepository implements AppointmentRatingRepository {
  private ratings: AppointmentRating[] = [];
  private sequence = 1;

  async ensureSchema() {}

  async create(data: CreateAppointmentRatingData): Promise<AppointmentRating> {
    const now = new Date();
    const rating: AppointmentRating = {
      id: this.sequence++,
      appointmentId: data.appointmentId,
      evaluatorUserId: data.evaluatorUserId,
      evaluatedUserId: data.evaluatedUserId,
      score: data.score,
      createdAt: now,
      updatedAt: now,
    };

    this.ratings.push(rating);
    return rating;
  }

  async findByAppointmentAndEvaluator(
    appointmentId: number,
    evaluatorUserId: number,
  ): Promise<AppointmentRating | null> {
    return (
      this.ratings.find(
        (rating) =>
          rating.appointmentId === appointmentId &&
          rating.evaluatorUserId === evaluatorUserId,
      ) ?? null
    );
  }

  async listByAppointmentIdsForEvaluator(
    appointmentIds: number[],
    evaluatorUserId: number,
  ): Promise<AppointmentRating[]> {
    return this.ratings.filter(
      (rating) =>
        rating.evaluatorUserId === evaluatorUserId &&
        appointmentIds.includes(rating.appointmentId),
    );
  }

  async listReceivedSummariesByUserIds(userIds: number[]) {
    return userIds
      .filter((userId, index) => userIds.indexOf(userId) === index)
      .map((userId) => {
        const userRatings = this.ratings.filter(
          (rating) => rating.evaluatedUserId === userId,
        );

        if (userRatings.length === 0) {
          return null;
        }

        const totalScore = userRatings.reduce((sum, rating) => sum + rating.score, 0);

        return {
          userId,
          averageScore: Number((totalScore / userRatings.length).toFixed(2)),
          totalRatings: userRatings.length,
        };
      })
      .filter((summary): summary is NonNullable<typeof summary> => summary !== null);
  }
}

export function buildAuthHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
  };
}

export async function loginAndGetToken(
  app: FastifyInstance,
  email: string,
  password = '123456',
) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email,
      password,
    },
  });

  assert.equal(response.statusCode, 200);
  return response.json().token as string;
}

export async function createAppointmentAsStudent(
  app: FastifyInstance,
  token: string,
  instructorId: number,
  scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  notes?: string,
) {
  const response = await app.inject({
    method: 'POST',
    url: '/appointments',
    headers: buildAuthHeaders(token),
    payload: {
      instructorId,
      scheduledAt,
      ...(notes ? { notes } : {}),
    },
  });

  assert.equal(response.statusCode, 201);
  return response.json();
}

export async function updateAppointmentStatusAsInstructor(
  app: FastifyInstance,
  token: string,
  appointmentId: number,
  status: AppointmentStatus,
) {
  return app.inject({
    method: 'PATCH',
    url: `/appointments/${appointmentId}/status`,
    headers: buildAuthHeaders(token),
    payload: {
      status,
    },
  });
}

export async function rateAppointment(
  app: FastifyInstance,
  token: string,
  appointmentId: number,
  score: number,
) {
  return app.inject({
    method: 'POST',
    url: `/appointments/${appointmentId}/rating`,
    headers: buildAuthHeaders(token),
    payload: {
      score,
    },
  });
}
