// ============================================================
// Ortak veri tipleri — tüm connector'lar ve API route'lar bu
// normalize edilmiş shape'i kullanır.
// ============================================================

/** Eşik aşımı severity seviyeleri */
export type Severity = "LOW" | "MEDIUM" | "HIGH";

/** Desteklenen DORA metrik anahtarları */
export type MetricKey =
  | "deployment-frequency"
  | "lead-time"
  | "mttr"
  | "change-failure-rate";

/** Zaman aralığı filtresi (gün) */
export type TimeRange = 7 | 30 | 90;

/**
 * Trend grafiklerinde kullanılan tek bir zaman serisi noktası.
 * date: ISO tarih (gün granülaritesi), value: o güne ait metrik değeri.
 */
export interface TrendPoint {
  date: string;
  value: number;
}

/**
 * Normalize edilmiş metrik cevabı. Prompt'taki ortak shape:
 * { component, period, value, threshold, severity }
 * Üstüne trend serisi ve birim/etiket bilgileri eklenmiştir.
 */
export interface MetricResult {
  metric: MetricKey;
  /** Component / proje key (örn. "PAY"). "ALL" = tüm componentlerin toplamı */
  component: string;
  /** Filtre uygulanan zaman aralığı (gün) */
  period: TimeRange;
  /** Dönem için özet değer (ör. ortalama lead time saat, deploy/gün vb.) */
  value: number;
  /** Değerin birimi (UI gösterimi için) */
  unit: string;
  /** İnsan okunur kısa etiket */
  label: string;
  /** Bu metrik için aktif eşik değeri (yoksa null) */
  threshold: number | null;
  /** Eşiğe göre hesaplanan severity */
  severity: Severity;
  /** Dönem boyunca trend serisi */
  trend: TrendPoint[];
}

/** Bir API route'a gelen sorgu parametreleri */
export interface MetricQuery {
  component: string; // "ALL" veya proje key
  period: TimeRange;
}

/**
 * Connector arayüzü — her veri kaynağı (mock, Jira, Jenkins, SQL)
 * bu fonksiyonları implemente eder. Böylece API route'lar kaynaktan bağımsızdır.
 */
export interface MetricsConnector {
  deploymentFrequency(query: MetricQuery): Promise<MetricResult>;
  leadTime(query: MetricQuery): Promise<MetricResult>;
  mttr(query: MetricQuery): Promise<MetricResult>;
  changeFailureRate(query: MetricQuery): Promise<MetricResult>;
}
