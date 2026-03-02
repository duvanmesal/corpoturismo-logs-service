import type { Collection, Db, Filter, WithId } from "mongodb";
import { ObjectId } from "mongodb";
import type { CreateLogInput, LogDocument } from "@/modules/logs/logs.types";
import type { LogsQuery, LogsRepository } from "@/modules/logs/logs.repository";
import type { LogsStatsQuery, LogsStatsResult } from "@/modules/logs/logs.repository";

export class MongoLogsRepository implements LogsRepository {
  private col: Collection<LogDocument>;

  constructor(db: Db) {
    this.col = db.collection<LogDocument>("logs");
  }

  async insertOne(input: CreateLogInput): Promise<{ insertedId: string }> {
    const doc: LogDocument = {
      ...input,
      ts: input.ts ? new Date(input.ts) : new Date()
    };

    const res = await this.col.insertOne(doc);
    return { insertedId: String(res.insertedId) };
  }

  async insertMany(inputs: CreateLogInput[]): Promise<{ insertedCount: number }> {
    const docs: LogDocument[] = inputs.map((i) => ({
      ...i,
      ts: i.ts ? new Date(i.ts) : new Date()
    }));

    const res = await this.col.insertMany(docs, { ordered: false });
    return { insertedCount: res.insertedCount };
  }

  async findById(id: string): Promise<WithId<LogDocument> | null> {
    if (!ObjectId.isValid(id)) return null;
    return this.col.findOne({ _id: new ObjectId(id) } as any);
  }

  async findMany(query: LogsQuery): Promise<{ items: WithId<LogDocument>[]; total: number }> {
    const filter: Filter<LogDocument> = {};

    // rango fechas
    if (query.from || query.to) {
      filter.ts = {};
      if (query.from) (filter.ts as any).$gte = new Date(query.from);
      if (query.to) (filter.ts as any).$lte = new Date(query.to);
    }

    if (query.level) filter.level = query.level as any;
    if (query.event) filter.event = query.event;
    if (query.service) filter.service = query.service;

    if (query.requestId) filter.requestId = query.requestId;
    if (query.actorUserId) (filter as any)["actor.userId"] = query.actorUserId;

    if (query.entity) (filter as any)["target.entity"] = query.entity;
    if (query.entityId) (filter as any)["target.id"] = query.entityId;

    // Full-text search (usa índice text)
    // Nota: si usas $text, Mongo permite combinarlo con otros filtros.
    if (query.q) {
      (filter as any).$text = { $search: query.q };
    }

    const skip = (query.page - 1) * query.pageSize;
    const limit = query.pageSize;

    const sortDir = query.order === "asc" ? 1 : -1;
    const sort: Record<string, 1 | -1> = { ts: sortDir };

    // Si hay $text, opcionalmente podrías ordenar por score + ts, pero mantenemos simple.
    const cursor = this.col.find(filter).sort(sort).skip(skip).limit(limit);

    const [items, total] = await Promise.all([cursor.toArray(), this.col.countDocuments(filter)]);

    return { items, total };
  }

  async stats(query: LogsStatsQuery): Promise<LogsStatsResult> {
    const match: any = {};

    // rango ts
    if (query.from || query.to) {
      match.ts = {};
      if (query.from) match.ts.$gte = new Date(query.from);
      if (query.to) match.ts.$lte = new Date(query.to);
    }

    if (query.level) match.level = query.level;
    if (query.event) match.event = query.event;
    if (query.service) match.service = query.service;

    if (query.requestId) match.requestId = query.requestId;
    if (query.actorUserId) match["actor.userId"] = query.actorUserId;

    if (query.entity) match["target.entity"] = query.entity;
    if (query.entityId) match["target.id"] = query.entityId;

    // $text (full-text)
    if (query.q) match.$text = { $search: query.q };

    const logsCol = this.col;

    // 1) Conteo por nivel
    const byLevelPromise = logsCol
      .aggregate<{
        _id: string;
        count: number;
      }>([{ $match: match }, { $group: { _id: "$level", count: { $sum: 1 } } }, { $sort: { count: -1 } }])
      .toArray();

    // 2) Top eventos
    const topEventsPromise = logsCol
      .aggregate<{
        _id: string;
        count: number;
      }>([{ $match: match }, { $group: { _id: "$event", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: query.topEventsLimit }])
      .toArray();

    // 3) Errores por día (solo level=error)
    const matchErrors = { ...match, level: "error" as const };

    const errorsByDayPromise = logsCol
      .aggregate<{ _id: string; count: number }>([
        { $match: matchErrors },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$ts", timezone: query.tz }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray();

    const [byLevelRaw, topEventsRaw, errorsByDayRaw] = await Promise.all([
      byLevelPromise,
      topEventsPromise,
      errorsByDayPromise
    ]);

    return {
      byLevel: byLevelRaw.map((x) => ({ level: x._id, count: x.count })),
      topEvents: topEventsRaw.map((x) => ({ event: x._id, count: x.count })),
      errorsByDay: errorsByDayRaw.map((x) => ({ day: x._id, count: x.count }))
    };
  }
}
