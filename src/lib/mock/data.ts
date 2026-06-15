import type {
  MetricKey,
  MetricQuery,
  MetricResult,
  TrendPoint,
} from "@/connectors/types";
import {
  DEFAULT_THRESHOLDS,
  activeThreshold,
  computeSeverity,
} from "@/lib/thresholds";

// ============================================================
// Mock veri üreteci.
// USE_MOCK=true iken connector'lar gerçek API yerine bu deterministik
// veriyi döner. Böylece UI, canlı kimlik bilgisi olmadan da dolu görünür.
//
// Deterministik olması için basit bir seed'li PRNG kullanılır;
// her component + metrik kombinasyonu her zaman aynı veriyi üretir.
// ============================================================

/** Mock dashboard'da kullanılabilen component/proje listesi */
export const MOCK_COMPONENTS = ["PAY", "WEB", "CORE"] as const;

/** Seed'li basit PRNG (mulberry32) — deterministik mock için */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** String'den stabil bir sayısal seed üretir */
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** ISO gün stringi (saat sıfırlanmış) */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Bir metrik için günlük trend serisi üretir.
 * base ± varyans aralığında, seed'e göre deterministik.
 */
function buildTrend(
  seedKey: string,
  days: number,
  base: number,
  variance: number,
  opts: { min?: number; round?: number } = {},
): TrendPoint[] {
  const rand = seededRandom(hashSeed(seedKey));
  const points: TrendPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const raw = base + (rand() - 0.5) * 2 * variance;
    const min = opts.min ?? 0;
    const rounded = opts.round ?? 1;
    const value = Math.max(min, Math.round(raw / rounded) * rounded);
    points.push({ date: isoDay(d), value });
  }
  return points;
}

/** Trend serisinin dönem özet değerini hesaplar (metrik tipine göre) */
function summarize(metric: MetricKey, trend: TrendPoint[]): number {
  const values = trend.map((p) => p.value);
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;

  switch (metric) {
    case "deployment-frequency":
      // Haftalık deploy: günlük ortalamadan haftalığa çevir
      return round1(avg * 7);
    case "lead-time":
    case "mttr":
      return round1(avg); // ortalama saat
    case "change-failure-rate":
      return round1(avg); // ortalama yüzde
    default:
      return round1(avg);
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Bir component + metrik + dönem için tam MetricResult üretir.
 * "ALL" component'i tüm componentlerin ortalaması/toplamı olarak davranır.
 */
export function buildMockMetric(
  metric: MetricKey,
  query: MetricQuery,
): MetricResult {
  const config = DEFAULT_THRESHOLDS[metric];
  const days = query.period;
  const seedKey = `${metric}:${query.component}`;

  // Her metrik için makul base/variance değerleri (component'e göre kaydırılır)
  const componentShift = hashSeed(query.component) % 5;
  let trend: TrendPoint[];

  switch (metric) {
    case "deployment-frequency":
      // Günlük deploy sayısı
      trend = buildTrend(seedKey, days, 1.4 + componentShift * 0.2, 1.2, {
        round: 1,
      });
      break;
    case "lead-time":
      // Saat
      trend = buildTrend(seedKey, days, 30 + componentShift * 6, 18, {
        min: 1,
      });
      break;
    case "mttr":
      // Saat
      trend = buildTrend(seedKey, days, 5 + componentShift * 2, 4, { min: 0 });
      break;
    case "change-failure-rate":
      // Yüzde
      trend = buildTrend(seedKey, days, 12 + componentShift * 3, 8, {
        min: 0,
      });
      break;
    default:
      trend = buildTrend(seedKey, days, 10, 5);
  }

  const value = summarize(metric, trend);
  const severity = computeSeverity(metric, value, config);

  return {
    metric,
    component: query.component,
    period: query.period,
    value,
    unit: config.unit,
    label: config.label,
    threshold: activeThreshold(config),
    severity,
    trend,
  };
}

// ------------------------------------------------------------
// Ek metrik panelleri için mock veri (Code Coverage, Test Otomasyon,
// Application Anomaly, Code Review). DORA dışı, ikinci panel.
// ------------------------------------------------------------

export interface ExtraMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  source: string;
  trend: TrendPoint[];
}

export function buildMockExtraMetrics(
  component: string,
  period: number,
): ExtraMetric[] {
  const mk = (
    key: string,
    label: string,
    base: number,
    variance: number,
    unit: string,
    source: string,
  ): ExtraMetric => {
    const trend = buildTrend(`${key}:${component}`, period, base, variance, {
      min: 0,
    });
    const avg =
      trend.reduce((a, b) => a + b.value, 0) / Math.max(1, trend.length);
    return { key, label, value: round1(avg), unit, source, trend };
  };

  return [
    mk("code-coverage", "Code Coverage", 78, 6, "%", "Jenkins / SonarQube"),
    mk("mutation-test", "Mutation Test Skoru", 64, 8, "%", "Jenkins / Pitest"),
    mk("test-automation", "Test Otomasyon Oranı", 71, 7, "%", "CI raporları"),
    mk("app-anomaly", "Application Anomaly", 3, 3, "adet", "Grafana / Prometheus"),
    mk("code-review", "Ort. Code Review Süresi", 6, 4, "saat", "Jira / Git"),
  ];
}
