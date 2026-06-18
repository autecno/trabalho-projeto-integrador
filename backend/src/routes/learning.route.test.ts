import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app';
import { Appointment, AppointmentRepository, AppointmentStatus, AppointmentWithNames, CreateAppointmentData, InstructorAvailability, UpdateAppointmentStatusData, UpsertInstructorAvailabilityData } from '../repositories/appointment.repository';
import { UserRepository, CreateUserData, User } from '../repositories/user.repository';
import { LearningRepository, LearningContentType, QuizAnswerSubmission, QuizSubmissionResult } from '../repositories/learning.repository';
import { generateToken } from '../services/jwt.service';

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
      .map((user) => ({ id: user.id, name: user.name }));
  }
}

class InMemoryAppointmentRepository implements AppointmentRepository {
  async ensureSchema() {}
  async create(data: CreateAppointmentData): Promise<Appointment> {
    throw new Error('Not implemented');
  }
  async findById(id: number): Promise<AppointmentWithNames | null> {
    return null;
  }
  async findNextByStudent(studentId: number, referenceDate: Date): Promise<AppointmentWithNames | null> {
    return null;
  }
  async listByStudent(studentId: number): Promise<AppointmentWithNames[]> {
    return [];
  }
  async listByInstructor(instructorId: number): Promise<AppointmentWithNames[]> {
    return [];
  }
  async listForInstructorOnDate(instructorId: number, dateStart: Date, dateEnd: Date): Promise<Appointment[]> {
    return [];
  }
  async hasConflict(instructorId: number, scheduledAt: Date): Promise<boolean> {
    return false;
  }
  async listAvailabilityByInstructor(): Promise<InstructorAvailability[]> {
    return [];
  }
  async replaceAvailability(instructorId: number, intervals: UpsertInstructorAvailabilityData[]): Promise<InstructorAvailability[]> {
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
  async updateStatus(id: number, data: UpdateAppointmentStatusData): Promise<AppointmentWithNames | null> {
    return null;
  }
}

class InMemoryLearningRepository implements LearningRepository {
  private moduleSequence = 1;
  private contentSequence = 1;
  private questionSequence = 1;
  private modules: Array<{
    id: number;
    title: string;
    description: string;
    active: boolean;
  }> = [];
  private contents: Array<{
    id: number;
    moduleId: number;
    title: string;
    type: LearningContentType;
    youtubeUrl: string | null;
    summary: string | null;
    body: string | null;
    active: boolean;
  }> = [];
  private questions: Array<{
    id: number;
    moduleId: number;
    prompt: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string | null;
    active: boolean;
  }> = [];
  private progress: Array<{ userId: number; contentId: number }> = [];

  async ensureSchema() {}
  async seedDefaultLearningData() {}

  async listModulesByStudent(studentId: number) {
    return this.modules.map((module) => {
      const moduleContents = this.contents.filter(
        (content) => content.moduleId === module.id && content.active && content.type === 'video',
      );
      const watched = moduleContents.filter((content) =>
        this.progress.some((progress) => progress.userId === studentId && progress.contentId === content.id),
      );
      return {
        id: module.id,
        title: module.title,
        description: module.description,
        videosCount: moduleContents.length,
        progressPercent:
          moduleContents.length > 0
            ? Math.round((watched.length / moduleContents.length) * 100)
            : 0,
      };
    });
  }

  async findModuleById(moduleId: number, studentId: number) {
    const module = this.modules.find((item) => item.id === moduleId && item.active);
    if (!module) {
      return null;
    }

    const moduleContents = this.contents.filter(
      (content) => content.moduleId === moduleId && content.active,
    );
    const videoContents = moduleContents.filter((content) => content.type === 'video');
    const watched = videoContents.filter((content) =>
      this.progress.some((progress) => progress.userId === studentId && progress.contentId === content.id),
    );
    const quizCount = this.questions.filter(
      (question) => question.moduleId === moduleId && question.active,
    ).length;

    return {
      id: module.id,
      title: module.title,
      description: module.description,
      videosCount: videoContents.length,
      progressPercent:
        videoContents.length > 0 ? Math.round((watched.length / videoContents.length) * 100) : 0,
      contents: moduleContents.map((content) => ({
        id: content.id,
        moduleId: content.moduleId,
        title: content.title,
        type: content.type,
        summary: content.summary,
      })),
      quizCount,
    };
  }

