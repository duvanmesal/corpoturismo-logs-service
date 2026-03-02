export type LogLevel = "info" | "warn" | "error";

export type LogActor = {
  userId?: string;
  email?: string;
  role?: string;
};

export type LogTarget = {
  entity?: string;
  id?: string;
  email?: string;
};

export type LogHttp = {
  method?: string;
  path?: string;
  status?: number;
  ip?: string;
  userAgent?: string;
  durationMs?: number;
};

export type CreateLogInput = {
  level: LogLevel;
  event: string;
  message?: string;
  service?: string;
  requestId?: string;
  actor?: LogActor;
  target?: LogTarget;
  http?: LogHttp;
  meta?: Record<string, unknown>;
  ts?: string; // ISO
};

export type LogDocument = Omit<CreateLogInput, "ts"> & {
  ts: Date;
};
