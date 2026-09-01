export type SqliteBinding = string | number | bigint | boolean | Uint8Array | null

export interface SqliteStatement {
  get(...bindings: SqliteBinding[]): unknown
  all(...bindings: SqliteBinding[]): unknown[]
  run(...bindings: SqliteBinding[]): { changes: number | bigint }
}

export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement
  exec(sql: string): unknown
  transaction<T extends (...args: never[]) => unknown>(callback: T): T
  close(): void
}

export async function openSqlite(
  path: string,
  options: { readonly?: boolean } = {},
): Promise<SqliteDatabase> {
  const readonly = options.readonly ?? false
  if (process.versions.bun) {
    const moduleName = 'bun:sqlite'
    const { Database } = await import(moduleName)
    return (
      readonly ? new Database(path, { readonly: true }) : new Database(path)
    ) as SqliteDatabase
  }
  const moduleName = 'better-sqlite3'
  const imported = await import(moduleName)
  const Database = imported.default
  return new Database(path, {
    readonly,
    fileMustExist: readonly,
  }) as SqliteDatabase
}
