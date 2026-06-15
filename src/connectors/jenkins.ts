import type { MetricQuery, MetricResult, TrendPoint } from "./types";
import {
  DEFAULT_THRESHOLDS,
  activeThreshold,
  computeSeverity,
} from "@/lib/thresholds";

// ============================================================
// Jenkins connector — REST API üzerinden build geçmişini çeker.
//
// Beslenen metrikler:
//  - Deployment Frequency: her SUCCESS build = 1 deployment
//  - Change Failure Rate : FAILURE+UNSTABLE / toplam build
//  - Lead Time (deployment kısmı): build timestamp + duration
//
// API: GET {JENKINS_URL}/job/{jobName}/api/json?tree=builds[number,result,timestamp,duration]
// ============================================================

interface JenkinsBuild {
  number: number;
  result: "SUCCESS" | "FAILURE" | "UNSTABLE" | "ABORTED" | null;
  timestamp: number; // epoch ms
  duration: number; // ms
}

interface DeployJobMapping {
  job: string;
  component: string;
}

/** Env'den deployment job -> component eşlemesini okur */
function getDeployJobs(): DeployJobMapping[] {
  const raw = process.env.JENKINS_DEPLOY_JOBS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DeployJobMapping[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn("[jenkins] JENKINS_DEPLOY_JOBS JSON parse edilemedi");
    return [];
  }
}

/** Basic Auth header (Jenkins user + API token) */
function authHeader(): Record<string, string> {
  const user = process.env.JENKINS_USER ?? "";
  const token = process.env.JENKINS_TOKEN ?? "";
  const encoded = Buffer.from(`${user}:${token}`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}

/** Bir job'ın build geçmişini çeker */
async function fetchBuilds(jobName: string): Promise<JenkinsBuild[]> {
  const base = process.env.JENKINS_URL?.replace(/\/$/, "");
  if (!base) throw new Error("JENKINS_URL tanımlı değil");

  const url = `${base}/job/${encodeURIComponent(
    jobName,
  )}/api/json?tree=builds[number,result,timestamp,duration]`;

  const res = await fetch(url, {
    headers: { ...authHeader(), Accept: "application/json" },
    // Jenkins verisi sık değişir; route seviyesinde cache yönetilir
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`[jenkins] ${jobName} build geçmişi alınamadı: ${res.status}`);
  }
  const data = (await res.json()) as { builds?: JenkinsBuild[] };
  return data.builds ?? [];
}

/** Verilen query'ye uyan job'ları döner ("ALL" -> hepsi) */
function jobsForQuery(query: MetricQuery): DeployJobMapping[] {
  const jobs = getDeployJobs();
  if (query.component === "ALL") return jobs;
  return jobs.filter((j) => j.component === query.component);
}

/** Epoch ms -> ISO gün */
function isoDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Dönem başlangıcı (epoch ms) */
function periodStart(period: number): number {
  return Date.now() - period * 24 * 60 * 60 * 1000;
}

/** Günlük sayımları sıralı trend serisine çevirir (eksik günler 0) */
function countsToTrend(
  counts: Map<string, number>,
  period: number,
): TrendPoint[] {
  const points: TrendPoint[] = [];
  const today = new Date();
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({ date: key, value: counts.get(key) ?? 0 });
  }
  return points;
}

export async function jenkinsDeploymentFrequency(
  query: MetricQuery,
): Promise<MetricResult> {
  const config = DEFAULT_THRESHOLDS["deployment-frequency"];
  const jobs = jobsForQuery(query);
  const start = periodStart(query.period);
  const daily = new Map<string, number>();

  for (const { job } of jobs) {
    const builds = await fetchBuilds(job);
    for (const b of builds) {
      if (b.timestamp < start) continue;
      if (b.result !== "SUCCESS") continue; // sadece başarılı build = deployment
      const day = isoDay(b.timestamp);
      daily.set(day, (daily.get(day) ?? 0) + 1);
    }
  }

  const trend = countsToTrend(daily, query.period);
  const totalDeploys = trend.reduce((a, p) => a + p.value, 0);
  // Haftalık ortalama deploy
  const value = Math.round((totalDeploys / query.period) * 7 * 10) / 10;

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

export async function jenkinsChangeFailureRate(
  query: MetricQuery,
): Promise<MetricResult> {
  const config = DEFAULT_THRESHOLDS["change-failure-rate"];
  const jobs = jobsForQuery(query);
  const start = periodStart(query.period);

  // Gün bazında toplam ve hatalı build sayısı
  const total = new Map<string, number>();
  const failed = new Map<string, number>();

  for (const { job } of jobs) {
    const builds = await fetchBuilds(job);
    for (const b of builds) {
      if (b.timestamp < start || b.result === null || b.result === "ABORTED") {
        continue;
      }
      const day = isoDay(b.timestamp);
      total.set(day, (total.get(day) ?? 0) + 1);
      if (b.result === "FAILURE" || b.result === "UNSTABLE") {
        failed.set(day, (failed.get(day) ?? 0) + 1);
      }
    }
  }

  // Günlük CFR yüzdesi
  const trend: TrendPoint[] = [];
  const today = new Date();
  for (let i = query.period - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const t = total.get(key) ?? 0;
    const f = failed.get(key) ?? 0;
    trend.push({ date: key, value: t === 0 ? 0 : Math.round((f / t) * 100) });
  }

  const totalAll = Array.from(total.values()).reduce((a, b) => a + b, 0);
  const failedAll = Array.from(failed.values()).reduce((a, b) => a + b, 0);
  const value =
    totalAll === 0 ? 0 : Math.round((failedAll / totalAll) * 1000) / 10;

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
