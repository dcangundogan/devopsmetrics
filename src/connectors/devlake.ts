import type { MetricQuery, MetricResult, TrendPoint } from "./types";
import {
  DEFAULT_THRESHOLDS,
  activeThreshold,
  computeSeverity,
} from "@/lib/thresholds";
import { createDbClient, type DbClient } from "./db";

// ============================================================
// DevLake connector — HİBRİT mimari.
//
// Apache DevLake, Jira/Jenkins/GitHub vb. kaynaklardan veriyi toplar,
// DORA metriklerini hesaplar ve kendi "domain layer" tablolarında saklar.
// Bu connector, DevLake'in DB'sine doğrudan SQL ile bağlanıp metrikleri
// bizim normalize MetricResult shape'imize çevirir. Yani:
//   DevLake = veri motoru,  bu panel = vitrin.
//
// SQL'ler DevLake'in resmi Grafana DORA dashboard sorgularından uyarlanmıştır
// (devlake.apache.org/docs/Metrics). Grafana makroları ($__timeFilter,
// ${project}) parametreli sorgulara çevrilmiş; tarih/medyan hesapları
// dialect bağımsızlığı için TypeScript tarafında yapılır.
// ============================================================

// DevLake DB pool'u modül seviyesinde tek sefer açılır (request başına değil).
let _client: Promise<DbClient> | null = null;

function getDb(): Promise<DbClient> {
  const url = process.env.DEVLAKE_DB_URL;
  if (!url) {
    throw new Error(
      "DEVLAKE_DB_URL tanımlı değil — DevLake (hibrit) modu kullanılamaz",
    );
  }
  if (!_client) {
    // Hata olursa cache'i temizle ki sonraki istek yeniden denesin.
    _client = createDbClient(url).catch((err) => {
      _client = null;
      throw err;
    });
  }
  return _client;
}

/**
 * Bu sorgu için project_name filtre cümlesini üretir.
 *  - Belirli bir component seçiliyse: o projeyle filtrele.
 *  - "ALL" + DEVLAKE_PROJECTS doluysa: o listeyle filtrele.
 *  - "ALL" + DEVLAKE_PROJECTS boşsa: filtre YOK -> DevLake'teki TÜM projeler.
 * Boş clause döndüğünde sorgu hiç proje filtresi uygulamaz.
 */
function projectFilter(query: MetricQuery): {
  clause: string;
  params: string[];
} {
  if (query.component !== "ALL") {
    return { clause: "AND pm.project_name IN (?)", params: [query.component] };
  }
  const list = (process.env.DEVLAKE_PROJECTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) {
    // DEVLAKE_PROJECTS tanımlı değilse "ALL" = tüm projeler (filtre uygulanmaz)
    return { clause: "", params: [] };
  }
  const placeholders = list.map(() => "?").join(",");
  return { clause: `AND pm.project_name IN (${placeholders})`, params: list };
}

/** Dönem başlangıcı (Date — her iki driver da Date kabul eder) */
function windowStart(period: number): Date {
  return new Date(Date.now() - period * 24 * 60 * 60 * 1000);
}

