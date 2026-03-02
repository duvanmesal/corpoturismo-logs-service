import type { LogsRepository, LogsQuery } from "@/modules/logs/logs.repository";
import type { CreateLogInput } from "@/modules/logs/logs.types";
import { sanitizeLogPayload } from "@/libs/logger/sanitize";
import type { LogsStatsQuery } from "@/modules/logs/logs.repository";

export class LogsService {
  constructor(private repo: LogsRepository) {}

  async ingestOne(input: CreateLogInput): Promise<{ id: string }> {
    const sanitized = sanitizeLogPayload(input);
    const res = await this.repo.insertOne(sanitized);
    return { id: res.insertedId };
  }

  async ingestBatch(inputs: CreateLogInput[]): Promise<{ insertedCount: number }> {
    const sanitizedItems = inputs.map((i) => sanitizeLogPayload(i));
    return this.repo.insertMany(sanitizedItems);
  }

  async list(query: LogsQuery) {
    const { items, total } = await this.repo.findMany(query);

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    };
  }

  async getById(id: string) {
    return this.repo.findById(id);
  }

  async stats(query: LogsStatsQuery) {
    return this.repo.stats(query);
  }
}
