import type { AlertRuleDocument } from "./alert-rules.types";
import type { CreateAlertRuleInput, UpdateAlertRuleInput } from "./alert-rules.schema";

export interface AlertRuleRecord extends AlertRuleDocument {
  id: string;
}

export interface AlertRulesRepository {
  create(input: CreateAlertRuleInput): Promise<AlertRuleRecord>;
  findAll(): Promise<AlertRuleRecord[]>;
  findById(id: string): Promise<AlertRuleRecord | null>;
  update(id: string, patch: UpdateAlertRuleInput): Promise<AlertRuleRecord | null>;
  delete(id: string): Promise<boolean>;
}
