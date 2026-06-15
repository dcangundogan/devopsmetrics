import type { MetricQuery, MetricResult } from "./types";

// `pg` paketi opsiyonel olduğundan, ihtiyaç duyulan minimal yüzeyi burada
// tipliyoruz (paketin @types bağımlılığını zorunlu kılmamak için).
interface PgPool {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
}

// ============================================================
// SQL connector — bazı metrikler doğrudan metrics DB'den SQL query
// ile çekilir (ör. code coverage, test otomasyon oranı geçmişi).
//
// Air-gapped ortamda DB driver'ı opsiyoneldir; bağımlılığı zorunlu
// kılmamak için driver (örn. `pg`) dinamik import edilir. Driver yoksa
// veya METRICS_DB_URL tanımlı değilse anlamlı bir hata fırlatılır.
//
// Gerçek kullanım: aşağıdaki `query()` helper'ı ile parametreli SQL
// çalıştırılır ve sonuç MetricResult'a normalize edilir.
// ============================================================

/**
 * Parametreli SQL query çalıştırır. `pg` paketi runtime'da dinamik
 * import edilir; böylece mock modda bu bağımlılık gerekmez.
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const connectionString = process.env.METRICS_DB_URL;
  if (!connectionString) {
    throw new Error("METRICS_DB_URL tanımlı değil — SQL connector kullanılamaz");
  }

  // Dinamik import: paket yoksa kurulum talimatı içeren hata ver.
  // `pg` opsiyonel bağımlılıktır; tipleri kurulu olmayabileceği için
  // modül adı runtime değişkenine alınarak any olarak ele alınır.
  let pgModule: { Pool: new (config: { connectionString: string }) => PgPool };
  try {
    const moduleName = "pg";
    pgModule = (await import(/* webpackIgnore: true */ moduleName)) as never;
  } catch {
    throw new Error(
      "[sql] 'pg' paketi kurulu değil. SQL connector için `npm install pg` çalıştırın.",
    );
  }

  const { Pool } = pgModule;
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query(sql, params);
    return result.rows as T[];
  } finally {
    await pool.end();
  }
}

/**
 * Örnek: metrics DB'den code coverage geçmişini çeker.
 * Tablo şeması projeye göre değişir; bu sorgu örnek niteliğindedir.
 */
export async function sqlCodeCoverage(
  q: MetricQuery,
): Promise<{ day: string; coverage: number }[]> {
  const componentFilter =
    q.component === "ALL" ? "" : "AND component = $2";
  const params: unknown[] =
    q.component === "ALL" ? [q.period] : [q.period, q.component];

  const sql = `
    SELECT to_char(measured_at, 'YYYY-MM-DD') AS day,
           AVG(coverage_pct)::numeric(5,1) AS coverage
    FROM code_coverage
    WHERE measured_at >= now() - ($1 || ' days')::interval
    ${componentFilter}
    GROUP BY day
    ORDER BY day ASC
  `;
  return query<{ day: string; coverage: number }>(sql, params);
}

/**
 * SQL kaynaklı bir DORA metriği örneği. Çoğu DORA metriği Jira/Jenkins'ten
 * gelir; ancak metrics DB'de hazır agregasyon varsa buradan da çekilebilir.
 * Şimdilik implemente edilmedi — gerektiğinde `query()` ile doldurulur.
 */
export async function sqlMetricPlaceholder(
  _query: MetricQuery,
): Promise<MetricResult> {
  throw new Error(
    "[sql] DORA metrikleri SQL'den çekilmiyor; Jira/Jenkins connector kullanın.",
  );
}
