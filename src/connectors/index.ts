import type { MetricsConnector, MetricQuery, MetricResult } from "./types";
import { mockConnector } from "./mock";
import { jiraMttr, jiraLeadTime } from "./jira";
import {
  jenkinsDeploymentFrequency,
  jenkinsChangeFailureRate,
} from "./jenkins";

// ============================================================
// Connector dispatcher.
//
// USE_MOCK=true  -> mockConnector (deterministik JSON)
// USE_MOCK=false -> gerçek connector (Jira + Jenkins + SQL)
//
// Gerçek API'ye geçiş tek env değişikliğiyle olur. API route'lar
// yalnızca getConnector()'ı çağırır, kaynaktan habersizdir.
// ============================================================

function isMockEnabled(): boolean {
  // Varsayılan: mock açık (canlı kimlik bilgisi olmadan da çalışsın)
  return (process.env.USE_MOCK ?? "true").toLowerCase() !== "false";
}

/**
 * Gerçek connector — DORA metriklerini doğru veri kaynağına yönlendirir.
 *  - Deployment Frequency  -> Jenkins
 *  - Change Failure Rate   -> Jenkins
 *  - MTTR                  -> Jira (Incident)
 *  - Lead Time             -> Jira (deployment ile zenginleştirilebilir)
 */
const liveConnector: MetricsConnector = {
  deploymentFrequency: (q: MetricQuery) => jenkinsDeploymentFrequency(q),
  changeFailureRate: (q: MetricQuery) => jenkinsChangeFailureRate(q),
  mttr: (q: MetricQuery) => jiraMttr(q),
  leadTime: (q: MetricQuery) => jiraLeadTime(q),
};

export function getConnector(): MetricsConnector {
  return isMockEnabled() ? mockConnector : liveConnector;
}

export type { MetricsConnector, MetricQuery, MetricResult };
