import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app';
import { User } from '../repositories/user.repository';
import { LearningRepository, LearningContentType, QuizAnswerSubmission, QuizSubmissionResult } from '../repositories/learning.repository';
import { generateToken } from '../services/jwt.service';
import { InMemoryAppointmentRepository, InMemoryUserRepository } from './test-helpers';

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
  private quizAttempts: Array<{
    userId: number;
    moduleId: number;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    percentageCorrect: number;
    passed: boolean;
    completedAt: Date;
  }> = [];

  async ensureSchema() {}
  async seedDefaultLearningData() {}

  async listModulesByStudent(studentId: number) {
    return this.modules.map((module) => {
      const moduleContents = this.contents.filter(
        (content) => content.moduleId === module.id && content.active,
      );
      const completed = moduleContents.filter((content) =>
        this.progress.some((progress) => progress.userId === studentId && progress.contentId === content.id),
      );
      const quizCount = this.questions.filter((question) => question.moduleId === module.id && question.active).length;
      const quizCompleted = this.quizAttempts.some((attempt) => attempt.userId === studentId && attempt.moduleId === module.id);
      return {
        id: module.id,
        title: module.title,
        description: module.description,
        videosCount: moduleContents.filter((content) => content.type === 'video').length,
        contentCount: moduleContents.length,
        completedContentCount: completed.length,
        progressPercent: this.calculateProgress(moduleContents.length, completed.length, quizCount, quizCompleted),
        quizCompleted,
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
    const completed = moduleContents.filter((content) =>
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
      contentCount: moduleContents.length,
      completedContentCount: completed.length,
      progressPercent:
        this.calculateProgress(moduleContents.length, completed.length, quizCount, this.getLatestAttempt(studentId, moduleId) !== null),
      contents: moduleContents.map((content) => ({
        id: content.id,
        moduleId: content.moduleId,
        title: content.title,
        type: content.type,
        summary: content.summary,
      })),
      quizCount,
      quizUnlocked: moduleContents.length > 0 && completed.length >= moduleContents.length,
      quizCompleted: this.getLatestAttempt(studentId, moduleId) !== null,
      latestQuizResult: this.getLatestAttempt(studentId, moduleId),
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

  async getModuleStatus(studentId: number, moduleId: number) {
    const module = this.modules.find((item) => item.id === moduleId && item.active);
    if (!module) return null;

    const moduleContents = this.contents.filter(
      (content) => content.moduleId === moduleId && content.active,
    );
    const completed = moduleContents.filter((content) =>
      this.progress.some((progress) => progress.userId === studentId && progress.contentId === content.id),
    );
    const quizCount = this.questions.filter(
      (question) => question.moduleId === moduleId && question.active,
    ).length;
    const latestQuizResult = this.getLatestAttempt(studentId, moduleId);

    return {
      contentCount: moduleContents.length,
      completedContentCount: completed.length,
      quizCount,
      quizUnlocked: moduleContents.length > 0 && completed.length >= moduleContents.length,
      quizCompleted: latestQuizResult !== null,
      progressPercent: this.calculateProgress(moduleContents.length, completed.length, quizCount, latestQuizResult !== null),
      latestQuizResult,
    };
  }

  async getStudentLegislationProgress(studentId: number) {
    return (
      (await this.listModulesByStudent(studentId)).find((module) =>
        module.title.toLowerCase().includes('legisla'),
      ) ?? null
    );
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

  async recordQuizAttempt(studentId: number, moduleId: number, result: QuizSubmissionResult) {
    const percentageCorrect = result.total > 0 ? Number(((result.correct / result.total) * 100).toFixed(2)) : 0;
    const attempt = {
      userId: studentId,
      moduleId,
      totalQuestions: result.total,
      correctAnswers: result.correct,
      wrongAnswers: result.total - result.correct,
      percentageCorrect,
      passed: percentageCorrect >= 70,
      completedAt: new Date(),
    };
    this.quizAttempts.push(attempt);
    return attempt;
  }

  private getLatestAttempt(studentId: number, moduleId: number) {
    const attempt = this.quizAttempts
      .filter((item) => item.userId === studentId && item.moduleId === moduleId)
      .at(-1);

    return attempt
      ? {
          totalQuestions: attempt.totalQuestions,
          correctAnswers: attempt.correctAnswers,
          wrongAnswers: attempt.wrongAnswers,
          percentageCorrect: attempt.percentageCorrect,
          passed: attempt.passed,
          completedAt: attempt.completedAt,
        }
      : null;
  }

  private calculateProgress(contentCount: number, completedContentCount: number, quizCount: number, quizCompleted: boolean) {
    const totalSteps = contentCount + (quizCount > 0 ? 1 : 0);
    if (totalSteps <= 0) return 0;
    const completedSteps = Math.min(completedContentCount, contentCount) + (quizCompleted && quizCount > 0 ? 1 : 0);
    return Math.round((completedSteps / totalSteps) * 100);
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

  const appointmentRepository = new InMemoryAppointmentRepository(userRepository);

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
  assert.equal(modules[0].progressPercent, 33);

  await app.close();
});

test('GET /learning/modules/:moduleId/quiz returns questions without correct answer details', async () => {
  const { app, student, student: user, learningRepository } = await createAppWithRepositories({ jwtSecret: JWT_SECRET });
  const module = learningRepository.addModule('Meio Ambiente e Cidadania', 'Teste de quiz');
  const content = learningRepository.addContent(module.id, 'text', 'Conteudo de quiz', null, 'Resumo', 'Corpo');
  await learningRepository.recordContentProgress(student.id, content.id);
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
