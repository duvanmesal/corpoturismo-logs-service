export type AlertRuleLevel = "error" | "warn";

export interface AlertRuleDocument {
  name: string;
  description?: string;
  level: AlertRuleLevel;
  windowMinutes: number;
  threshold: number;
  service?: string;
  module?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertRuleEvaluation {
  ruleId: string;
  name: string;
  level: AlertRuleLevel;
  triggered: boolean;
  count: number;
  threshold: number;
  windowMinutes: number;
  service?: string;
  module?: string;
}
