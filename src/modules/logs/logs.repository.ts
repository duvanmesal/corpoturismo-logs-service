import type { CreateLogInput, LogDocument } from "@/modules/logs/logs.types";

export type LogsQuery = {
  from?: string;
  to?: string;

  level?: "info" | "warn" | "error";
  event?: string;
  service?: string;

  actorUserId?: string;
  requestId?: string;

  entity?: string;
  entityId?: string;

  q?: string;

  page: number;
  pageSize: number;

  sort: "ts";
  order: "asc" | "desc";
};

export type LogsStatsQuery = {
  from?: string;
  to?: string;

  level?: "info" | "warn" | "error";
  event?: string;
  service?: string;

  actorUserId?: string;
  requestId?: string;

  entity?: string;
  entityId?: string;

  q?: string;

  topEventsLimit: number;
  tz: string;
};

export type LogsStatsResult = {
  byLevel: Array<{ level: string; count: number }>;
  topEvents: Array<{ event: string; count: number }>;
  errorsByDay: Array<{ day: string; count: number }>;
};

export interface LogsRepository {
  insertOne(input: CreateLogInput): Promise<{ insertedId: string }>;
  insertMany(inputs: CreateLogInput[]): Promise<{ insertedCount: number }>;

  findMany(query: LogsQuery): Promise<{
    items: Array<LogDocument & { _id: any }>;
    total: number;
  }>;

  findById(id: string): Promise<(LogDocument & { _id: any }) | null>;
  stats(query: LogsStatsQuery): Promise<LogsStatsResult>;
}
