import type { MetricsConnector, MetricQuery } from "./types";
import { buildMockMetric } from "@/lib/mock/data";

// ============================================================
// Mock connector — gerçek API'ye gitmeden deterministik veri döner.
// USE_MOCK=true iken kullanılır.
// ============================================================

export const mockConnector: MetricsConnector = {
  async deploymentFrequency(query: MetricQuery) {
    return buildMockMetric("deployment-frequency", query);
  },
  async leadTime(query: MetricQuery) {
    return buildMockMetric("lead-time", query);
  },
  async mttr(query: MetricQuery) {
    return buildMockMetric("mttr", query);
  },
  async changeFailureRate(query: MetricQuery) {
    return buildMockMetric("change-failure-rate", query);
  },
};
