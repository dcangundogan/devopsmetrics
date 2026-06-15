import type { MetricQuery, TimeRange } from "@/connectors/types";

// ============================================================
// API route'larda gelen URL parametrelerini normalize eder.
// ?component=PAY&period=30  -> { component: "PAY", period: 30 }
// ============================================================

const VALID_PERIODS: TimeRange[] = [7, 30, 90];

export function parseMetricQuery(url: string): MetricQuery {
  const { searchParams } = new URL(url);

  const component = (searchParams.get("component") ?? "ALL").trim() || "ALL";

  const rawPeriod = Number(searchParams.get("period") ?? "30");
  const period: TimeRange = VALID_PERIODS.includes(rawPeriod as TimeRange)
    ? (rawPeriod as TimeRange)
    : 30;

  return { component, period };
}
