import type { Db } from "mongodb";
import type { AlertRulesRepository } from "./alert-rules.repository";
import type { CreateAlertRuleInput, UpdateAlertRuleInput, EvaluateQuery } from "./alert-rules.schema";
import type { AlertRuleEvaluation } from "./alert-rules.types";
import { buildLogsFilter } from "../logs/logs.filter";

export class AlertRulesService {
  constructor(
    private repo: AlertRulesRepository,
    private db: Db
  ) {}

  create(input: CreateAlertRuleInput) {
    return this.repo.create(input);
  }

  findAll() {
    return this.repo.findAll();
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  update(id: string, patch: UpdateAlertRuleInput) {
    return this.repo.update(id, patch);
  }

  delete(id: string) {
    return this.repo.delete(id);
  }

  async evaluate(query: EvaluateQuery): Promise<AlertRuleEvaluation[]> {
    const rules = await this.repo.findAll();
    const enabled = rules.filter((r) => r.enabled);

    if (enabled.length === 0) return [];

    const col = this.db.collection("logs");
    const now = new Date();

    const evaluations = await Promise.all(
      enabled.map(async (rule) => {
        const windowStart = new Date(now.getTime() - rule.windowMinutes * 60_000);

        const filter = buildLogsFilter({
          from: windowStart.toISOString(),
          level: rule.level,
          service: query.service ?? rule.service,
          module: rule.module
        }) as Record<string, unknown>;

        const count = await col.countDocuments(filter);

        return {
          ruleId: rule.id,
          name: rule.name,
          level: rule.level,
          triggered: count >= rule.threshold,
          count,
          threshold: rule.threshold,
          windowMinutes: rule.windowMinutes,
          service: rule.service,
          module: rule.module
        } satisfies AlertRuleEvaluation;
      })
    );

    return evaluations;
  }
}
