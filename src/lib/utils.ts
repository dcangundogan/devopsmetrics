import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind sınıflarını koşullu birleştirme (shadcn/ui konvansiyonu)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sayıyı kısa, okunur formata çevirir */
export function formatValue(value: number, unit: string): string {
  const v = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  return `${v} ${unit}`.trim();
}
