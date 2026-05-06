import Dexie, { type Table } from "dexie";

export interface Project {
  id?: number;
  name: string;
  files: Record<string, string>; // filename -> content
  cdns: string[];
  updatedAt: number;
}

class DevSuiteDB extends Dexie {
  projects!: Table<Project, number>;
  constructor() {
    super("devsuite-hub");
    this.version(1).stores({ projects: "++id, name, updatedAt" });
  }
}

export const db = new DevSuiteDB();
