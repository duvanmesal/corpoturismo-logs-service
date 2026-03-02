import { SENSITIVE_KEYS } from "@/libs/logger/redaction.rules";

const REDACTED = "[REDACTED]";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

function shouldRedactKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}

export function sanitizeLogPayload<T>(input: T): T {
  // primitives
  if (input === null || input === undefined) return input;
  if (typeof input !== "object") return input;

  // arrays
  if (Array.isArray(input)) {
    return input.map((v) => sanitizeLogPayload(v)) as unknown as T;
  }

  // dates
  if (input instanceof Date) return input;

  // plain objects
  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (shouldRedactKey(key)) {
        out[key] = REDACTED;
        continue;
      }

      // Special case: headers object often contains authorization/cookies nested
      if (key.toLowerCase() === "headers" && isPlainObject(value)) {
        out[key] = sanitizeLogPayload(value);
        continue;
      }

      out[key] = sanitizeLogPayload(value);
    }
    return out as T;
  }

  // other objects (Map, Set, class instances): best-effort stringify-safe
  try {
    return JSON.parse(JSON.stringify(input)) as T;
  } catch {
    return input;
  }
}
