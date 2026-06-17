import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type LearningContentType = 'video' | 'text';

export interface LearningModuleSummary {
  id: number;
  title: string;
  description: string;
  videosCount: number;
  progressPercent: number;
}

export interface LearningContentListItem {
  id: number;
  moduleId: number;
  title: string;
  type: LearningContentType;
  summary: string | null;
}

export interface LearningContentDetail {
  id: number;
  moduleId: number;
  title: string;
  type: LearningContentType;
  youtubeUrl: string | null;
  summary: string | null;
  body: string | null;
}

export interface LearningQuizQuestion {
  id: number;
  moduleId: number;
  prompt: string;
  options: string[];
  explanation: string | null;
}

export type QuizAnswerSubmission = {
  questionId: number;
  selectedOptionIndex: number;
};

export type QuizSubmissionResult = {
  total: number;
  correct: number;
  results: Array<{
    questionId: number;
    correct: boolean;
    selectedOptionIndex: number;
    correctOptionIndex: number;
    explanation: string | null;
  }>;
};

export interface LearningRepository {
  ensureSchema(): Promise<void>;
  seedDefaultLearningData(): Promise<void>;
  listModulesByStudent(studentId: number): Promise<LearningModuleSummary[]>;
  findModuleById(
    moduleId: number,
    studentId: number,
  ): Promise<{
    id: number;
    title: string;
    description: string;
    videosCount: number;
    progressPercent: number;
    contents: LearningContentListItem[];
    quizCount: number;
  } | null>;
  findContentById(contentId: number): Promise<LearningContentDetail | null>;
  recordContentProgress(userId: number, contentId: number): Promise<void>;
  listQuizQuestionsByModule(moduleId: number): Promise<LearningQuizQuestion[]>;
  evaluateQuizAnswers(
    moduleId: number,
    answers: QuizAnswerSubmission[],
  ): Promise<QuizSubmissionResult>;
}

type LearningModuleRow = RowDataPacket & {
  id: number;
  title: string;
  description: string;
  active: number;
  sort_order: number;
};

type LearningContentRow = RowDataPacket & {
  id: number;
  module_id: number;
  title: string;
  type: LearningContentType;
  youtube_url: string | null;
  summary: string | null;
  body: string | null;
  active: number;
  sort_order: number;
};

type LearningQuizQuestionRow = RowDataPacket & {
  id: number;
  module_id: number;
  prompt: string;
  options: string[] | string;
  correct_option_index: number;
  explanation: string | null;
  active: number;
  sort_order: number;
};

