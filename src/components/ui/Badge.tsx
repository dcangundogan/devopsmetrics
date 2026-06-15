import * as React from "react";
import { cn } from "@/lib/utils";
import type { Severity } from "@/connectors/types";
import { SEVERITY_STYLES } from "@/lib/thresholds";

// Severity rozeti — yeşil / sarı / kırmızı uyarı göstergesi.
export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  const style = SEVERITY_STYLES[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        style.bg,
        style.text,
        style.border,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {severity} · {style.labelTr}
    </span>
  );
}
