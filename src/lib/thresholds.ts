import type { MetricKey, Severity } from "@/connectors/types";

// ============================================================
// Threshold (eşik) tanımları ve severity hesaplama.
//
// Her metrik için LOW / MEDIUM / HIGH eşikleri tanımlanır.
// Prompt notu: "MEDIUM eşik değeri = 15" gibi seviyeler.
//
// Önemli ayrım: bazı metriklerde DÜŞÜK değer kötüdür
// (ör. deployment frequency az ise sorun), bazılarında YÜKSEK değer
// kötüdür (ör. lead time, mttr, change failure rate yüksek ise sorun).
// `direction` bunu yönetir.
// ============================================================

export interface ThresholdConfig {
  /** "lower-is-better": değer eşiği AŞARSA kötü (lead time, mttr, CFR)
   *  "higher-is-better": değer eşiğin ALTINA düşerse kötü (deploy freq) */
  direction: "lower-is-better" | "higher-is-better";
  /** MEDIUM seviyesine geçiş eşiği */
  medium: number;
  /** HIGH seviyesine geçiş eşiği */
  high: number;
  unit: string;
  label: string;
}

/**
 * Varsayılan eşik konfigürasyonu. UI'da kullanıcı tarafından
 * override edilebilir (ThresholdContext üzerinden).
 */
export const DEFAULT_THRESHOLDS: Record<MetricKey, ThresholdConfig> = {
  "deployment-frequency": {
    direction: "higher-is-better",
    // Haftalık deploy sayısı 7'nin altına düşerse MEDIUM, 3'ün altına düşerse HIGH
    medium: 7,
    high: 3,
    unit: "deploy/hafta",
    label: "Deployment Frequency",
  },
  "lead-time": {
    direction: "lower-is-better",
    // Saat cinsinden. 24 saati aşarsa MEDIUM, 72 saati aşarsa HIGH
    medium: 24,
    high: 72,
    unit: "saat",
    label: "Lead Time for Changes",
  },
  mttr: {
    direction: "lower-is-better",
    // Saat cinsinden. 4 saati aşarsa MEDIUM, 15 saati aşarsa HIGH (MEDIUM=15 örneği yerine senaryoya uygun)
    medium: 4,
    high: 15,
    unit: "saat",
    label: "Time to Restore (MTTR)",
  },
  "change-failure-rate": {
    direction: "lower-is-better",
    // Yüzde. %15'i aşarsa MEDIUM, %30'u aşarsa HIGH
    medium: 15,
    high: 30,
    unit: "%",
    label: "Change Failure Rate",
  },
};

/**
 * Bir metrik değerinin severity'sini hesaplar.
 * @returns LOW (iyi) / MEDIUM (uyarı) / HIGH (kritik)
 */
export function computeSeverity(
  metric: MetricKey,
  value: number,
  config: ThresholdConfig = DEFAULT_THRESHOLDS[metric],
): Severity {
  if (config.direction === "lower-is-better") {
    if (value >= config.high) return "HIGH";
    if (value >= config.medium) return "MEDIUM";
    return "LOW";
  }
  // higher-is-better: eşiğin altına düşmek kötü
  if (value <= config.high) return "HIGH";
  if (value <= config.medium) return "MEDIUM";
  return "LOW";
}

/**
 * Severity'e karşılık gelen, UI'da gösterilecek eşik değeri.
 * Kart üzerinde "eşik: X" göstermek için MEDIUM eşiğini döner.
 */
export function activeThreshold(config: ThresholdConfig): number {
  return config.medium;
}

/** Severity -> Tailwind renk sınıfları (air-gapped, statik) */
export const SEVERITY_STYLES: Record<
  Severity,
  { text: string; bg: string; border: string; dot: string; labelTr: string }
> = {
  LOW: {
    text: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    dot: "bg-green-500",
    labelTr: "İyi",
  },
  MEDIUM: {
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    labelTr: "Uyarı",
  },
  HIGH: {
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
    labelTr: "Kritik",
  },
};
