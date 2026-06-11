import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app';
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
  UpdateAppointmentStatusData,
} from '../repositories/appointment.repository';
import {
  CreateUserData,
  User,
  UserRepository,
} from '../repositories/user.repository';
import { hashPassword } from '../services/password.service';

class InMemoryUserRepository implements UserRepository {
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

class InMemoryAppointmentRepository implements AppointmentRepository {
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
        appointment.scheduledAt.getTime() === scheduledAt.getTime() &&
        ['pending', 'confirmed'].includes(appointment.status),
    );
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

class InMemoryAppointmentRatingRepository implements AppointmentRatingRepository {
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

async function createAppWithRepositories(options?: { jwtSecret?: string }) {
  const userRepository = new InMemoryUserRepository();
  const appointmentRepository = new InMemoryAppointmentRepository(userRepository);
  const appointmentRatingRepository = new InMemoryAppointmentRatingRepository();
  const appOptions =
    options?.jwtSecret !== undefined
      ? {
          userRepository,
          appointmentRepository,
          appointmentRatingRepository,
          jwtSecret: options.jwtSecret,
        }
      : {
          userRepository,
          appointmentRepository,
          appointmentRatingRepository,
        };
  const app = await buildApp({
    ...appOptions,
  });

  return {
    app,
    userRepository,
    appointmentRepository,
    appointmentRatingRepository,
  };
}

test('POST /users creates a new user successfully', async () => {
  const { app, userRepository } = await createAppWithRepositories();

  const response = await app.inject({
    method: 'POST',
    url: '/users',
    payload: {
      name: 'Maria Silva',
      email: 'maria@example.com',
      password: '123456',
      role: 'student',
    },
  });

  assert.equal(response.statusCode, 201);

  const body = response.json();
  assert.equal(body.name, 'Maria Silva');
  assert.equal(body.email, 'maria@example.com');
  assert.equal(body.role, 'student');

  const [savedUser] = userRepository.list();
  assert.ok(savedUser);
  assert.notEqual(savedUser.passwordHash, '123456');
  assert.equal(savedUser.role, 'student');

  await app.close();
});

test('POST /users rejects duplicated email', async () => {
  const { app, userRepository } = await createAppWithRepositories();
  await userRepository.create({
    name: 'Maria Silva',
    email: 'maria@example.com',
    passwordHash: 'already-hashed',
    role: 'student',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/users',
    payload: {
      name: 'Outra Maria',
      email: 'maria@example.com',
      password: 'abcdef',
      role: 'instructor',
    },
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    message: 'Email already registered.',
  });

  await app.close();
});

test('POST /auth/login returns a JWT for valid credentials', async () => {
  const { app, userRepository } = await createAppWithRepositories({
    jwtSecret: 'test-secret',
  });
  const savedUser = await userRepository.create({
    name: 'Maria Silva',
    email: 'maria@example.com',
    passwordHash: hashPassword('123456'),
    role: 'instructor',
  });
  const loginResponse = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'maria@example.com',
      password: '123456',
    },
  });

  assert.equal(loginResponse.statusCode, 200);
  assert.equal(typeof loginResponse.json().token, 'string');

  const profileResponse = await app.inject({
    method: 'GET',
    url: '/profile',
    headers: {
      authorization: `Bearer ${loginResponse.json().token}`,
    },
  });

  assert.equal(profileResponse.statusCode, 200);
  assert.deepEqual(profileResponse.json(), {
    id: savedUser.id,
    name: savedUser.name,
    email: savedUser.email,
    role: savedUser.role,
  });

  await app.close();
});

test('POST /auth/login rejects invalid credentials', async () => {
  const { app, userRepository } = await createAppWithRepositories({
    jwtSecret: 'test-secret',
  });
  await userRepository.create({
    name: 'Maria Silva',
    email: 'maria@example.com',
    passwordHash: hashPassword('123456'),
    role: 'student',
  });
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'maria@example.com',
      password: 'senha-errada',
    },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    message: 'Invalid email or password.',
  });

  await app.close();
});

