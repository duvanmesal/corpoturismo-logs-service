import type { CreateLogInput, LogDocument } from "./logs.types";
import type { LogsFacetsQuery } from "./logs.facets.schema";
import type { LogsTimelineQuery } from "./logs.timeline.schema";

export type LogsQuery = {
  from?: string;
  to?: string;

  level?: "debug" | "info" | "warn" | "error";
  event?: string;
  service?: string;

  actorUserId?: string;
  requestId?: string;

  entity?: string;
  entityId?: string;

  // Fase 3: filtros exactos http.* y módulo (prefijo de event)
  method?: string;
  statusCode?: number;
  module?: string;

  q?: string;

  page: number;
  pageSize: number;

  sort: "ts";
  order: "asc" | "desc";
};

export type LogsStatsQuery = {
  from?: string;
  to?: string;

  level?: "debug" | "info" | "warn" | "error";
  event?: string;
  service?: string;

  actorUserId?: string;
  requestId?: string;

  entity?: string;
  entityId?: string;

  // Fase 3: filtros exactos http.* y módulo (prefijo de event)
  method?: string;
  statusCode?: number;
  module?: string;

  q?: string;

  topEventsLimit: number;
  tz: string;
};

export type LogsStatsResult = {
  byLevel: Array<{ level: string; count: number }>;
  topEvents: Array<{ event: string; count: number }>;
  errorsByDay: Array<{ day: string; count: number }>;
};

export type LogsFacetsResult = {
  services: Array<{ value: string; count: number }>;
  modules: Array<{ value: string; count: number }>;
  events: Array<{ value: string; count: number }>;
  levels: Array<{ value: string; count: number }>;
  methods: Array<{ value: string; count: number }>;
  statusCodes: Array<{ value: number; count: number }>;
  actors: Array<{ value: string; count: number }>;
  targets: Array<{ value: string; count: number }>;
};

export type LogsTimelineBucket = {
  ts: string; // ISO string representing bucket start
  debug: number;
  info: number;
  warn: number;
  error: number;
  total: number;
};;

export interface LogsRepository {
  insertOne(input: CreateLogInput): Promise<{ insertedId: string }>;
  insertMany(inputs: CreateLogInput[]): Promise<{ insertedCount: number }>;

  findMany(query: LogsQuery): Promise<{
    items: Array<LogDocument & { _id: any }>;
    total: number;
  }>;

  findById(id: string): Promise<(LogDocument & { _id: any }) | null>;
  stats(query: LogsStatsQuery): Promise<LogsStatsResult>;
  facets(query: LogsFacetsQuery): Promise<LogsFacetsResult>;
  timeline(query: LogsTimelineQuery): Promise<LogsTimelineBucket[]>;
}
