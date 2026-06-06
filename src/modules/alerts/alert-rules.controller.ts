import type { Request, Response } from "express";
import { CreateAlertRuleSchema, UpdateAlertRuleSchema, EvaluateQuerySchema } from "./alert-rules.schema";
import type { AlertRulesService } from "./alert-rules.service";

export class AlertRulesController {
  constructor(private service: AlertRulesService) {}

  list = async (_req: Request, res: Response) => {
    const rules = await this.service.findAll();
    res.status(200).json({ data: rules, meta: null, error: null });
  };

  getById = async (req: Request, res: Response) => {
    const id = String(req.params.id ?? "");
    const rule = await this.service.findById(id);
    if (!rule) {
      res.status(404).json({
        data: null,
        meta: null,
        error: { code: "NOT_FOUND", message: "Alert rule not found", details: null }
      });
      return;
    }
    res.status(200).json({ data: rule, meta: null, error: null });
  };

  create = async (req: Request, res: Response) => {
    const input = CreateAlertRuleSchema.parse(req.body);
    const rule = await this.service.create(input);
    res.status(201).json({ data: rule, meta: null, error: null });
  };

  update = async (req: Request, res: Response) => {
    const id = String(req.params.id ?? "");
    const patch = UpdateAlertRuleSchema.parse(req.body);
    const rule = await this.service.update(id, patch);
    if (!rule) {
      res.status(404).json({
        data: null,
        meta: null,
        error: { code: "NOT_FOUND", message: "Alert rule not found", details: null }
      });
      return;
    }
    res.status(200).json({ data: rule, meta: null, error: null });
  };

  delete = async (req: Request, res: Response) => {
    const id = String(req.params.id ?? "");
    const deleted = await this.service.delete(id);
    if (!deleted) {
      res.status(404).json({
        data: null,
        meta: null,
        error: { code: "NOT_FOUND", message: "Alert rule not found", details: null }
      });
      return;
    }
    res.status(200).json({ data: { deleted: true }, meta: null, error: null });
  };

  evaluate = async (req: Request, res: Response) => {
    const query = EvaluateQuerySchema.parse(req.query);
    const results = await this.service.evaluate(query);
    res.status(200).json({ data: results, meta: null, error: null });
  };
}
