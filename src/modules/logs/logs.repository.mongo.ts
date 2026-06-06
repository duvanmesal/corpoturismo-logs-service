import type { Collection, Db, WithId } from "mongodb";
import { ObjectId } from "mongodb";
import type { CreateLogInput, LogDocument } from "./logs.types";
import type { LogsQuery, LogsRepository, LogsFacetsResult, LogsTimelineBucket } from "./logs.repository";
import type { LogsStatsQuery, LogsStatsResult } from "./logs.repository";
import { buildLogsFilter } from "./logs.filter";
import type { LogsFacetsQuery } from "./logs.facets.schema";
import type { LogsTimelineQuery } from "./logs.timeline.schema";

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
    const filter = buildLogsFilter(query);

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
    // El match de la agregación es el mismo filtro de lectura.
    const match = buildLogsFilter(query) as Record<string, unknown>;

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

  async facets(query: LogsFacetsQuery): Promise<LogsFacetsResult> {
    const match = buildLogsFilter(query) as Record<string, unknown>;
    const limit = query.limit;
    const col = this.col;

    function topAgg(field: string) {
      return col
        .aggregate<{ _id: unknown; count: number }>([
          { $match: match },
          { $group: { _id: `$${field}`, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: limit }
        ])
        .toArray();
    }

    // Module = first segment of event (e.g. "auth.login" → "auth")
    const modulesPromise = col
      .aggregate<{ _id: string; count: number }>([
        { $match: match },
        { $addFields: { _module: { $arrayElemAt: [{ $split: ["$event", "."] }, 0] } } },
        { $group: { _id: "$_module", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit }
      ])
      .toArray();

    const [services, events, levels, methods, statusCodes, actors, targets, modulesRaw] =
      await Promise.all([
        topAgg("service"),
        topAgg("event"),
        topAgg("level"),
        topAgg("http.method"),
        topAgg("http.status"),
        topAgg("actor.userId"),
        topAgg("target.entity"),
        modulesPromise
      ]);

    return {
      services: services.filter((x) => x._id != null).map((x) => ({ value: String(x._id), count: x.count })),
      modules: modulesRaw.filter((x) => x._id != null).map((x) => ({ value: x._id, count: x.count })),
      events: events.filter((x) => x._id != null).map((x) => ({ value: String(x._id), count: x.count })),
      levels: levels.filter((x) => x._id != null).map((x) => ({ value: String(x._id), count: x.count })),
      methods: methods.filter((x) => x._id != null).map((x) => ({ value: String(x._id), count: x.count })),
      statusCodes: statusCodes.filter((x) => x._id != null).map((x) => ({ value: Number(x._id), count: x.count })),
      actors: actors.filter((x) => x._id != null).map((x) => ({ value: String(x._id), count: x.count })),
      targets: targets.filter((x) => x._id != null).map((x) => ({ value: String(x._id), count: x.count }))
    };
  }

  async timeline(query: LogsTimelineQuery): Promise<LogsTimelineBucket[]> {
    const match = buildLogsFilter(query) as Record<string, unknown>;

    const formatByBucket = {
      minute: "%Y-%m-%dT%H:%M",
      hour: "%Y-%m-%dT%H:00",
      day: "%Y-%m-%d"
    } as const;

    const format = formatByBucket[query.bucket];

    const raw = await this.col
      .aggregate<{
        _id: string;
        debug: number;
        info: number;
        warn: number;
        error: number;
        total: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format, date: "$ts", timezone: query.tz } },
            debug: { $sum: { $cond: [{ $eq: ["$level", "debug"] }, 1, 0] } },
            info: { $sum: { $cond: [{ $eq: ["$level", "info"] }, 1, 0] } },
            warn: { $sum: { $cond: [{ $eq: ["$level", "warn"] }, 1, 0] } },
            error: { $sum: { $cond: [{ $eq: ["$level", "error"] }, 1, 0] } },
            total: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray();

    return raw.map((b) => ({
      ts: b._id,
      debug: b.debug,
      info: b.info,
      warn: b.warn,
      error: b.error,
      total: b.total
    }));
  }
}