  async findContentById(contentId: number) {
    const content = this.contents.find((item) => item.id === contentId && item.active);
    if (!content) {
      return null;
    }
    return {
      id: content.id,
      moduleId: content.moduleId,
      title: content.title,
      type: content.type,
      youtubeUrl: content.youtubeUrl,
      summary: content.summary,
      body: content.body,
    };
  }

  async recordContentProgress(userId: number, contentId: number) {
    if (!this.progress.some((item) => item.userId === userId && item.contentId === contentId)) {
      this.progress.push({ userId, contentId });
    }
  }

  async listQuizQuestionsByModule(moduleId: number) {
    return this.questions
      .filter((question) => question.moduleId === moduleId && question.active)
      .map((question) => ({
        id: question.id,
        moduleId: question.moduleId,
        prompt: question.prompt,
        options: question.options,
        explanation: question.explanation,
      }));
  }

  async evaluateQuizAnswers(moduleId: number, answers: QuizAnswerSubmission[]) {
    const questions = this.questions.filter(
      (question) => question.moduleId === moduleId && question.active,
    );
    const results = answers.map((answer) => {
      const question = questions.find((item) => item.id === answer.questionId);
      const correctOptionIndex = question?.correctOptionIndex ?? -1;
      return {
        questionId: answer.questionId,
        selectedOptionIndex: answer.selectedOptionIndex,
        correctOptionIndex,
        correct: question ? answer.selectedOptionIndex === correctOptionIndex : false,
        explanation: question?.explanation ?? null,
      };
    });

    const correct = results.filter((result) => result.correct).length;

    return {
      total: questions.length,
      correct,
      results,
    };
  }

  addModule(title: string, description: string) {
    const module = {
      id: this.moduleSequence++,
      title,
      description,
      active: true,
    };
    this.modules.push(module);
    return module;
  }

  addContent(moduleId: number, type: LearningContentType, title: string, youtubeUrl: string | null, summary: string | null, body: string | null) {
    const content = {
      id: this.contentSequence++,
      moduleId,
      title,
      type,
      youtubeUrl,
      summary,
      body,
      active: true,
    };
    this.contents.push(content);
    return content;
  }

