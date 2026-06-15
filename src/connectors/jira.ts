import type { MetricQuery, MetricResult, TrendPoint } from "./types";
import {
  DEFAULT_THRESHOLDS,
  activeThreshold,
  computeSeverity,
} from "@/lib/thresholds";

// ============================================================
// Jira connector — REST API v3 (search) üzerinden issue çeker.
//
// Beslenen metrikler:
//  - MTTR: Incident tipindeki issue'ların açılış -> çözülme süresi
//  - Lead Time (geliştirme kısmı): issue oluşturma -> resolve süresi
//    (Jenkins deployment verisiyle birleştirilerek tam lead time elde edilir)
//
// API: GET {JIRA_BASE_URL}/rest/api/3/search?jql=...&fields=created,resolutiondate,issuetype,project
// ============================================================

interface JiraIssue {
  key: string;
  fields: {
    created: string;
    resolutiondate: string | null;
    issuetype: { name: string };
    project: { key: string };
  };
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
}

/** Basic Auth header (email + API token) */
function authHeader(): Record<string, string> {
  const email = process.env.JIRA_EMAIL ?? "";
  const token = process.env.JIRA_TOKEN ?? "";
  const encoded = Buffer.from(`${email}:${token}`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}

/** İzlenecek proje key'leri */
function projectKeys(query: MetricQuery): string[] {
  if (query.component !== "ALL") return [query.component];
  const raw = process.env.JIRA_PROJECT_KEYS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** JQL ile issue arar (sayfalama basitleştirilmiş — ilk 100) */
async function searchIssues(jql: string): Promise<JiraIssue[]> {
  const base = process.env.JIRA_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("JIRA_BASE_URL tanımlı değil");

  const url = `${base}/rest/api/3/search?jql=${encodeURIComponent(
    jql,
  )}&maxResults=100&fields=created,resolutiondate,issuetype,project`;

  const res = await fetch(url, {
    headers: { ...authHeader(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`[jira] search başarısız: ${res.status}`);
  }
  const data = (await res.json()) as JiraSearchResponse;
  return data.issues ?? [];
}

/** İki ISO tarih arası saat farkı */
function hoursBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms / (1000 * 60 * 60);
}

/** Saatlik değerleri çözülme gününe göre günlük ortalama trende çevirir */
function buildTrendByDay(
  entries: { day: string; hours: number }[],
  period: number,
): TrendPoint[] {
  const sums = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const cur = sums.get(e.day) ?? { total: 0, count: 0 };
    cur.total += e.hours;
    cur.count += 1;
    sums.set(e.day, cur);
  }
  const points: TrendPoint[] = [];
  const today = new Date();
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const agg = sums.get(key);
    points.push({
      date: key,
      value: agg ? Math.round((agg.total / agg.count) * 10) / 10 : 0,
    });
  }
  return points;
}

export async function jiraMttr(query: MetricQuery): Promise<MetricResult> {
  const config = DEFAULT_THRESHOLDS.mttr;
  const incidentType = process.env.JIRA_INCIDENT_ISSUE_TYPE ?? "Incident";
  const projects = projectKeys(query);
  const projectClause =
    projects.length > 0 ? `project in (${projects.join(",")}) AND ` : "";

  const jql = `${projectClause}issuetype = "${incidentType}" AND resolutiondate >= -${query.period}d ORDER BY resolutiondate DESC`;
  const issues = await searchIssues(jql);

  const entries = issues
    .filter((i) => i.fields.resolutiondate)
    .map((i) => ({
      day: i.fields.resolutiondate!.slice(0, 10),
      hours: hoursBetween(i.fields.created, i.fields.resolutiondate!),
    }));

  const trend = buildTrendByDay(entries, query.period);
  const value =
    entries.length === 0
      ? 0
      : Math.round(
          (entries.reduce((a, b) => a + b.hours, 0) / entries.length) * 10,
        ) / 10;

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

/**
 * Lead Time (Jira kısmı): issue oluşturma -> resolve süresi.
 * Not: Tam DORA Lead Time için bu değer Jenkins deployment zamanı ile
 * birleştirilmelidir; burada Jira tarafı (geliştirme süresi) hesaplanır.
 */
export async function jiraLeadTime(
  query: MetricQuery,
): Promise<MetricResult> {
  const config = DEFAULT_THRESHOLDS["lead-time"];
  const projects = projectKeys(query);
  const projectClause =
    projects.length > 0 ? `project in (${projects.join(",")}) AND ` : "";

  const jql = `${projectClause}resolutiondate >= -${query.period}d ORDER BY resolutiondate DESC`;
  const issues = await searchIssues(jql);

  const entries = issues
    .filter((i) => i.fields.resolutiondate)
    .map((i) => ({
      day: i.fields.resolutiondate!.slice(0, 10),
      hours: hoursBetween(i.fields.created, i.fields.resolutiondate!),
    }));

  const trend = buildTrendByDay(entries, query.period);
  const value =
    entries.length === 0
      ? 0
      : Math.round(
          (entries.reduce((a, b) => a + b.hours, 0) / entries.length) * 10,
        ) / 10;

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
