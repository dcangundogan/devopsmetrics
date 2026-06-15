import * as React from "react";
import { cn } from "@/lib/utils";

// Native <select> tabanlı basit seçim bileşeni (air-gapped, bağımlılıksız).
interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, children, ...props }: SelectProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label && (
        <span className="font-medium text-slate-600">{label}</span>
      )}
      <select
        className={cn(
          "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-slate-400",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
