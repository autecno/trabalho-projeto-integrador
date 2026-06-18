import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app';
import {
  AppointmentStatus,
} from '../repositories/appointment.repository';
import { LearningRepository } from '../repositories/learning.repository';
import { hashPassword } from '../services/password.service';
import {
  InMemoryAppointmentRatingRepository,
  InMemoryAppointmentRepository,
  InMemoryUserRepository,
  buildAuthHeaders,
  createAppointmentAsStudent,
  loginAndGetToken,
  rateAppointment,
  updateAppointmentStatusAsInstructor,
} from './test-helpers';

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
  const appointmentRatingRepository = new InMemoryAppointmentRatingRepository();
  const app = await buildApp({
    userRepository,
    appointmentRepository,
    learningRepository,
    appointmentRatingRepository,
    ...(options?.jwtSecret !== undefined ? { jwtSecret: options.jwtSecret } : {}),
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
    headers: buildAuthHeaders(loginResponse.json().token),
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

  const studentToken = await loginAndGetToken(app, 'aluno.pedro@example.com');
  const response = await createAppointmentAsStudent(
    app,
    studentToken,
    instructor.id,
    new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    'Aula de baliza',
  );
  assert.equal(response.instructorId, instructor.id);
  assert.equal(response.status, 'pending');

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

  const instructorToken = await loginAndGetToken(app, 'instrutor.bruno@example.com');

  const response = await app.inject({
    method: 'POST',
    url: '/appointments',
    headers: buildAuthHeaders(instructorToken),
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

  const studentToken = await loginAndGetToken(app, 'aluno.lucas@example.com');
  const createResponse = await createAppointmentAsStudent(
    app,
    studentToken,
    instructor.id,
  );
  const instructorToken = await loginAndGetToken(app, 'instrutora.cida@example.com');

  const appointmentId = createResponse.id;
  const patchResponse = await updateAppointmentStatusAsInstructor(
    app,
    instructorToken,
    appointmentId,
    'confirmed',
  );

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

  const studentToken = await loginAndGetToken(app, student.email);
  const instructorToken = await loginAndGetToken(app, instructor.email);
  const createResponse = await createAppointmentAsStudent(
    app,
    studentToken,
    instructor.id,
  );
  const appointmentId = createResponse.id;

  await updateAppointmentStatusAsInstructor(app, instructorToken, appointmentId, 'confirmed');
  await updateAppointmentStatusAsInstructor(app, instructorToken, appointmentId, 'completed');

  const studentRatingResponse = await rateAppointment(
    app,
    studentToken,
    appointmentId,
    5,
  );

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

  const instructorRatingResponse = await rateAppointment(
    app,
    instructorToken,
    appointmentId,
    4,
  );

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
    headers: buildAuthHeaders(studentToken),
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
    headers: buildAuthHeaders(studentToken),
  });

  assert.equal(studentAppointmentsResponse.statusCode, 200);
  assert.equal(studentAppointmentsResponse.json()[0].counterpartAverageRating, 5);
  assert.equal(studentAppointmentsResponse.json()[0].counterpartTotalRatings, 1);
  assert.equal(studentAppointmentsResponse.json()[0].currentUserRatingScore, 5);
  assert.equal(studentAppointmentsResponse.json()[0].canCurrentUserRate, false);

  const instructorAppointmentsResponse = await app.inject({
    method: 'GET',
    url: '/appointments',
    headers: buildAuthHeaders(instructorToken),
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

  const studentToken = await loginAndGetToken(app, student.email);
  const instructorToken = await loginAndGetToken(app, instructor.email);
  const createResponse = await createAppointmentAsStudent(
    app,
    studentToken,
    instructor.id,
  );
  const appointmentId = createResponse.id;

  const earlyRatingResponse = await rateAppointment(app, studentToken, appointmentId, 5);

  assert.equal(earlyRatingResponse.statusCode, 409);
  assert.deepEqual(earlyRatingResponse.json(), {
    message: 'A aula precisa estar concluída para receber avaliação.',
  });

  await updateAppointmentStatusAsInstructor(app, instructorToken, appointmentId, 'completed');

  const firstRatingResponse = await rateAppointment(app, studentToken, appointmentId, 5);

  assert.equal(firstRatingResponse.statusCode, 201);

  const duplicateRatingResponse = await rateAppointment(
    app,
    studentToken,
    appointmentId,
    4,
  );

  assert.equal(duplicateRatingResponse.statusCode, 409);
  assert.deepEqual(duplicateRatingResponse.json(), {
    message: 'Você já avaliou esta aula.',
  });

  await app.close();
});
