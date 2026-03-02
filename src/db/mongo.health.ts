import { Db } from "mongodb";

export async function mongoHealth(db: Db): Promise<{ ok: boolean; details: any }> {
  try {
    const admin = db.admin();
    const ping = await admin.ping();

    // Confirmar colecciones (no falla si no existen, pero ayuda a debug)
    const cols = await db.listCollections({}, { nameOnly: true }).toArray();
    const colNames = cols.map((c) => c.name);

    return {
      ok: !!ping?.ok,
      details: {
        ping,
        db: db.databaseName,
        collections: colNames
      }
    };
  } catch (err: any) {
    return {
      ok: false,
      details: {
        error: err?.message ?? String(err)
      }
    };
  }
}