/** Date | string -> ISO gün */
function dayOf(value: Date | string | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

/** Dönemdeki sıralı gün anahtarları */
function dayKeys(period: number): string[] {
  const keys: string[] = [];
  const today = new Date();
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Sayı dizisinin medyanı (DevLake DORA medyan kullanır) */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Günlük olay sayımından trend serisi (eksik günler 0) */
function countTrend(days: string[], period: number): TrendPoint[] {
  const counts = new Map<string, number>();
  for (const day of days) counts.set(day, (counts.get(day) ?? 0) + 1);
  return dayKeys(period).map((k) => ({ date: k, value: counts.get(k) ?? 0 }));
}

/** Günlük ortalama (değer serisi) trendi */
function avgByDayTrend(
  entries: { day: string; value: number }[],
  period: number,
): TrendPoint[] {
  const agg = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const cur = agg.get(e.day) ?? { total: 0, count: 0 };
    cur.total += e.value;
    cur.count += 1;
    agg.set(e.day, cur);
  }
  return dayKeys(period).map((k) => {
    const a = agg.get(k);
    return { date: k, value: a ? round1(a.total / a.count) : 0 };
  });
}

// ------------------------------------------------------------
// 1) Deployment Frequency
//    Başarılı PRODUCTION deployment'lar / dönem -> haftalık ortalama.
// ------------------------------------------------------------
export async function devlakeDeploymentFrequency(
  query: MetricQuery,
): Promise<MetricResult> {
  const config = DEFAULT_THRESHOLDS["deployment-frequency"];
  const db = await getDb();
  const pf = projectFilter(query);

  const rows = await db.query<{ finished_date: Date | string }>(
    `SELECT cdc.cicd_deployment_id AS deployment_id,
            MAX(cdc.finished_date) AS finished_date
     FROM cicd_deployment_commits cdc
     JOIN project_mapping pm
       ON cdc.cicd_scope_id = pm.row_id AND pm.${db.q("table")} = 'cicd_scopes'
     WHERE cdc.result = 'SUCCESS'
       AND cdc.environment = 'PRODUCTION'
       ${pf.clause}
       AND cdc.finished_date >= ?
     GROUP BY cdc.cicd_deployment_id`,
    [...pf.params, windowStart(query.period)],
  );

  const trend = countTrend(
    rows.map((r) => dayOf(r.finished_date)),
    query.period,
  );
  const total = trend.reduce((a, p) => a + p.value, 0);
  const value = round1((total / query.period) * 7); // haftalık ortalama

  return {
    metric: "deployment-frequency",
    component: query.component,
    period: query.period,
    value,
    unit: config.unit,
    label: config.label,
    threshold: activeThreshold(config),
    severity: computeSeverity("deployment-frequency", value, config),
    trend,
  };
}

// ------------------------------------------------------------
// 2) Lead Time for Changes
//    Üretime giden PR'ların pr_cycle_time medyanı (dakika -> saat).
// ------------------------------------------------------------
export async function devlakeLeadTime(
  query: MetricQuery,
): Promise<MetricResult> {
  const config = DEFAULT_THRESHOLDS["lead-time"];
  const db = await getDb();
  const pf = projectFilter(query);

  const rows = await db.query<{
    cycle_minutes: number | string;
    finished_date: Date | string;
  }>(
    `SELECT ppm.pr_cycle_time AS cycle_minutes,
            cdc.finished_date AS finished_date
     FROM pull_requests pr
     JOIN project_pr_metrics ppm ON ppm.id = pr.id
     JOIN project_mapping pm
       ON pr.base_repo_id = pm.row_id AND pm.${db.q("table")} = 'repos'
     JOIN cicd_deployment_commits cdc ON ppm.deployment_commit_id = cdc.id
     WHERE pr.merged_date IS NOT NULL
       AND ppm.pr_cycle_time IS NOT NULL
       ${pf.clause}
       AND cdc.finished_date >= ?`,
    [...pf.params, windowStart(query.period)],
  );

  const hours = rows.map((r) => Number(r.cycle_minutes) / 60);
  const value = round1(median(hours));
  const trend = avgByDayTrend(
    rows.map((r) => ({
      day: dayOf(r.finished_date),
      value: Number(r.cycle_minutes) / 60,
    })),
    query.period,
  );

  return {
    metric: "lead-time",
    component: query.component,
    period: query.period,
    value,
    unit: config.unit,
    label: config.label,
    threshold: activeThreshold(config),
    severity: computeSeverity("lead-time", value, config),
    trend,
  };
}

// ------------------------------------------------------------
// 3) Time to Restore (MTTR)
//    INCIDENT issue'ların lead_time_minutes medyanı (dakika -> saat).
// ------------------------------------------------------------
export async function devlakeMttr(
  query: MetricQuery,
): Promise<MetricResult> {
  const config = DEFAULT_THRESHOLDS.mttr;
  const db = await getDb();
  const pf = projectFilter(query);

  const rows = await db.query<{
    lead_minutes: number | string;
    resolution_date: Date | string;
  }>(
    `SELECT i.lead_time_minutes AS lead_minutes,
            i.resolution_date AS resolution_date
     FROM issues i
     JOIN board_issues bi ON i.id = bi.issue_id
     JOIN boards b ON bi.board_id = b.id
     JOIN project_mapping pm
       ON b.id = pm.row_id AND pm.${db.q("table")} = 'boards'
     WHERE i.type = 'INCIDENT'
       AND i.lead_time_minutes IS NOT NULL
       ${pf.clause}
       AND i.resolution_date >= ?`,
    [...pf.params, windowStart(query.period)],
  );

  const hours = rows.map((r) => Number(r.lead_minutes) / 60);
  const value = round1(median(hours));
  const trend = avgByDayTrend(
    rows.map((r) => ({
      day: dayOf(r.resolution_date),
      value: Number(r.lead_minutes) / 60,
    })),
    query.period,
  );

  return {
    metric: "mttr",
    component: query.component,
    period: query.period,
    value,
    unit: config.unit,
    label: config.label,
    threshold: activeThreshold(config),
    severity: computeSeverity("mttr", value, config),
    trend,
  };
}

// ------------------------------------------------------------
// 4) Change Failure Rate
//    Incident'a yol açan deployment sayısı / toplam deployment (%).
//    DevLake bağlantısı: project_issue_metrics (pim) deployment <-> incident.
// ------------------------------------------------------------
export async function devlakeChangeFailureRate(
  query: MetricQuery,
): Promise<MetricResult> {
  const config = DEFAULT_THRESHOLDS["change-failure-rate"];
  const db = await getDb();
  const pf = projectFilter(query);

  const rows = await db.query<{
    finished_date: Date | string;
    has_incident: number | string;
  }>(
    `SELECT d.finished_date AS finished_date,
            MAX(CASE WHEN i.id IS NOT NULL THEN 1 ELSE 0 END) AS has_incident
     FROM (
       SELECT cdc.cicd_deployment_id AS deployment_id,
              MAX(cdc.finished_date) AS finished_date
       FROM cicd_deployment_commits cdc
       JOIN project_mapping pm
         ON cdc.cicd_scope_id = pm.row_id AND pm.${db.q("table")} = 'cicd_scopes'
       WHERE cdc.result = 'SUCCESS'
         AND cdc.environment = 'PRODUCTION'
         ${pf.clause}
         AND cdc.finished_date >= ?
       GROUP BY cdc.cicd_deployment_id
     ) d
     LEFT JOIN project_issue_metrics pim ON d.deployment_id = pim.deployment_id
     LEFT JOIN issues i ON pim.id = i.id AND i.type = 'INCIDENT'
     GROUP BY d.deployment_id, d.finished_date`,
    [...pf.params, windowStart(query.period)],
  );

  const total = rows.length;
  const failed = rows.reduce((a, r) => a + Number(r.has_incident), 0);
  const value = total === 0 ? 0 : round1((failed / total) * 100);

  // Günlük CFR yüzdesi
  const perDay = new Map<string, { total: number; failed: number }>();
  for (const r of rows) {
    const day = dayOf(r.finished_date);
    const cur = perDay.get(day) ?? { total: 0, failed: 0 };
    cur.total += 1;
    cur.failed += Number(r.has_incident);
    perDay.set(day, cur);
  }
  const trend: TrendPoint[] = dayKeys(query.period).map((k) => {
    const a = perDay.get(k);
    return {
      date: k,
      value: a && a.total > 0 ? Math.round((a.failed / a.total) * 100) : 0,
    };
  });

  return {
    metric: "change-failure-rate",
    component: query.component,
    period: query.period,
    value,
    unit: config.unit,
    label: config.label,
    threshold: activeThreshold(config),
    severity: computeSeverity("change-failure-rate", value, config),
    trend,
  };
}
