import { describe, it, expect } from "vitest";
import { buildLogsFilter, escapeRegExp } from "../src/modules/logs/logs.filter";

describe("buildLogsFilter", () => {
  it("filtra por method en mayúsculas sobre http.method", () => {
    const f = buildLogsFilter({ method: "post" }) as Record<string, unknown>;
    expect(f["http.method"]).toBe("POST");
  });

  it("filtra por statusCode exacto sobre http.status", () => {
    const f = buildLogsFilter({ statusCode: 404 }) as Record<string, unknown>;
    expect(f["http.status"]).toBe(404);
  });

  it("statusCode = 0 no debería ocurrir, pero null/undefined se ignora", () => {
    const f = buildLogsFilter({}) as Record<string, unknown>;
    expect("http.status" in f).toBe(false);
  });

  it("module se traduce a regex de prefijo anclada sobre event", () => {
    const f = buildLogsFilter({ module: "auth" }) as Record<string, unknown>;
    expect(f.event).toEqual({ $regex: "^auth(\\.|$)" });
  });

  it("event exacto tiene prioridad sobre module", () => {
    const f = buildLogsFilter({ event: "auth.login", module: "atenciones" }) as Record<
      string,
      unknown
    >;
    expect(f.event).toBe("auth.login");
  });

  it("escapa metacaracteres del module", () => {
    const f = buildLogsFilter({ module: "a.b" }) as Record<string, unknown>;
    expect(f.event).toEqual({ $regex: "^a\\.b(\\.|$)" });
  });

  it("construye rango de fechas con $gte/$lte", () => {
    const f = buildLogsFilter({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T23:59:59.000Z",
    }) as { ts?: { $gte?: Date; $lte?: Date } };
    expect(f.ts?.$gte).toBeInstanceOf(Date);
    expect(f.ts?.$lte).toBeInstanceOf(Date);
  });

  it("combina filtros básicos sin perder compatibilidad", () => {
    const f = buildLogsFilter({
      level: "error",
      service: "gestionguias-api",
      actorUserId: "u1",
      requestId: "r1",
      q: "boom",
    }) as Record<string, unknown>;
    expect(f.level).toBe("error");
    expect(f.service).toBe("gestionguias-api");
    expect(f["actor.userId"]).toBe("u1");
    expect(f.requestId).toBe("r1");
    expect(f.$text).toEqual({ $search: "boom" });
  });

  it("escapeRegExp escapa caracteres especiales", () => {
    expect(escapeRegExp("a.b*c")).toBe("a\\.b\\*c");
  });
});
