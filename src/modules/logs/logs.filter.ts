// Construcción pura del filtro Mongo a partir de la query de lectura.
// Aislado del driver para poder testearlo sin base de datos. Lo usan tanto
// findMany como stats (el match de agregación es el mismo filtro).
import type { Filter } from "mongodb";
import type { LogDocument } from "./logs.types";

export type LogsFilterInput = {
  from?: string;
  to?: string;
  level?: "debug" | "info" | "warn" | "error";
  event?: string;
  service?: string;
  actorUserId?: string;
  requestId?: string;
  entity?: string;
  entityId?: string;
  // Filtros exactos sobre http.* (Fase 3)
  method?: string;
  statusCode?: number;
  // module = prefijo del event namespaced (p. ej. "auth" => auth.login, auth.logout)
  module?: string;
  q?: string;
};

/** Escapa metacaracteres para usar un string como literal en una RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildLogsFilter(query: LogsFilterInput): Filter<LogDocument> {
  const filter: Record<string, unknown> = {};

  // Rango de fechas sobre ts
  if (query.from || query.to) {
    const ts: Record<string, Date> = {};
    if (query.from) ts.$gte = new Date(query.from);
    if (query.to) ts.$lte = new Date(query.to);
    filter.ts = ts;
  }

  if (query.level) filter.level = query.level;
  if (query.service) filter.service = query.service;
  if (query.requestId) filter.requestId = query.requestId;
  if (query.actorUserId) filter["actor.userId"] = query.actorUserId;
  if (query.entity) filter["target.entity"] = query.entity;
  if (query.entityId) filter["target.id"] = query.entityId;

  // http.* exactos
  if (query.method) filter["http.method"] = query.method.toUpperCase();
  if (query.statusCode != null) filter["http.status"] = query.statusCode;

  // event: el filtro exacto tiene prioridad sobre el de módulo (prefijo).
  if (query.event) {
    filter.event = query.event;
  } else if (query.module) {
    // Coincide con "module" exacto o "module.<algo>", anclado al inicio.
    filter.event = { $regex: `^${escapeRegExp(query.module)}(\\.|$)` };
  }

  // Full-text (usa índice text sobre message/meta)
  if (query.q) filter.$text = { $search: query.q };

  return filter as Filter<LogDocument>;
}
