// ============================================================
// Hafif veritabanı katmanı — DevLake'in (veya başka bir metrics DB'nin)
// üstüne hibrit modda bağlanmak için.
//
// DevLake varsayılanı MySQL'dir; PostgreSQL de desteklenir. Bu katman
// bağlantı string'inin şemasına (mysql:// / postgres://) bakarak doğru
// driver'ı DİNAMİK import eder; böylece kullanılmayan driver bir bağımlılık
// olmaz ve air-gapped kurulumda sadece gereken sürücü kurulur.
//
// SQL'ler `?` placeholder'ı ile yazılır; PostgreSQL için otomatik olarak
// `$1, $2 ...` biçimine çevrilir. Böylece sorgular tek bir biçimde tutulur.
// ============================================================

export type Dialect = "mysql" | "postgres";

export interface DbClient {
  dialect: Dialect;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  /** Rezerve kelime olan kolon adlarını dialect'e göre tırnaklar (ör. `table`) */
  q(ident: string): string;
}

function detectDialect(url: string): Dialect {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgres";
  }
  // DevLake varsayılanı MySQL
  return "mysql";
}

/** `?` placeholder'larını PostgreSQL'in `$n` biçimine çevirir */
function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Bağlantı string'ine göre uygun driver ile bir DbClient oluşturur.
 * Driver (mysql2 / pg) runtime'da string ad üzerinden import edilir.
 */
export async function createDbClient(url: string): Promise<DbClient> {
  const dialect = detectDialect(url);

  if (dialect === "mysql") {
    let mysql: { createPool: (url: string) => MysqlPool };
    try {
      const moduleName = "mysql2/promise";
      mysql = (await import(/* webpackIgnore: true */ moduleName)) as never;
    } catch {
      throw new Error(
        "[db] 'mysql2' paketi kurulu değil. DevLake MySQL için `npm install mysql2` çalıştırın.",
      );
    }
    const pool = mysql.createPool(url);
    return {
      dialect,
      async query<T>(sql: string, params: unknown[] = []) {
        const [rows] = await pool.query(sql, params);
        return rows as T[];
      },
      q: (ident: string) => "`" + ident + "`",
    };
  }

  // PostgreSQL
  let pg: { Pool: new (config: { connectionString: string }) => PgPool };
  try {
    const moduleName = "pg";
    pg = (await import(/* webpackIgnore: true */ moduleName)) as never;
  } catch {
    throw new Error(
      "[db] 'pg' paketi kurulu değil. PostgreSQL için `npm install pg` çalıştırın.",
    );
  }
  const pool = new pg.Pool({ connectionString: url });
  return {
    dialect,
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(toPgPlaceholders(sql), params);
      return res.rows as T[];
    },
    q: (ident: string) => '"' + ident + '"',
  };
}

// --- Driver'ların ihtiyaç duyulan minimal yüzeyleri (opsiyonel @types için) ---
interface MysqlPool {
  query(sql: string, params: unknown[]): Promise<[unknown, unknown]>;
}
interface PgPool {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
}
