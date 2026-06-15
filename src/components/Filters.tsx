"use client";

import { Select } from "@/components/ui/Select";
import type { TimeRange } from "@/connectors/types";

// Component (Jira project key) ve zaman aralığı filtreleri.

export function Filters({
  components,
  component,
  period,
  onComponentChange,
  onPeriodChange,
}: {
  components: string[];
  component: string;
  period: TimeRange;
  onComponentChange: (c: string) => void;
  onPeriodChange: (p: TimeRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Select
        label="Component / Proje"
        value={component}
        onChange={(e) => onComponentChange(e.target.value)}
      >
        <option value="ALL">Tümü</option>
        {components.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>

      <Select
        label="Zaman Aralığı"
        value={String(period)}
        onChange={(e) => onPeriodChange(Number(e.target.value) as TimeRange)}
      >
        <option value="7">Son 7 gün</option>
        <option value="30">Son 30 gün</option>
        <option value="90">Son 90 gün</option>
      </Select>
    </div>
  );
}
