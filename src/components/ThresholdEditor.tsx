"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { MetricKey } from "@/connectors/types";
import type { ThresholdConfig } from "@/lib/thresholds";

// Threshold (eşik) tanımlama paneli.
// Kullanıcı her metrik için MEDIUM / HIGH eşiklerini değiştirebilir;
// değişiklik severity hesabını anında etkiler (parent state'e yazılır).

export type ThresholdOverrides = Record<MetricKey, ThresholdConfig>;

export function ThresholdEditor({
  thresholds,
  onChange,
}: {
  thresholds: ThresholdOverrides;
  onChange: (key: MetricKey, next: ThresholdConfig) => void;
}) {
  const [open, setOpen] = useState(false);

  const metricKeys = Object.keys(thresholds) as MetricKey[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-slate-700">Eşik (Threshold) Ayarları</CardTitle>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {open ? "Gizle" : "Düzenle"}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {metricKeys.map((key) => {
            const cfg = thresholds[key];
            return (
              <div
                key={key}
                className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-2 last:border-0"
              >
                <span className="w-48 text-sm font-medium text-slate-700">
                  {cfg.label}
                </span>
                <span className="text-xs text-slate-400">
                  {cfg.direction === "lower-is-better"
                    ? "düşük = iyi"
                    : "yüksek = iyi"}
                </span>
                <label className="flex items-center gap-1 text-xs text-amber-700">
                  MEDIUM
                  <input
                    type="number"
                    value={cfg.medium}
                    onChange={(e) =>
                      onChange(key, {
                        ...cfg,
                        medium: Number(e.target.value),
                      })
                    }
                    className="w-20 rounded border border-slate-300 px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-red-700">
                  HIGH
                  <input
                    type="number"
                    value={cfg.high}
                    onChange={(e) =>
                      onChange(key, {
                        ...cfg,
                        high: Number(e.target.value),
                      })
                    }
                    className="w-20 rounded border border-slate-300 px-2 py-1"
                  />
                </label>
                <span className="text-xs text-slate-400">{cfg.unit}</span>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
