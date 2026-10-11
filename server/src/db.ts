// @ts-ignore
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

function getDbPath(): string {
  if (process.env.DB_PATH) return path.resolve(process.env.DB_PATH);
  return path.resolve(ROOT_DIR, 'patchwork.db');
}

const DB_PATH = getDbPath();

let rawDb: SqlJsDatabase | null = null;
let wrappedDb: DatabaseCompat | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (rawDb) {
      try {
        const data = rawDb.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
      } catch (err) {
        console.error('Error auto-saving SQLite database:', err);
      }
    }
  }, 100);
}

function normalizeParams(params: any[]): any[] {
  let flat = params;
  if (params.length === 1 && Array.isArray(params[0])) {
    flat = params[0];
  }
  return flat.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

class StatementWrapper {
  constructor(private db: SqlJsDatabase, private sql: string) {}

  get(...params: any[]): any | undefined {
    const flat = normalizeParams(params);
    const stmt = this.db.prepare(this.sql);
    try {
      if (flat.length > 0) {
        stmt.bind(flat);
      }
      if (stmt.step()) {
        const row = stmt.getAsObject();
        return row;
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  all(...params: any[]): any[] {
    const flat = normalizeParams(params);
    const stmt = this.db.prepare(this.sql);
    const rows: any[] = [];
    try {
      if (flat.length > 0) {
        stmt.bind(flat);
      }
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    const flat = normalizeParams(params);
    this.db.run(this.sql, flat);
    scheduleSave();
    const changes = this.db.getRowsModified();
    let lastInsertRowid = 0;
    try {
      const res = this.db.exec('SELECT last_insert_rowid() as id');
      if (res && res[0] && res[0].values && res[0].values[0]) {
        lastInsertRowid = Number(res[0].values[0][0]) || 0;
      }
    } catch {}
    return { changes, lastInsertRowid };
  }
}

export class DatabaseCompat {
  constructor(private db: SqlJsDatabase) {}

  prepare(sql: string) {
    return new StatementWrapper(this.db, sql);
  }

  exec(sql: string) {
    this.db.exec(sql);
    scheduleSave();
  }

  run(sql: string, params: any[] = []) {
    const flat = normalizeParams(params);
    this.db.run(sql, flat);
    scheduleSave();
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      this.db.run('BEGIN TRANSACTION;');
      try {
        const result = fn(...args);
        this.db.run('COMMIT;');
        scheduleSave();
        return result;
      } catch (err) {
        try {
          this.db.run('ROLLBACK;');
        } catch {}
        throw err;
      }
    }) as T;
  }
}

export async function initDb(): Promise<DatabaseCompat> {
  if (wrappedDb) return wrappedDb;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(buffer);
  } else {
    rawDb = new SQL.Database();
  }

  initSchema(rawDb);
  wrappedDb = new DatabaseCompat(rawDb);
  saveDb();
  return wrappedDb;
}

export function getDb(): DatabaseCompat {
  if (!wrappedDb) {
    throw new Error('Database not initialized. Ensure initDb() is awaited at startup.');
  }
  return wrappedDb;
}

export function saveDb() {
  if (rawDb) {
    const data = rawDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

export function runStmt(sql: string, params: any[] = []): void {
  getDb().prepare(sql).run(...params);
}

export function runInsert(sql: string, params: any[] = []): void {
  getDb().prepare(sql).run(...params);
}

export function getOne(sql: string, params: any[] = []): any | null {
  return getDb().prepare(sql).get(...params) ?? null;
}

export function getAll(sql: string, params: any[] = []): any[] {
  return getDb().prepare(sql).all(...params);
}

function initSchema(db: SqlJsDatabase) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      baseUrl TEXT NOT NULL,
      siteKey TEXT NOT NULL UNIQUE,
      liveReleaseId TEXT,
      autoRollback INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      siteId TEXT NOT NULL,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'RUNNING',
      progress INTEGER DEFAULT 0,
      summary TEXT,
      screenshotPath TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      scanId TEXT NOT NULL,
      ruleId TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      pageUrl TEXT NOT NULL,
      selector TEXT,
      fingerprint TEXT,
      evidence TEXT,
      suggestedPatchId TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patches (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      source TEXT NOT NULL,
      riskLevel TEXT NOT NULL,
      riskScore INTEGER NOT NULL DEFAULT 0,
      riskReasons TEXT,
      issueId TEXT,
      authorId TEXT NOT NULL,
      targetPageUrlPattern TEXT NOT NULL,
      targetSelector TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      operations TEXT NOT NULL,
      health TEXT NOT NULL DEFAULT 'UNKNOWN',
      healthDetail TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      patchId TEXT NOT NULL,
      authorId TEXT NOT NULL,
      body TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      patchId TEXT NOT NULL,
      reviewerId TEXT NOT NULL,
      decision TEXT NOT NULL,
      comment TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id TEXT PRIMARY KEY,
      patchAId TEXT NOT NULL,
      patchBId TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      detail TEXT,
      resolution TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS previews (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      patchIds TEXT NOT NULL,
      createdById TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS releases (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'BUILDING',
      note TEXT,
      bundle TEXT,
      bundleHash TEXT,
      parentReleaseId TEXT,
      deployedById TEXT,
      testRunId TEXT,
      deployedAt TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS testruns (
      id TEXT PRIMARY KEY,
      trigger TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      releaseId TEXT,
      previewId TEXT,
      summary TEXT,
      startedAt TEXT NOT NULL,
      finishedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS teststeps (
      id TEXT PRIMARY KEY,
      testRunId TEXT NOT NULL,
      flowName TEXT NOT NULL,
      stepIndex INTEGER NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PASSED',
      error TEXT,
      baselineShot TEXT,
      currentShot TEXT,
      diffShot TEXT,
      diffPercent REAL
    );

    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      steps TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY,
      actorId TEXT NOT NULL,
      actorName TEXT NOT NULL,
      action TEXT NOT NULL,
      targetType TEXT NOT NULL,
      targetId TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata TEXT,
      createdAt TEXT NOT NULL
    );
  `);

  try {
    const siteRows = db.exec('SELECT COUNT(*) as c FROM site');
    const siteCount = (siteRows[0]?.values[0]?.[0] as number) || 0;
    if (siteCount === 0) {
      db.run(`
        INSERT INTO site (id, name, baseUrl, siteKey, autoRollback)
        VALUES ('site-main', 'Production Site', '', 'production-site', 1);
      `);
    }

    const userRows = db.exec('SELECT id FROM users');
    const existingUserIds = (userRows[0]?.values || []).map((v: any) => v[0]);
    if (!existingUserIds.includes('asha')) {
      db.run(`INSERT INTO users (id, name, role) VALUES ('asha', 'Asha', 'DEVELOPER');`);
    }
    if (!existingUserIds.includes('kiran')) {
      db.run(`INSERT INTO users (id, name, role) VALUES ('kiran', 'Kiran', 'DEVELOPER');`);
    }
    if (!existingUserIds.includes('ravi')) {
      db.run(`INSERT INTO users (id, name, role) VALUES ('ravi', 'Ravi', 'REVIEWER');`);
    }
    if (!existingUserIds.includes('admin')) {
      db.run(`INSERT INTO users (id, name, role) VALUES ('admin', 'Admin', 'ADMIN');`);
    }
  } catch {}
}

export function clearArtifacts() {
  try {
    if (process.env.ARTIFACTS_DIR) {
      const artifactsDir = path.resolve(process.env.ARTIFACTS_DIR);
      if (fs.existsSync(artifactsDir)) {
        const files = fs.readdirSync(artifactsDir);
        for (const file of files) {
          if (file.endsWith('.png') || file.endsWith('.jpg')) {
            try {
              fs.unlinkSync(path.join(artifactsDir, file));
            } catch {}
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to clear artifacts directory:', err);
  }
}

export function resetDatabase() {
  if (!rawDb) throw new Error('Database not initialized');

  const tables = [
    'audit',
    'teststeps',
    'testruns',
    'releases',
    'previews',
    'conflicts',
    'reviews',
    'comments',
    'patches',
    'issues',
    'scans',
    'flows',
    'site',
    'users',
  ];

  for (const t of tables) {
    try {
      rawDb.run(`DROP TABLE IF EXISTS ${t};`);
    } catch (e) {
      console.warn(`Failed to drop table ${t}:`, e);
    }
  }

  initSchema(rawDb);

  try {
    rawDb.run(`
      INSERT INTO flows (id, name, steps)
      VALUES ('flow-home', 'Homepage Smoke Check', '[{"action":"screenshot","name":"home"}]');
    `);
  } catch {}

  saveDb();
}
