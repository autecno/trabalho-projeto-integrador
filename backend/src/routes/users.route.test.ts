import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app';
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
import {
  CreateUserData,
  User,
  UserRepository,
} from '../repositories/user.repository';
import { LearningRepository } from '../repositories/learning.repository';
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

class InMemoryLearningRepository implements LearningRepository {
  async ensureSchema() {}
  async seedDefaultLearningData() {}
  async listModulesByStudent() {
    return [];
  }
  async findModuleById() {
    return null;
  }
  async findContentById() {
    return null;
  }
  async recordContentProgress() {}
  async listQuizQuestionsByModule() {
    return [];
  }
  async evaluateQuizAnswers() {
    return {
      total: 0,
      correct: 0,
      results: [],
    };
  }
}

async function createAppWithRepositories(options?: { jwtSecret?: string }) {
  const userRepository = new InMemoryUserRepository();
  const appointmentRepository = new InMemoryAppointmentRepository(userRepository);
  const learningRepository = new InMemoryLearningRepository();
  const appOptions =
    options?.jwtSecret !== undefined
      ? {
          userRepository,
          appointmentRepository,
          learningRepository,
          jwtSecret: options.jwtSecret,
        }
      : {
          userRepository,
          appointmentRepository,
          learningRepository,
        };
  const app = await buildApp({
    ...appOptions,
  });

  return { app, userRepository, appointmentRepository };
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
    message: 'Sua sessão expirou ou não foi informada. Faça login novamente.',
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
    },
    {
      id: 2,
      name: 'Bruno Instrutor',
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
    message: 'Sua sessão expirou ou não foi informada. Faça login novamente.',
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
