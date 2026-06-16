import type { MetricsConnector, MetricQuery, MetricResult } from "./types";
import { mockConnector } from "./mock";
import { jiraMttr, jiraLeadTime } from "./jira";
import {
  jenkinsDeploymentFrequency,
  jenkinsChangeFailureRate,
} from "./jenkins";
import {
  devlakeDeploymentFrequency,
  devlakeLeadTime,
  devlakeMttr,
  devlakeChangeFailureRate,
} from "./devlake";
import { getDataSource } from "@/lib/datasource";

// ============================================================
// Connector dispatcher — aktif veri kaynağına göre connector seçer.
//
//   mock    -> mockConnector    (deterministik JSON)
//   live    -> liveConnector    (Jira + Jenkins REST doğrudan)
//   devlake -> devlakeConnector (HİBRİT: DevLake DB'sinden okur)
//
// API route'lar yalnızca getConnector()'ı çağırır, kaynaktan habersizdir.
// ============================================================

/** Doğrudan Jira/Jenkins REST API connector'ı */
const liveConnector: MetricsConnector = {
  deploymentFrequency: (q: MetricQuery) => jenkinsDeploymentFrequency(q),
  changeFailureRate: (q: MetricQuery) => jenkinsChangeFailureRate(q),
  mttr: (q: MetricQuery) => jiraMttr(q),
  leadTime: (q: MetricQuery) => jiraLeadTime(q),
};

/** Hibrit: Apache DevLake domain-layer DB'sinden okuyan connector */
const devlakeConnector: MetricsConnector = {
  deploymentFrequency: (q: MetricQuery) => devlakeDeploymentFrequency(q),
  changeFailureRate: (q: MetricQuery) => devlakeChangeFailureRate(q),
  mttr: (q: MetricQuery) => devlakeMttr(q),
  leadTime: (q: MetricQuery) => devlakeLeadTime(q),
};

export function getConnector(): MetricsConnector {
  switch (getDataSource()) {
    case "devlake":
      return devlakeConnector;
    case "live":
      return liveConnector;
    default:
      return mockConnector;
  }
}

export type { MetricsConnector, MetricQuery, MetricResult };
