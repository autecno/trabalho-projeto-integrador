import { FastifyReply } from 'fastify';
import { LearningRepository, LearningModuleStatus } from '../repositories/learning.repository';
import { AuthTokenPayload } from '../services/jwt.service';

type QuizAccessPurpose = 'start' | 'submit';

export function assertStudent(user: AuthTokenPayload, reply: FastifyReply) {
  if (user.role !== 'student') {
    reply.status(403).send({ message: 'Apenas alunos podem acessar este recurso.' });
    return false;
  }

  return true;
}

export async function requireUnlockedQuiz(options: {
  learningRepository: LearningRepository;
  studentId: number;
  moduleId: number;
  reply: FastifyReply;
  purpose: QuizAccessPurpose;
}): Promise<LearningModuleStatus | null> {
  const status = await options.learningRepository.getModuleStatus(
    options.studentId,
    options.moduleId,
  );

  if (!status) {
    options.reply.status(404).send({ message: 'Modulo nao encontrado.' });
    return null;
  }

  if (!status.quizUnlocked) {
    const action = options.purpose === 'start' ? 'iniciar' : 'enviar';
    options.reply.status(409).send({
      message: `Conclua todos os conteudos do modulo antes de ${action} a prova.`,
      progress: status,
    });
    return null;
  }

  return status;
}
