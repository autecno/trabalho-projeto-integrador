import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface AppointmentRating {
  id: number;
  appointmentId: number;
  evaluatorUserId: number;
  evaluatedUserId: number;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppointmentRatingData {
  appointmentId: number;
  evaluatorUserId: number;
  evaluatedUserId: number;
  score: number;
}

export interface UserRatingSummary {
  userId: number;
  averageScore: number;
  totalRatings: number;
}

export interface AppointmentRatingRepository {
  ensureSchema(): Promise<void>;
  create(data: CreateAppointmentRatingData): Promise<AppointmentRating>;
  findByAppointmentAndEvaluator(
    appointmentId: number,
    evaluatorUserId: number,
  ): Promise<AppointmentRating | null>;
  listByAppointmentIdsForEvaluator(
    appointmentIds: number[],
    evaluatorUserId: number,
  ): Promise<AppointmentRating[]>;
  listReceivedSummariesByUserIds(userIds: number[]): Promise<UserRatingSummary[]>;
}

type AppointmentRatingRow = RowDataPacket & {
  id: number;
  appointment_id: number;
  evaluator_user_id: number;
  evaluated_user_id: number;
  score: number;
  created_at: Date;
  updated_at: Date;
};

type UserRatingSummaryRow = RowDataPacket & {
  user_id: number;
  average_score: number;
  total_ratings: number;
};

export class MySqlAppointmentRatingRepository implements AppointmentRatingRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS appointment_ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        appointment_id INT NOT NULL,
        evaluator_user_id INT NOT NULL,
        evaluated_user_id INT NOT NULL,
        score TINYINT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_appointment_rater (appointment_id, evaluator_user_id),
        INDEX idx_ratings_evaluated_user (evaluated_user_id),
        INDEX idx_ratings_evaluator_user (evaluator_user_id),
        CONSTRAINT fk_ratings_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
        CONSTRAINT fk_ratings_evaluator_user FOREIGN KEY (evaluator_user_id) REFERENCES users(id),
        CONSTRAINT fk_ratings_evaluated_user FOREIGN KEY (evaluated_user_id) REFERENCES users(id)
      )
    `);
  }

  async create(data: CreateAppointmentRatingData): Promise<AppointmentRating> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `
        INSERT INTO appointment_ratings (
          appointment_id,
          evaluator_user_id,
          evaluated_user_id,
          score
        )
        VALUES (?, ?, ?, ?)
      `,
      [data.appointmentId, data.evaluatorUserId, data.evaluatedUserId, data.score],
    );

    const [rows] = await this.pool.execute<AppointmentRatingRow[]>(
      `
        SELECT id, appointment_id, evaluator_user_id, evaluated_user_id, score, created_at, updated_at
        FROM appointment_ratings
        WHERE id = ?
        LIMIT 1
      `,
      [result.insertId],
    );

    const createdRating = rows[0];
    if (!createdRating) {
      throw new Error('Failed to retrieve created appointment rating.');
    }

    return mapAppointmentRatingRow(createdRating);
  }

  async findByAppointmentAndEvaluator(
    appointmentId: number,
    evaluatorUserId: number,
  ): Promise<AppointmentRating | null> {
    const [rows] = await this.pool.execute<AppointmentRatingRow[]>(
      `
        SELECT id, appointment_id, evaluator_user_id, evaluated_user_id, score, created_at, updated_at
        FROM appointment_ratings
        WHERE appointment_id = ?
          AND evaluator_user_id = ?
        LIMIT 1
      `,
      [appointmentId, evaluatorUserId],
    );

    const rating = rows[0];
    return rating ? mapAppointmentRatingRow(rating) : null;
  }

  async listByAppointmentIdsForEvaluator(
    appointmentIds: number[],
    evaluatorUserId: number,
  ): Promise<AppointmentRating[]> {
    if (appointmentIds.length === 0) {
      return [];
    }

    const placeholders = appointmentIds.map(() => '?').join(', ');
    const [rows] = await this.pool.execute<AppointmentRatingRow[]>(
      `
        SELECT id, appointment_id, evaluator_user_id, evaluated_user_id, score, created_at, updated_at
        FROM appointment_ratings
        WHERE evaluator_user_id = ?
          AND appointment_id IN (${placeholders})
      `,
      [evaluatorUserId, ...appointmentIds],
    );

    return rows.map(mapAppointmentRatingRow);
  }

  async listReceivedSummariesByUserIds(userIds: number[]): Promise<UserRatingSummary[]> {
    if (userIds.length === 0) {
      return [];
    }

    const placeholders = userIds.map(() => '?').join(', ');
    const [rows] = await this.pool.execute<UserRatingSummaryRow[]>(
      `
        SELECT
          evaluated_user_id AS user_id,
          ROUND(AVG(score), 2) AS average_score,
          COUNT(*) AS total_ratings
        FROM appointment_ratings
        WHERE evaluated_user_id IN (${placeholders})
        GROUP BY evaluated_user_id
      `,
      userIds,
    );

    return rows.map((row) => ({
      userId: row.user_id,
      averageScore: Number(row.average_score),
      totalRatings: row.total_ratings,
    }));
  }
}

function mapAppointmentRatingRow(row: AppointmentRatingRow): AppointmentRating {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    evaluatorUserId: row.evaluator_user_id,
    evaluatedUserId: row.evaluated_user_id,
    score: row.score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
