"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { SeverityBadge } from "@/components/ui/Badge";
import { TrendChart } from "@/components/TrendChart";
import type { MetricResult, Severity } from "@/connectors/types";
import { formatValue } from "@/lib/utils";

// Tek bir DORA metriği için özet kart: değer + severity rozeti + trend grafiği.

const SEVERITY_COLOR: Record<Severity, "green" | "amber" | "red"> = {
  LOW: "green",
  MEDIUM: "amber",
  HIGH: "red",
};

export function MetricCard({ result }: { result: MetricResult }) {
  const color = SEVERITY_COLOR[result.severity];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>{result.label}</CardTitle>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {formatValue(result.value, result.unit)}
          </div>
        </div>
        <SeverityBadge severity={result.severity} />
      </CardHeader>
      <CardContent>
        <TrendChart data={result.trend} color={color} unit={result.unit} />
        {result.threshold !== null && (
          <p className="mt-2 text-xs text-slate-400">
            Eşik (MEDIUM): {result.threshold} {result.unit}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
