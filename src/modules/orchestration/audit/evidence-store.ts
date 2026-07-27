import type { EvidenceRecord } from "../domain/evidence";

export class EvidenceStore {
  private readonly records: EvidenceRecord[] = [];

  add(record: EvidenceRecord): EvidenceRecord {
    this.records.push(record);
    return record;
  }

  forWorkUnit(workUnitId: string): EvidenceRecord[] {
    return this.records.filter((record) => record.workUnitId === workUnitId);
  }
}