export class MySqlLearningRepository implements LearningRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS learning_modules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS learning_contents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        type ENUM('video', 'text') NOT NULL,
        youtube_url VARCHAR(255) NULL,
        summary TEXT NULL,
        body TEXT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_learning_contents_module FOREIGN KEY (module_id) REFERENCES learning_modules(id)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS learning_quiz_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module_id INT NOT NULL,
        prompt TEXT NOT NULL,
        options JSON NOT NULL,
        correct_option_index INT NOT NULL,
        explanation TEXT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_learning_questions_module FOREIGN KEY (module_id) REFERENCES learning_modules(id)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS learning_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        content_id INT NOT NULL,
        watched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_learning_progress (user_id, content_id),
        CONSTRAINT fk_learning_progress_user FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT fk_learning_progress_content FOREIGN KEY (content_id) REFERENCES learning_contents(id)
      )
    `);
  }

  async seedDefaultLearningData() {
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM learning_modules`,
    );

    const total = Number(countRows[0]?.total ?? 0);
    if (total > 0) {
      return;
    }

    const modules = [
      {
        key: 'legislacao',
        title: 'Legislação de Trânsito',
        description:
          'Regras de circulação, sinais, prioridades e leis essenciais para a prova teórica do DETRAN.',
      },
      {
        key: 'direcao-defensiva',
        title: 'Direção Defensiva',
        description:
          'Técnicas para evitar acidentes, manter a calma no trânsito e proteger você e outras pessoas.',
      },
      {
        key: 'primeiros-socorros',
        title: 'Primeiros Socorros',
        description:
          'Atendimento inicial em emergências, como pequenas lesões e situações de risco no trânsito.',
      },
      {
        key: 'meio-ambiente',
        title: 'Meio Ambiente e Cidadania',
        description:
          'Práticas responsáveis no trânsito e atitudes sustentáveis para motoristas e pedestres.',
      },
      {
        key: 'mecanica-basica',
        title: 'Mecânica Básica e Funcionamento do Veículo',
        description:
          'Conhecimentos básicos sobre freios, pneus, óleo e manutenção preventiva para dirigir com segurança.',
      },
    ];

    const moduleIdByKey = new Map<string, number>();
    for (let index = 0; index < modules.length; index += 1) {
      const module = modules[index];
      if (!module) {
        continue;
      }

      const [result] = await this.pool.execute<ResultSetHeader>(
        `
          INSERT INTO learning_modules (title, description, active, sort_order)
          VALUES (?, ?, 1, ?)
        `,
        [module.title, module.description, index],
      );

      moduleIdByKey.set(module.key, result.insertId);
    }

    const contents = [
      {
        moduleKey: 'legislacao',
        title: 'Sinalização de Trânsito Básica',
        type: 'video' as const,
        youtubeUrl: 'https://www.youtube.com/watch?v=V7c3S5Eijgg',
        summary:
          'Aprenda os principais sinais de trânsito e o que cada categoria representa.',
        body: null,
      },
      {
        moduleKey: 'legislacao',
        title: 'Regras de Prioridade e Faixas',
        type: 'video' as const,
        youtubeUrl: 'https://www.youtube.com/watch?v=z-OJfS1Bsd8',
        summary:
          'Entenda quem tem prioridade nas diferentes situações e como agir nas faixas de pedestres.',
        body: null,
      },
      {
        moduleKey: 'legislacao',
        title: 'Resumo da Legislação para o DETRAN',
        type: 'text' as const,
        youtubeUrl: null,
        summary: 'Resumo dos principais pontos para revisão rápida.',
        body:
          'A legislação de trânsito cobre: sinais de regulamentação, advertência e indicação.\n\nÉ essencial saber as prioridades nas rotatórias, cruzamentos e áreas escolares.\n\nPor fim, memorize as penalidades básicas para acostamento, ultrapassagem e parada indevida.',
      },
      {
        moduleKey: 'direcao-defensiva',
        title: 'Comportamento Preventivo ao Volante',
        type: 'video' as const,
        youtubeUrl: 'https://www.youtube.com/watch?v=pW6A6ivImdA',
        summary:
          'Dicas para manter distância segura e reagir corretamente a situações de risco.',
        body: null,
      },
      {
        moduleKey: 'direcao-defensiva',
        title: 'Prevenção de Acidentes no Trânsito',
        type: 'video' as const,
        youtubeUrl: 'https://www.youtube.com/watch?v=9qeUYZD2ytk',
        summary:
          'Como identificar pontos cegos, condições adversas e agir com direção defensiva.',
        body: null,
      },
      {
        moduleKey: 'direcao-defensiva',
        title: 'Princípios da Direção Defensiva',
        type: 'text' as const,
        youtubeUrl: null,
        summary: 'Comportamento consciente e atenção constante ao dirigir.',
        body:
          'A direção defensiva exige: atenção, antecipação e respeito às regras.\n\nO condutor deve sempre reduzir a velocidade em ambientes perigosos e evitar distrações.',
      },
      {
        moduleKey: 'primeiros-socorros',
        title: 'Atendimento Inicial em Acidentes',
        type: 'video' as const,
        youtubeUrl: 'https://www.youtube.com/watch?v=9cGMHnqU4mY',
        summary:
          'Como agir com segurança ao prestar os primeiros socorros no trânsito.',
        body: null,
      },
      {
        moduleKey: 'primeiros-socorros',
        title: 'Cuidados com Ferimentos e Choques',
        type: 'video' as const,
        youtubeUrl: 'https://www.youtube.com/watch?v=GJBPxR09RKE',
        summary:
          'Reconheça sinais de choque, hemorragia e quando chamar ajuda especializada.',
        body: null,
      },
      {
        moduleKey: 'primeiros-socorros',
        title: 'Procedimentos Básicos de Socorro',
        type: 'text' as const,
        youtubeUrl: null,
        summary: 'Guia rápido de primeiros socorros após acidentes.',
        body:
          'Em caso de acidente, avalie a cena, proteja a vítima e acione o serviço de emergência.\n\nNão mova a vítima sem necessidade e controle hemorragias com pressão direta.',
      },
      {
        moduleKey: 'meio-ambiente',
        title: 'Atitudes Sustentáveis no Trânsito',
        type: 'video' as const,
        youtubeUrl: 'https://www.youtube.com/watch?v=okQkbw7mFq4',
        summary:
          'Práticas para reduzir impactos ambientais ao dirigir.',
        body: null,
      },
      {
        moduleKey: 'meio-ambiente',
        title: 'Cidadania e Responsabilidade no Trânsito',
        type: 'video' as const,
        youtubeUrl: 'https://www.youtube.com/watch?v=dwf3YvHT0pw',
        summary:
          'Entenda como o respeito ao próximo melhora o trânsito e a qualidade de vida.',
        body: null,
      },
      {
        moduleKey: 'meio-ambiente',
        title: 'Boas Práticas para Motoristas',
        type: 'text' as const,
        youtubeUrl: null,
        summary: 'Ações simples para cuidar do meio ambiente enquanto dirige.',
        body:
          'O motorista responsável evita acelerações e frenagens bruscas.\n\nManter o veículo regulado reduz consumo de combustível e emissões.',
      },
      {
        moduleKey: 'mecanica-basica',
        title: 'Noções de Fluídos e Pneus',
        type: 'video' as const,
        youtubeUrl: 'https://www.youtube.com/watch?v=czfYIqwUjLA',
        summary:
          'Como verificar níveis de óleo, água e pressão dos pneus antes de pegar a estrada.',
        body: null,
      },
      {
        moduleKey: 'mecanica-basica',
        title: 'Sinalização de Pane e Equipamentos do Veículo',
        type: 'video' as const,
        youtubeUrl: 'https://www.youtube.com/watch?v=U9_eT-Af28c',
        summary:
          'Identifique símbolos do painel e prepare-se para uma parada segura.',
        body: null,
      },
      {
        moduleKey: 'mecanica-basica',
        title: 'Cuidados Preventivos com o Veículo',
        type: 'text' as const,
        youtubeUrl: null,
        summary: 'Checklist básico antes de dirigir.',
        body:
          'Verifique pneus, freios, luzes e nível de fluidos antes de sair.\n\nA manutenção preventiva evita pane no trânsito.',
      },
    ];

    for (let index = 0; index < contents.length; index += 1) {
      const content = contents[index];
      if (!content) {
        continue;
      }

      const moduleId = moduleIdByKey.get(content.moduleKey);
      if (!moduleId) {
        continue;
      }

      await this.pool.execute<ResultSetHeader>(
        `
          INSERT INTO learning_contents (module_id, title, type, youtube_url, summary, body, active, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        `,
        [
          moduleId,
          content.title,
          content.type,
          content.youtubeUrl,
          content.summary,
          content.body,
          index,
        ],
      );
    }

    const questions = [
      {
        moduleKey: 'legislacao',
        prompt: 'Qual sinal indica que é proibido estacionar?',
        options: ['Placa com letra E cortada', 'Placa de pare', 'Placa de velocidade máxima', 'Placa de preferência'],
        correctOptionIndex: 0,
        explanation: 'A placa de estacionamento proibido é a letra E com uma barra vermelha.',
      },
      {
        moduleKey: 'legislacao',
        prompt: 'Quem tem preferência em uma rotatória sem sinalização?',
        options: ['Quem já está na rotatória', 'Quem entra na rotatória', 'Veículos de maior porte', 'Pedestres'],
        correctOptionIndex: 0,
        explanation: 'A preferência é de quem já está circulando na rotatória.',
      },
      {
        moduleKey: 'legislacao',
        prompt: 'Qual é a função da faixa de pedestre?',
        options: ['Garantir a travessia segura de pedestres', 'Aumentar a velocidade dos veículos', 'Indicar área de estacionamento', 'Reduzir o número de semáforos'],
        correctOptionIndex: 0,
        explanation: 'A faixa de pedestre serve para proteger as travessias no trânsito.',
      },
      {
        moduleKey: 'direcao-defensiva',
        prompt: 'O que é direção defensiva?',
        options: ['Antecipar riscos e evitar acidentes', 'Dirigir apenas em alta velocidade', 'Ignorar outros veículos', 'Usar o celular no trânsito'],
        correctOptionIndex: 0,
        explanation: 'Direção defensiva é dirigir com prevenção e atenção constante.',
      },
      {
        moduleKey: 'direcao-defensiva',
        prompt: 'Qual atitude ajuda a reduzir risco de acidente?',
        options: ['Manter distância segura do veículo à frente', 'Acelerar em ultrapassagens arriscadas', 'Buzinar sem motivo', 'Ultrapassar pela direita sempre'],
        correctOptionIndex: 0,
        explanation: 'Manter distância segura dá tempo de reação em caso de emergência.',
      },
      {
        moduleKey: 'direcao-defensiva',
        prompt: 'Por que reduzir a velocidade em tempo chuvoso?',
        options: ['Para aumentar o controle do veículo', 'Para usar menos freio', 'Para economizar combustível', 'Para irritar outros motoristas'],
        correctOptionIndex: 0,
        explanation: 'A menor velocidade melhora a aderência e o tempo de frenagem.',
      },
      {
        moduleKey: 'primeiros-socorros',
        prompt: 'Qual ação inicial é mais segura em um acidente?',
        options: ['Garantir segurança da cena antes de ajudar', 'Mover a vítima imediatamente', 'Ficar mais perto do veículo abandonado', 'Tentar retirar a vítima com pressa'],
        correctOptionIndex: 0,
        explanation: 'Avaliar e proteger a cena evita riscos adicionais para todos.',
      },
      {
        moduleKey: 'primeiros-socorros',
        prompt: 'Se a vítima estiver sangrando muito, o que fazer?',
        options: ['Aplicar pressão direta no ferimento', 'Não tocar no ferimento', 'Dar líquidos à vítima', 'Mover o membro ferido imediatamente'],
        correctOptionIndex: 0,
        explanation: 'Aplica-se pressão direta para controlar a hemorragia.',
      },
      {
        moduleKey: 'primeiros-socorros',
        prompt: 'O que não se deve fazer se suspeitar de fratura?',
        options: ['Mexer demais o membro lesionado', 'Imobilizar com cuidado', 'Chamar socorro', 'Observar sinais vitais'],
        correctOptionIndex: 0,
        explanation: 'Mover demais pode agravar a lesão em caso de fratura.',
      },
      {
        moduleKey: 'meio-ambiente',
        prompt: 'Qual prática ajuda a proteger o meio ambiente ao dirigir?',
        options: ['Manter o veículo bem regulado', 'Acelerar bruscamente', 'Usar o motor em ponto morto em descidas', 'Ignorar a manutenção'],
        correctOptionIndex: 0,
        explanation: 'Um veículo regulado emite menos poluentes e consome menos combustível.',
      },
      {
        moduleKey: 'meio-ambiente',
        prompt: 'O que significa ter cidadania no trânsito?',
        options: ['Respeitar pedestres e outros motoristas', 'Avançar sinais vermelhos', 'Estacionar em local proibido', 'Buzinar desnecessariamente'],
        correctOptionIndex: 0,
        explanation: 'Cidadania no trânsito é agir com respeito e responsabilidade.',
      },
      {
        moduleKey: 'meio-ambiente',
        prompt: 'Qual atitude reduz ruído e poluição?',
        options: ['Dirigir de forma suave e consciente', 'Acelerar em todas as saídas', 'Manter o motor funcionando em marcha lenta', 'Ignorar sinais de alerta do veículo'],
        correctOptionIndex: 0,
        explanation: 'Condução suave reduz emissões e o nível de ruído.',
      },
      {
        moduleKey: 'mecanica-basica',
        prompt: 'Por que verificar os pneus antes de sair?',
        options: ['Para garantir segurança e evitar falhas', 'Para deixar o carro mais bonito', 'Para economizar espaço no porta-malas', 'Para não precisar trocar óleo'],
        correctOptionIndex: 0,
        explanation: 'Pneus calibrados e em bom estado são essenciais para estabilidade.',
      },
      {
        moduleKey: 'mecanica-basica',
        prompt: 'O que indica uma luz acesa no painel?',
        options: ['Uma possível falha ou necessidade de manutenção', 'Apenas um detalhe estético', 'Que o veículo está pronto sempre', 'Que deve acelerar mais'],
        correctOptionIndex: 0,
        explanation: 'Luzes de advertência alertam para problemas ou manutenção necessária.',
      },
      {
        moduleKey: 'mecanica-basica',
        prompt: 'Qual fluido deve ser checado regularmente?',
        options: ['Óleo do motor', 'A água do limpador apenas', 'O combustível apenas', 'O ar-condicionado'],
        correctOptionIndex: 0,
        explanation: 'O nível de óleo é fundamental para a lubrificação e funcionamento do motor.',
      },
    ];

    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      if (!question) {
        continue;
      }

      const moduleId = moduleIdByKey.get(question.moduleKey);
      if (!moduleId) {
        continue;
      }

      await this.pool.execute<ResultSetHeader>(
        `
          INSERT INTO learning_quiz_questions (module_id, prompt, options, correct_option_index, explanation, active, sort_order)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `,
        [
          moduleId,
          question.prompt,
          JSON.stringify(question.options),
          question.correctOptionIndex,
          question.explanation,
          index,
        ],
      );
    }
  }

  async listModulesByStudent(studentId: number): Promise<LearningModuleSummary[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `
        SELECT
          m.id,
          m.title,
          m.description,
          COALESCE(COUNT(c.id), 0) AS videos_count,
          COALESCE(SUM(progress.id IS NOT NULL), 0) AS watched_count
        FROM learning_modules m
        LEFT JOIN learning_contents c
          ON c.module_id = m.id
          AND c.active = 1
          AND c.type = 'video'
        LEFT JOIN learning_progress progress
          ON progress.content_id = c.id
          AND progress.user_id = ?
        WHERE m.active = 1
        GROUP BY m.id
        ORDER BY m.sort_order ASC
      `,
      [studentId],
    );

    return rows.map((row) => ({
      id: Number(row.id),
      title: String(row.title),
      description: String(row.description),
      videosCount: Number(row.videos_count),
      progressPercent:
        Number(row.videos_count) > 0
          ? Math.round((Number(row.watched_count) / Number(row.videos_count)) * 100)
          : 0,
    }));
  }

  async findModuleById(
    moduleId: number,
    studentId: number,
  ): Promise<{
    id: number;
    title: string;
    description: string;
    videosCount: number;
    progressPercent: number;
    contents: LearningContentListItem[];
    quizCount: number;
  } | null> {
    const [moduleRows] = await this.pool.execute<LearningModuleRow[]>(
      `
        SELECT id, title, description
        FROM learning_modules
        WHERE id = ?
          AND active = 1
        LIMIT 1
      `,
      [moduleId],
    );

    const module = moduleRows[0];
    if (!module) {
      return null;
    }

    const [contents] = await this.pool.execute<LearningContentRow[]>(
      `
        SELECT id, module_id, title, type, summary
        FROM learning_contents
        WHERE module_id = ?
          AND active = 1
        ORDER BY sort_order ASC
      `,
      [moduleId],
    );

    const [progressRows] = await this.pool.execute<RowDataPacket[]>(
      `
        SELECT COUNT(*) as watched_count
        FROM learning_progress p
        INNER JOIN learning_contents c ON c.id = p.content_id
        WHERE p.user_id = ?
          AND c.module_id = ?
          AND c.active = 1
          AND c.type = 'video'
      `,
      [studentId, moduleId],
    );

    const videosCount = contents.filter((content) => content.type === 'video').length;
    const watchedCount = Number(progressRows[0]?.watched_count ?? 0);

    const quizCount = await this.countQuizQuestions(moduleId);

    return {
      id: module.id,
      title: module.title,
      description: module.description,
      videosCount,
      progressPercent: videosCount > 0 ? Math.round((watchedCount / videosCount) * 100) : 0,
      contents: contents.map((content) => ({
        id: content.id,
        moduleId: content.module_id,
        title: content.title,
        type: content.type,
        summary: content.summary,
      })),
      quizCount,
    };
  }

  async findContentById(contentId: number): Promise<LearningContentDetail | null> {
    const [rows] = await this.pool.execute<LearningContentRow[]>(
      `
        SELECT c.id, c.module_id, c.title, c.type, c.youtube_url, c.summary, c.body
        FROM learning_contents c
        INNER JOIN learning_modules m ON m.id = c.module_id
        WHERE c.id = ?
          AND c.active = 1
          AND m.active = 1
        LIMIT 1
      `,
      [contentId],
    );

    const content = rows[0];
    if (!content) {
      return null;
    }

    return {
      id: content.id,
      moduleId: content.module_id,
      title: content.title,
      type: content.type,
      youtubeUrl: content.youtube_url,
      summary: content.summary,
      body: content.body,
    };
  }

  async recordContentProgress(userId: number, contentId: number): Promise<void> {
    await this.pool.execute(
      `
        INSERT INTO learning_progress (user_id, content_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE watched_at = CURRENT_TIMESTAMP
      `,
      [userId, contentId],
    );
  }

  async listQuizQuestionsByModule(moduleId: number): Promise<LearningQuizQuestion[]> {
    const [rows] = await this.pool.execute<LearningQuizQuestionRow[]>(
      `
        SELECT id, module_id, prompt, options, explanation
        FROM learning_quiz_questions
        WHERE module_id = ?
          AND active = 1
        ORDER BY sort_order ASC
      `,
      [moduleId],
    );

    return rows.map((row) => ({
      id: row.id,
      moduleId: row.module_id,
      prompt: row.prompt,
      options: parseQuestionOptions(row.options),
      explanation: row.explanation,
    }));
  }

  async evaluateQuizAnswers(
    moduleId: number,
    answers: QuizAnswerSubmission[],
  ): Promise<QuizSubmissionResult> {
    const [rows] = await this.pool.execute<LearningQuizQuestionRow[]>(
      `
        SELECT id, prompt, options, correct_option_index, explanation
        FROM learning_quiz_questions
        WHERE module_id = ?
          AND active = 1
        ORDER BY sort_order ASC
      `,
      [moduleId],
    );

    const questionsById = new Map<number, LearningQuizQuestionRow>();
    rows.forEach((question) => {
      questionsById.set(question.id, question);
    });

    const results = answers.map((answer) => {
      const question = questionsById.get(answer.questionId);
      const selectedOptionIndex = Number(answer.selectedOptionIndex);
      const correctIndex = question?.correct_option_index ?? -1;

      return {
        questionId: answer.questionId,
        selectedOptionIndex,
        correctOptionIndex: correctIndex,
        correct: question ? selectedOptionIndex === correctIndex : false,
        explanation: question?.explanation ?? null,
      };
    });

    const correct = results.filter((answer) => answer.correct).length;

    return {
      total: rows.length,
      correct,
      results,
    };
  }

  private async countQuizQuestions(moduleId: number) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `
        SELECT COUNT(*) as total
        FROM learning_quiz_questions
        WHERE module_id = ?
          AND active = 1
      `,
      [moduleId],
    );

    return Number(rows[0]?.total ?? 0);
  }
}

function parseQuestionOptions(value: string[] | string): string[] {
  if (Array.isArray(value)) {
    return value.map((option) => String(option));
  }

  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid quiz options format.');
  }

  return parsed.map((option) => String(option));
}