  addQuestion(moduleId: number, prompt: string, options: string[], correctOptionIndex: number, explanation: string | null) {
    const question = {
      id: this.questionSequence++,
      moduleId,
      prompt,
      options,
      correctOptionIndex,
      explanation,
      active: true,
    };
    this.questions.push(question);
    return question;
  }
}

async function createAppWithRepositories(options?: { jwtSecret?: string }) {
  const userRepository = new InMemoryUserRepository();
  const learningRepository = new InMemoryLearningRepository();

  const student = await userRepository.create({
    name: 'Aluno',
    email: 'aluno@example.com',
    passwordHash: 'hash',
    role: 'student',
  });

  const instructor = await userRepository.create({
    name: 'Instrutor',
    email: 'instrutor@example.com',
    passwordHash: 'hash',
    role: 'instructor',
  });

  const module = learningRepository.addModule('Legislação de Trânsito', 'Teste de módulo');
  const content = learningRepository.addContent(
    module.id,
    'video',
    'Sinalização',
    'https://www.youtube.com/watch?v=abc123',
    'Resumo do vídeo',
    null,
  );
  learningRepository.addContent(module.id, 'text', 'Resumo da legislação', null, 'Resumo', 'Corpo do texto');
  learningRepository.addQuestion(module.id, 'Qual sinal é obrigatório?', ['Placa A', 'Placa B'], 0, 'Porque A é correto');

  const appointmentRepository = new InMemoryAppointmentRepository();

  const app = await buildApp({
    userRepository,
    appointmentRepository,
    learningRepository,
    jwtSecret: options?.jwtSecret ?? 'test-jwt-secret',
  });

  return { app, userRepository, learningRepository, student, instructor, content };
}

function buildToken(user: User, jwtSecret: string) {
  return generateToken(
    {
      sub: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    jwtSecret,
  );
}

const JWT_SECRET = 'test-jwt-secret';

test('GET /learning/modules returns module list for student', async () => {
  const { app, student } = await createAppWithRepositories({ jwtSecret: JWT_SECRET });

  const response = await app.inject({
    method: 'GET',
    url: '/learning/modules',
    headers: {
      Authorization: `Bearer ${buildToken(student, JWT_SECRET)}`,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(Array.isArray(body), true);
  assert.equal(body.length, 1);
  assert.equal(body[0].title, 'Legislação de Trânsito');
  assert.equal(body[0].videosCount, 1);
  assert.equal(body[0].progressPercent, 0);

  await app.close();
});

test('GET /learning/modules is forbidden for instructor', async () => {
  const { app, instructor } = await createAppWithRepositories({ jwtSecret: JWT_SECRET });

  const response = await app.inject({
    method: 'GET',
    url: '/learning/modules',
    headers: {
      Authorization: `Bearer ${buildToken(instructor, JWT_SECRET)}`,
    },
  });

  assert.equal(response.statusCode, 403);
  await app.close();
});

test('GET /learning/contents/:contentId returns content detail', async () => {
  const { app, student, content } = await createAppWithRepositories({ jwtSecret: JWT_SECRET });

  const response = await app.inject({
    method: 'GET',
    url: `/learning/contents/${content.id}`,
    headers: {
      Authorization: `Bearer ${buildToken(student, JWT_SECRET)}`,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.title, 'Sinalização');
  assert.equal(body.youtubeUrl, 'https://www.youtube.com/watch?v=abc123');
  assert.equal(body.type, 'video');

  await app.close();
});

test('POST /learning/contents/:contentId/progress records progress and updates module progress', async () => {
  const { app, student, learningRepository, content } = await createAppWithRepositories({ jwtSecret: JWT_SECRET });

  const progressResponse = await app.inject({
    method: 'POST',
    url: `/learning/contents/${content.id}/progress`,
    headers: {
      Authorization: `Bearer ${buildToken(student, JWT_SECRET)}`,
    },
  });

  assert.equal(progressResponse.statusCode, 204);

  const modulesResponse = await app.inject({
    method: 'GET',
    url: '/learning/modules',
    headers: {
      Authorization: `Bearer ${buildToken(student, JWT_SECRET)}`,
    },
  });

  const modules = modulesResponse.json();
  assert.equal(modules[0].progressPercent, 100);

  await app.close();
});

test('GET /learning/modules/:moduleId/quiz returns questions without correct answer details', async () => {
  const { app, student, student: user, learningRepository } = await createAppWithRepositories({ jwtSecret: JWT_SECRET });
  const module = learningRepository.addModule('Meio Ambiente e Cidadania', 'Teste de quiz');
  learningRepository.addQuestion(module.id, 'Qual prática é correta?', ['A', 'B'], 1, 'Explicação');

  const response = await app.inject({
    method: 'GET',
    url: `/learning/modules/${module.id}/quiz`,
    headers: {
      Authorization: `Bearer ${buildToken(user, JWT_SECRET)}`,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(Array.isArray(body), true);
  assert.equal(body.length, 1);
  assert.equal(body[0].prompt, 'Qual prática é correta?');
  assert.equal(body[0].options[1], 'B');
  assert.equal(body[0].correctOptionIndex, undefined);

  await app.close();
});

