import initSqlJs, { type Database as SqlJsDatabase } from "sql.js"
import { homedir } from "os"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs"
import path from "path"

const DATA_DIR = path.join(homedir(), ".agent-os-bridge")
mkdirSync(DATA_DIR, { recursive: true })
mkdirSync(path.join(DATA_DIR, "logs"), { recursive: true })

const DB_PATH = path.join(DATA_DIR, "bridge.db")

let _db: SqlJsDatabase

/**
 * Thin wrapper around sql.js that mimics the better-sqlite3 API surface
 * we use (prepare().run/get/all, exec).
 */
export interface DB {
  exec(sql: string): void
  prepare(sql: string): {
    run(...params: any[]): void
    get(...params: any[]): any
    all(...params: any[]): any[]
  }
  save(): void
}

function createWrapper(raw: SqlJsDatabase): DB {
  const save = () => {
    const data = raw.export()
    writeFileSync(DB_PATH, Buffer.from(data))
  }

  return {
    exec(sql: string) {
      raw.exec(sql)
      save()
    },
    prepare(sql: string) {
      return {
        run(...params: any[]) {
          raw.run(sql, params)
          save()
        },
        get(...params: any[]): any {
          const stmt = raw.prepare(sql)
          stmt.bind(params)
          if (stmt.step()) {
            const cols = stmt.getColumnNames()
            const vals = stmt.get()
            stmt.free()
            const row: Record<string, any> = {}
            for (let i = 0; i < cols.length; i++) {
              row[cols[i]] = vals[i]
            }
            return row
          }
          stmt.free()
          return undefined
        },
        all(...params: any[]): any[] {
          const results: any[] = []
          const stmt = raw.prepare(sql)
          stmt.bind(params)
          while (stmt.step()) {
            const cols = stmt.getColumnNames()
            const vals = stmt.get()
            const row: Record<string, any> = {}
            for (let i = 0; i < cols.length; i++) {
              row[cols[i]] = vals[i]
            }
            results.push(row)
          }
          stmt.free()
          return results
        },
      }
    },
    save,
  }
}

let _wrapper: DB

export async function initDb(): Promise<DB> {
  if (_wrapper) return _wrapper

  const SQL = await initSqlJs()
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH)
    _db = new SQL.Database(buffer)
  } else {
    _db = new SQL.Database()
  }

  _wrapper = createWrapper(_db)

  _wrapper.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      task_title TEXT NOT NULL,
      task_description TEXT,
      sop_id TEXT,
      adapter TEXT NOT NULL DEFAULT 'claude',
      model TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      session_id TEXT,
      prompt TEXT,
      exit_code INTEGER,
      started_at INTEGER,
      ended_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS task_sessions (
      task_id TEXT NOT NULL,
      adapter TEXT NOT NULL DEFAULT 'claude',
      session_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      PRIMARY KEY (task_id, adapter)
    );
  `)

  return _wrapper
}

// Synchronous accessor — must call initDb() first
export function getDb(): DB {
  if (!_wrapper) throw new Error("Database not initialized — call initDb() first")
  return _wrapper
}

export type Run = {
  id: string
  task_id: string
  task_title: string
  task_description?: string
  sop_id?: string
  adapter: string
  model?: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stopped' | 'process_lost'
  session_id?: string
  prompt?: string
  exit_code?: number
  started_at?: number
  ended_at?: number
  created_at: number
}
