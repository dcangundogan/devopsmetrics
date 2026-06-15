"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { TrendChart } from "@/components/TrendChart";
import type { ExtraMetric } from "@/lib/mock/data";

// Ek metrikler (ikinci panel): Code Coverage, Mutation Test, Test Otomasyon,
// Application Anomaly, Code Review. DORA dışı kalite/süreç metrikleri.

export function ExtraMetricsPanel({ metrics }: { metrics: ExtraMetric[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-800">
        Ek Metrikler (Kalite & Süreç)
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.key}>
            <CardHeader>
              <CardTitle>{m.label}</CardTitle>
              <div className="mt-1 text-xl font-semibold text-slate-900">
                {m.value} {m.unit}
              </div>
              <p className="text-xs text-slate-400">Kaynak: {m.source}</p>
            </CardHeader>
            <CardContent>
              <TrendChart data={m.trend} color="slate" unit={m.unit} />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
