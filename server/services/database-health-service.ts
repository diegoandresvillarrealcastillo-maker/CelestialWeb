import type { Pool } from 'pg';
import type { HealthService } from './contracts.js';

export class PostgresDatabaseHealthService implements HealthService {
  constructor(private pool: Pool) {}

  async checkDatabase() {
    await this.pool.query('SELECT 1');
  }
}
