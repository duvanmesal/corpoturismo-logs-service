import type { Collection, Db, WithId } from "mongodb";
import { ObjectId } from "mongodb";
import type { AlertRuleDocument } from "./alert-rules.types";
import type { AlertRulesRepository, AlertRuleRecord } from "./alert-rules.repository";
import type { CreateAlertRuleInput, UpdateAlertRuleInput } from "./alert-rules.schema";

function toRecord(doc: WithId<AlertRuleDocument>): AlertRuleRecord {
  return {
    id: String(doc._id),
    name: doc.name,
    description: doc.description,
    level: doc.level,
    windowMinutes: doc.windowMinutes,
    threshold: doc.threshold,
    service: doc.service,
    module: doc.module,
    enabled: doc.enabled,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

export class MongoAlertRulesRepository implements AlertRulesRepository {
  private col: Collection<AlertRuleDocument>;

  constructor(db: Db) {
    this.col = db.collection<AlertRuleDocument>("alert_rules");
  }

  async create(input: CreateAlertRuleInput): Promise<AlertRuleRecord> {
    const now = new Date();
    const doc: AlertRuleDocument = {
      name: input.name,
      description: input.description,
      level: input.level,
      windowMinutes: input.windowMinutes,
      threshold: input.threshold,
      service: input.service,
      module: input.module,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now
    };
    const res = await this.col.insertOne(doc);
    return toRecord({ ...doc, _id: res.insertedId });
  }

  async findAll(): Promise<AlertRuleRecord[]> {
    const docs = await this.col.find({}).sort({ createdAt: -1 }).toArray();
    return docs.map(toRecord);
  }

  async findById(id: string): Promise<AlertRuleRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const doc = await this.col.findOne({ _id: new ObjectId(id) } as any);
    return doc ? toRecord(doc) : null;
  }

  async update(id: string, patch: UpdateAlertRuleInput): Promise<AlertRuleRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const doc = await this.col.findOneAndUpdate(
      { _id: new ObjectId(id) } as any,
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    return doc ? toRecord(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const res = await this.col.deleteOne({ _id: new ObjectId(id) } as any);
    return res.deletedCount === 1;
  }
}
