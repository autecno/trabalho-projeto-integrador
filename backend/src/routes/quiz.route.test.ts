import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import {
  LearningContentDetail,
  LearningModuleSummary,
  LearningQuizQuestion,
  LearningRepository,
  QuizAnswerSubmission,
  QuizSubmissionResult,
} from '../repositories/learning.repository';
import { generateToken } from '../services/jwt.service';

const JWT_SECRET = 'test-secret';

class InMemoryLearningRepository implements LearningRepository {
  private readonly questions: Array<
    LearningQuizQuestion & { correctOptionIndex: number }
  > = [
    {
      id: 1,
      moduleId: 1,
      prompt: 'Qual e a velocidade maxima em area urbana?',
      options: ['40 km/h', '50 km/h', '60 km/h', '80 km/h'],
      explanation: 'A velocidade maxima em area urbana depende da sinalizacao.',
      correctOptionIndex: 2,
    },
    {
      id: 2,
      moduleId: 1,
      prompt: 'Qual e a distancia de seguranca minima?',
      options: ['50m', '75m', '100m', 'Depende da velocidade'],
      explanation: 'A distancia segura varia conforme velocidade e condicoes da via.',
      correctOptionIndex: 3,
    },
  ];

  async ensureSchema(): Promise<void> {}

  async seedDefaultLearningData(): Promise<void> {}

  async listModulesByStudent(): Promise<LearningModuleSummary[]> {
    return [];
  }

  async findModuleById(): ReturnType<LearningRepository['findModuleById']> {
    return null;
  }

  async findContentById(): Promise<LearningContentDetail | null> {
    return null;
  }

  async recordContentProgress(): Promise<void> {}

  async listQuizQuestionsByModule(
    moduleId: number,
  ): Promise<LearningQuizQuestion[]> {
    return this.questions
      .filter((question) => question.moduleId === moduleId)
      .map(({ correctOptionIndex, ...question }) => question);
  }

  async evaluateQuizAnswers(
    moduleId: number,
    answers: QuizAnswerSubmission[],
  ): Promise<QuizSubmissionResult> {
    const questions = this.questions.filter(
      (question) => question.moduleId === moduleId,
    );
    const results = answers.map((answer) => {
      const question = questions.find((item) => item.id === answer.questionId);
      const correctOptionIndex = question?.correctOptionIndex ?? -1;

      return {
        questionId: answer.questionId,
        correct: answer.selectedOptionIndex === correctOptionIndex,
        selectedOptionIndex: answer.selectedOptionIndex,
        correctOptionIndex,
        explanation: question?.explanation ?? null,
      };
    });

    return {
      total: questions.length,
      correct: results.filter((result) => result.correct).length,
      results,
    };
  }
}

async function createApp() {
  const app = await buildApp({
    userRepository: {} as never,
    appointmentRepository: {} as never,
    learningRepository: new InMemoryLearningRepository(),
    jwtSecret: JWT_SECRET,
  });

  return app;
}

function buildToken(role: 'student' | 'instructor') {
  return generateToken(
    {
      sub: role === 'student' ? '1' : '2',
      name: role === 'student' ? 'Aluno' : 'Instrutor',
      email: role === 'student' ? 'aluno@example.com' : 'instrutor@example.com',
      role,
    },
    JWT_SECRET,
  );
}

async function closeApp(app: FastifyInstance) {
  await app.close();
}

describe('Quiz Routes', () => {
  it('GET /quiz/modules/:moduleId/start returns questions for module', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/quiz/modules/1/start',
      headers: {
        authorization: `Bearer ${buildToken('student')}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.moduleId, 1);
    assert.equal(body.totalQuestions, 2);
    assert.equal(Array.isArray(body.questions), true);
    assert.equal(body.questions[0].prompt, 'Qual e a velocidade maxima em area urbana?');
    assert.equal(body.questions[0].correctOptionIndex, undefined);

    await closeApp(app);
  });

  it('POST /quiz/modules/:moduleId/submit evaluates answers and returns results', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/quiz/modules/1/submit',
      headers: {
        authorization: `Bearer ${buildToken('student')}`,
      },
      payload: {
        answers: [
          { questionId: 1, selectedOptionIndex: 2 },
          { questionId: 2, selectedOptionIndex: 1 },
        ],
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.moduleId, 1);
    assert.equal(body.totalQuestions, 2);
    assert.equal(body.correctAnswers, 1);
    assert.equal(body.wrongAnswers, 1);
    assert.equal(body.percentageCorrect, 50);
    assert.equal(body.passed, false);
    assert.equal(Array.isArray(body.results), true);

    await closeApp(app);
  });

  it('GET /quiz/modules/:moduleId/start returns 403 for non-students', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/quiz/modules/1/start',
      headers: {
        authorization: `Bearer ${buildToken('instructor')}`,
      },
    });

    assert.equal(response.statusCode, 403);

    await closeApp(app);
  });

  it('POST /quiz/modules/:moduleId/submit validates answers format', async () => {
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/quiz/modules/1/submit',
      headers: {
        authorization: `Bearer ${buildToken('student')}`,
      },
      payload: { answers: 'invalid' },
    });

    assert.equal(response.statusCode, 400);

    await closeApp(app);
  });
});
