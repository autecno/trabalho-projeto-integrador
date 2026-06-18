import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { MySqlLearningRepository } from '../repositories/learning.repository';
import { MockPool } from './mocks/mock-pool';

describe('Quiz Routes', () => {
  let app: FastifyInstance;
  const mockPool = new MockPool();
  const learningRepository = new MySqlLearningRepository(mockPool as any);

  it('POST /quiz/modules/:moduleId/start - should return questions for module', async () => {
    app = await buildApp({
      userRepository: null as any,
      appointmentRepository: null as any,
      learningRepository,
      jwtSecret: 'test-secret',
    });

    // Mock data
    const mockQuestions = [
      {
        id: 1,
        moduleId: 1,
        prompt: 'Qual é a velocidade máxima em área urbana?',
        options: ['40 km/h', '50 km/h', '60 km/h', '80 km/h'],
        explanation: 'A velocidade máxima em área urbana é 60 km/h',
      },
      {
        id: 2,
        moduleId: 1,
        prompt: 'Qual é a distância de segurança mínima?',
        options: ['50m', '75m', '100m', '150m'],
        explanation: 'A distância de segurança varia conforme a velocidade',
      },
    ];

    // Test that the endpoint exists and returns proper structure
    const response = await app.inject({
      method: 'GET',
      url: '/quiz/modules/1/start',
      headers: {
        authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6InN0dWRlbnQifQ.mock-token`,
      },
    });

    // Response should have proper structure
    assert.equal(typeof response.payload, 'string');
    const body = JSON.parse(response.payload);
    assert.ok(body.moduleId !== undefined);
    assert.ok(Array.isArray(body.questions));

    await app.close();
  });

  it('POST /quiz/modules/:moduleId/submit - should evaluate answers and return results', async () => {
    app = await buildApp({
      userRepository: null as any,
      appointmentRepository: null as any,
      learningRepository,
      jwtSecret: 'test-secret',
    });

    const answers = [
      { questionId: 1, selectedOptionIndex: 2 }, // correct: 60 km/h
      { questionId: 2, selectedOptionIndex: 1 }, // might be correct
    ];

    const response = await app.inject({
      method: 'POST',
      url: '/quiz/modules/1/submit',
      headers: {
        authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6InN0dWRlbnQifQ.mock-token`,
      },
      payload: { answers },
    });

    const body = JSON.parse(response.payload);
    assert.ok(body.moduleId !== undefined);
    assert.ok(body.totalQuestions !== undefined);
    assert.ok(body.correctAnswers !== undefined);
    assert.ok(body.percentageCorrect !== undefined);
    assert.ok(body.passed !== undefined);
    assert.ok(Array.isArray(body.results));

    await app.close();
  });

  it('GET /quiz/modules/:moduleId/start - should return 403 for non-students', async () => {
    app = await buildApp({
      userRepository: null as any,
      appointmentRepository: null as any,
      learningRepository,
      jwtSecret: 'test-secret',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/quiz/modules/1/start',
      headers: {
        authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6Imludmlsb3gifQ.mock-token`,
      },
    });

    assert.equal(response.statusCode, 403);

    await app.close();
  });

  it('POST /quiz/modules/:moduleId/submit - should validate answers format', async () => {
    app = await buildApp({
      userRepository: null as any,
      appointmentRepository: null as any,
      learningRepository,
      jwtSecret: 'test-secret',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/quiz/modules/1/submit',
      headers: {
        authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6InN0dWRlbnQifQ.mock-token`,
      },
      payload: { answers: 'invalid' },
    });

    assert.equal(response.statusCode, 400);

    await app.close();
  });
});
