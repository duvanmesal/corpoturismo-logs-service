import type { Request, Response } from "express";
import { CreateLogBatchSchema, CreateLogSchema } from "@/modules/logs/logs.schema";
import { LogsQuerySchema } from "@/modules/logs/logs.query.schema";
import type { LogsService } from "@/modules/logs/logs.service";
import { LogsStatsQuerySchema } from "@/modules/logs/logs.stats.schema";

export class LogsController {
  constructor(private service: LogsService) {}

  create = async (req: Request, res: Response) => {
    const parsed = CreateLogSchema.parse(req.body);
    const requestId = parsed.requestId ?? (req as any).requestId;

    const result = await this.service.ingestOne({ ...parsed, requestId });
    res.status(201).json({ data: result, meta: null, error: null });
  };

  batch = async (req: Request, res: Response) => {
    const parsed = CreateLogBatchSchema.parse(req.body);
    const requestId = (req as any).requestId as string | undefined;

    const result = await this.service.ingestBatch(
      parsed.items.map((i) => ({ ...i, requestId: i.requestId ?? requestId }))
    );

    res.status(201).json({ data: result, meta: null, error: null });
  };

  list = async (req: Request, res: Response) => {
    const parsed = LogsQuerySchema.parse(req.query);

    const result = await this.service.list(parsed);

    res.status(200).json({
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages
      },
      error: null
    });
  };

  getById = async (req: Request, res: Response) => {
    const id = String(req.params.id);

    const doc = await this.service.getById(id);

    if (!doc) {
      res.status(404).json({
        data: null,
        meta: null,
        error: { code: "NOT_FOUND", message: "Log not found", details: null }
      });
      return;
    }

    res.status(200).json({ data: doc, meta: null, error: null });
  };

  stats = async (req: Request, res: Response) => {
    const parsed = LogsStatsQuerySchema.parse(req.query);

    const result = await this.service.stats(parsed);

    res.status(200).json({
      data: result,
      meta: null,
      error: null
    });
  };
}
