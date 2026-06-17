"use client";

import { useCallback, useEffect, useState } from "react";
import { Filters } from "@/components/Filters";
import { MetricCard } from "@/components/MetricCard";
import { ExtraMetricsPanel } from "@/components/ExtraMetricsPanel";
import {
  ThresholdEditor,
  type ThresholdOverrides,
} from "@/components/ThresholdEditor";
import type {
  MetricKey,
  MetricResult,
  TimeRange,
} from "@/connectors/types";
import {
  DEFAULT_THRESHOLDS,
  activeThreshold,
  computeSeverity,
} from "@/lib/thresholds";
import type { ExtraMetric } from "@/lib/mock/data";

// Ana dashboard — client tarafı durum yönetimi ve veri çekme.
// Filtre (component/period) değişince API route'lardan veriyi yeniden çeker;
// threshold override'ları severity'yi anlık olarak yeniden hesaplar.

const DORA_METRICS: MetricKey[] = [
  "deployment-frequency",
  "lead-time",
  "mttr",
  "change-failure-rate",
];

const ENDPOINTS: Record<MetricKey, string> = {
  "deployment-frequency": "/api/metrics/deployment-frequency",
  "lead-time": "/api/metrics/lead-time",
  mttr: "/api/metrics/mttr",
  "change-failure-rate": "/api/metrics/change-failure-rate",
};

export function DashboardClient({ components }: { components: string[] }) {
  const [component, setComponent] = useState("ALL");
  const [period, setPeriod] = useState<TimeRange>(30);
  const [results, setResults] = useState<MetricResult[]>([]);
  const [extra, setExtra] = useState<ExtraMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Kullanıcı tarafından düzenlenebilir eşikler (varsayılandan başlar)
  const [thresholds, setThresholds] = useState<ThresholdOverrides>(
    () => ({ ...DEFAULT_THRESHOLDS }),
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = `?component=${encodeURIComponent(component)}&period=${period}`;
    try {
      // Her metriği bağımsız çek: biri hata verse bile diğerleri yine gösterilsin.
      const settled = await Promise.all(
        DORA_METRICS.map(async (m) => {
          try {
            const r = await fetch(ENDPOINTS[m] + qs);
            const body = await r.json();
            if (!r.ok) {
              const msg =
                (body && body.error) || `${m} alınamadı (HTTP ${r.status})`;
              return { ok: false as const, metric: m, error: String(msg) };
            }
            return { ok: true as const, result: body as MetricResult };
          } catch (e) {
            const msg = e instanceof Error ? e.message : "ağ hatası";
            return { ok: false as const, metric: m, error: msg };
          }
        }),
      );

      const ok = settled.filter((s) => s.ok) as {
        ok: true;
        result: MetricResult;
      }[];
      const failed = settled.filter((s) => !s.ok) as {
        ok: false;
        metric: MetricKey;
        error: string;
      }[];

      setResults(ok.map((s) => s.result));
      if (failed.length > 0) {
        // Tekrar eden mesajları sadeleştir, ilk hatayı öne çıkar.
        const unique = Array.from(new Set(failed.map((f) => f.error)));
        setError(
          `${failed.length}/${DORA_METRICS.length} metrik alınamadı — ${unique[0]}`,
        );
      }

      const extraRes = await fetch("/api/metrics/extra" + qs);
      if (extraRes.ok) {
        const data = (await extraRes.json()) as { metrics: ExtraMetric[] };
        setExtra(data.metrics ?? []);
      } else {
        setExtra([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veri çekme hatası");
    } finally {
      setLoading(false);
    }
  }, [component, period]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Eşik override'larını uygulayarak severity'yi yeniden hesapla
  const adjusted = results.map((r) => {
    const cfg = thresholds[r.metric];
    return {
      ...r,
      threshold: activeThreshold(cfg),
      severity: computeSeverity(r.metric, r.value, cfg),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Filters
          components={components}
          component={component}
          period={period}
          onComponentChange={setComponent}
          onPeriodChange={setPeriod}
        />
        {loading && (
          <span className="text-sm text-slate-400">Yükleniyor…</span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">
          DORA Metrikleri
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {adjusted.map((r) => (
            <MetricCard key={r.metric} result={r} />
          ))}
        </div>
      </section>

      <ThresholdEditor
        thresholds={thresholds}
        onChange={(key, next) =>
          setThresholds((prev) => ({ ...prev, [key]: next }))
        }
      />

      {extra.length > 0 && <ExtraMetricsPanel metrics={extra} />}
    </div>
  );
}