test('GET /profile requires authentication', async () => {
  const { app } = await createAppWithRepositories({
    jwtSecret: 'test-secret',
  });

  const response = await app.inject({
    method: 'GET',
    url: '/profile',
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    message: 'Unauthorized.',
  });

  await app.close();
});

test('GET /instructors returns available instructors for authenticated users', async () => {
  const { app, userRepository } = await createAppWithRepositories({
    jwtSecret: 'test-secret',
  });
  await userRepository.create({
    name: 'Ana Instrutora',
    email: 'ana@example.com',
    passwordHash: hashPassword('123456'),
    role: 'instructor',
  });
  await userRepository.create({
    name: 'Bruno Instrutor',
    email: 'bruno@example.com',
    passwordHash: hashPassword('123456'),
    role: 'instructor',
  });
  await userRepository.create({
    name: 'Carlos Aluno',
    email: 'carlos@example.com',
    passwordHash: hashPassword('123456'),
    role: 'student',
  });

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'carlos@example.com',
      password: '123456',
    },
  });

  const response = await app.inject({
    method: 'GET',
    url: '/instructors',
    headers: {
      authorization: `Bearer ${loginResponse.json().token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), [
    {
      id: 1,
      name: 'Ana Instrutora',
      averageRating: null,
      totalRatings: 0,
    },
    {
      id: 2,
      name: 'Bruno Instrutor',
      averageRating: null,
      totalRatings: 0,
    },
  ]);

  await app.close();
});

test('GET /instructors requires authentication', async () => {
  const { app } = await createAppWithRepositories({
    jwtSecret: 'test-secret',
  });

  const response = await app.inject({
    method: 'GET',
    url: '/instructors',
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    message: 'Unauthorized.',
  });

  await app.close();
});

test('POST /appointments allows student to create a valid appointment', async () => {
  const { app, userRepository } = await createAppWithRepositories({
    jwtSecret: 'test-secret',
  });
  const instructor = await userRepository.create({
    name: 'Instrutora Ana',
    email: 'instrutora.ana@example.com',
    passwordHash: hashPassword('123456'),
    role: 'instructor',
  });
  await userRepository.create({
    name: 'Aluno Pedro',
    email: 'aluno.pedro@example.com',
    passwordHash: hashPassword('123456'),
    role: 'student',
  });

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'aluno.pedro@example.com',
      password: '123456',
    },
  });

  const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const response = await app.inject({
    method: 'POST',
    url: '/appointments',
    headers: {
      authorization: `Bearer ${loginResponse.json().token}`,
    },
    payload: {
      instructorId: instructor.id,
      scheduledAt: futureDate,
      notes: 'Aula de baliza',
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().instructorId, instructor.id);
  assert.equal(response.json().status, 'pending');

  await app.close();
});

test('POST /appointments blocks creation for instructors', async () => {
  const { app, userRepository } = await createAppWithRepositories({
    jwtSecret: 'test-secret',
  });
  await userRepository.create({
    name: 'Instrutor Bruno',
    email: 'instrutor.bruno@example.com',
    passwordHash: hashPassword('123456'),
    role: 'instructor',
  });

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'instrutor.bruno@example.com',
      password: '123456',
    },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/appointments',
    headers: {
      authorization: `Bearer ${loginResponse.json().token}`,
    },
    payload: {
      instructorId: 1,
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.json(), {
    message: 'Somente alunos podem criar agendamentos.',
  });

  await app.close();
});

test('PATCH /appointments/:id/status lets instructor confirm own appointment', async () => {
  const { app, userRepository } = await createAppWithRepositories({
    jwtSecret: 'test-secret',
  });
  const instructor = await userRepository.create({
    name: 'Instrutora Cida',
    email: 'instrutora.cida@example.com',
    passwordHash: hashPassword('123456'),
    role: 'instructor',
  });
  await userRepository.create({
    name: 'Aluno Lucas',
    email: 'aluno.lucas@example.com',
    passwordHash: hashPassword('123456'),
    role: 'student',
  });

  const studentLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'aluno.lucas@example.com',
      password: '123456',
    },
  });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/appointments',
    headers: {
      authorization: `Bearer ${studentLogin.json().token}`,
    },
    payload: {
      instructorId: instructor.id,
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    },
  });

  const instructorLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: 'instrutora.cida@example.com',
      password: '123456',
    },
  });

  const appointmentId = createResponse.json().id;
  const patchResponse = await app.inject({
    method: 'PATCH',
    url: `/appointments/${appointmentId}/status`,
    headers: {
      authorization: `Bearer ${instructorLogin.json().token}`,
    },
    payload: {
      status: 'confirmed' as AppointmentStatus,
    },
  });

  assert.equal(patchResponse.statusCode, 200);
  assert.equal(patchResponse.json().status, 'confirmed');

  await app.close();
});

test('POST /appointments/:id/rating allows both sides to rate after a completed lesson', async () => {
  const { app, userRepository } = await createAppWithRepositories({
    jwtSecret: 'test-secret',
  });
  const instructor = await userRepository.create({
    name: 'Instrutora Lia',
    email: 'instrutora.lia@example.com',
    passwordHash: hashPassword('123456'),
    role: 'instructor',
  });
  const student = await userRepository.create({
    name: 'Aluno Ravi',
    email: 'aluno.ravi@example.com',
    passwordHash: hashPassword('123456'),
    role: 'student',
  });

  const studentLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: student.email,
      password: '123456',
    },
  });
  const instructorLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: instructor.email,
      password: '123456',
    },
  });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/appointments',
    headers: {
      authorization: `Bearer ${studentLogin.json().token}`,
    },
    payload: {
      instructorId: instructor.id,
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    },
  });

  const appointmentId = createResponse.json().id;

  await app.inject({
    method: 'PATCH',
    url: `/appointments/${appointmentId}/status`,
    headers: {
      authorization: `Bearer ${instructorLogin.json().token}`,
    },
    payload: {
      status: 'confirmed' as AppointmentStatus,
    },
  });

  await app.inject({
    method: 'PATCH',
    url: `/appointments/${appointmentId}/status`,
    headers: {
      authorization: `Bearer ${instructorLogin.json().token}`,
    },
    payload: {
      status: 'completed' as AppointmentStatus,
    },
  });

  const studentRatingResponse = await app.inject({
    method: 'POST',
    url: `/appointments/${appointmentId}/rating`,
    headers: {
      authorization: `Bearer ${studentLogin.json().token}`,
    },
    payload: {
      score: 5,
    },
  });

  assert.equal(studentRatingResponse.statusCode, 201);
  assert.deepEqual(studentRatingResponse.json(), {
    id: 1,
    appointmentId,
    evaluatorUserId: student.id,
    evaluatedUserId: instructor.id,
    score: 5,
    averageRating: 5,
    totalRatings: 1,
  });

  const instructorRatingResponse = await app.inject({
    method: 'POST',
    url: `/appointments/${appointmentId}/rating`,
    headers: {
      authorization: `Bearer ${instructorLogin.json().token}`,
    },
    payload: {
      score: 4,
    },
  });

  assert.equal(instructorRatingResponse.statusCode, 201);
  assert.deepEqual(instructorRatingResponse.json(), {
    id: 2,
    appointmentId,
    evaluatorUserId: instructor.id,
    evaluatedUserId: student.id,
    score: 4,
    averageRating: 4,
    totalRatings: 1,
  });

  const instructorsResponse = await app.inject({
    method: 'GET',
    url: '/instructors',
    headers: {
      authorization: `Bearer ${studentLogin.json().token}`,
    },
  });

  assert.equal(instructorsResponse.statusCode, 200);
  assert.deepEqual(instructorsResponse.json(), [
    {
      id: instructor.id,
      name: instructor.name,
      averageRating: 5,
      totalRatings: 1,
    },
  ]);

  const studentAppointmentsResponse = await app.inject({
    method: 'GET',
    url: '/appointments',
    headers: {
      authorization: `Bearer ${studentLogin.json().token}`,
    },
  });

  assert.equal(studentAppointmentsResponse.statusCode, 200);
  assert.equal(studentAppointmentsResponse.json()[0].counterpartAverageRating, 5);
  assert.equal(studentAppointmentsResponse.json()[0].counterpartTotalRatings, 1);
  assert.equal(studentAppointmentsResponse.json()[0].currentUserRatingScore, 5);
  assert.equal(studentAppointmentsResponse.json()[0].canCurrentUserRate, false);

  const instructorAppointmentsResponse = await app.inject({
    method: 'GET',
    url: '/appointments',
    headers: {
      authorization: `Bearer ${instructorLogin.json().token}`,
    },
  });

  assert.equal(instructorAppointmentsResponse.statusCode, 200);
  assert.equal(instructorAppointmentsResponse.json()[0].counterpartAverageRating, 4);
  assert.equal(instructorAppointmentsResponse.json()[0].counterpartTotalRatings, 1);
  assert.equal(instructorAppointmentsResponse.json()[0].currentUserRatingScore, 4);
  assert.equal(instructorAppointmentsResponse.json()[0].canCurrentUserRate, false);

  await app.close();
});

test('POST /appointments/:id/rating blocks rating before completion and duplicate submissions', async () => {
  const { app, userRepository } = await createAppWithRepositories({
    jwtSecret: 'test-secret',
  });
  const instructor = await userRepository.create({
    name: 'Instrutor Ivo',
    email: 'instrutor.ivo@example.com',
    passwordHash: hashPassword('123456'),
    role: 'instructor',
  });
  const student = await userRepository.create({
    name: 'Aluno Nilo',
    email: 'aluno.nilo@example.com',
    passwordHash: hashPassword('123456'),
    role: 'student',
  });

  const studentLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: student.email,
      password: '123456',
    },
  });
  const instructorLogin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: instructor.email,
      password: '123456',
    },
  });

  const createResponse = await app.inject({
    method: 'POST',
    url: '/appointments',
    headers: {
      authorization: `Bearer ${studentLogin.json().token}`,
    },
    payload: {
      instructorId: instructor.id,
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    },
  });

  const appointmentId = createResponse.json().id;

  const earlyRatingResponse = await app.inject({
    method: 'POST',
    url: `/appointments/${appointmentId}/rating`,
    headers: {
      authorization: `Bearer ${studentLogin.json().token}`,
    },
    payload: {
      score: 5,
    },
  });

  assert.equal(earlyRatingResponse.statusCode, 409);
  assert.deepEqual(earlyRatingResponse.json(), {
    message: 'A aula precisa estar concluída para receber avaliação.',
  });

  await app.inject({
    method: 'PATCH',
    url: `/appointments/${appointmentId}/status`,
    headers: {
      authorization: `Bearer ${instructorLogin.json().token}`,
    },
    payload: {
      status: 'completed' as AppointmentStatus,
    },
  });

  const firstRatingResponse = await app.inject({
    method: 'POST',
    url: `/appointments/${appointmentId}/rating`,
    headers: {
      authorization: `Bearer ${studentLogin.json().token}`,
    },
    payload: {
      score: 5,
    },
  });

  assert.equal(firstRatingResponse.statusCode, 201);

  const duplicateRatingResponse = await app.inject({
    method: 'POST',
    url: `/appointments/${appointmentId}/rating`,
    headers: {
      authorization: `Bearer ${studentLogin.json().token}`,
    },
    payload: {
      score: 4,
    },
  });

  assert.equal(duplicateRatingResponse.statusCode, 409);
  assert.deepEqual(duplicateRatingResponse.json(), {
    message: 'Você já avaliou esta aula.',
  });

  await app.close();
});
