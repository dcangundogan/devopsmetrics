# DevOps Metrikleri Dashboard

Ekiplerin DevOps sağlığını izleyen, kurum içi (internal) bir web dashboard'u.
Ana odak **DORA metrikleri**; ek olarak kalite ve süreç metrikleri. Veri
kaynakları **Jira (REST API)** ve **Jenkins (REST API)**; bazı metrikler bir
metrics DB üzerinden **SQL query** ile çekilebilir. Air-gapped ortamlar için
harici CDN bağımlılığı yoktur (font/JS/CSS build sırasında bundle edilir).

## Hızlı Başlangıç

```bash
npm install
cp .env.example .env.local   # değerleri doldur (mock için gerek yok)
npm run dev
```

Tarayıcıda <http://localhost:3000> açılır. **Varsayılan olarak `USE_MOCK=true`**
ile çalışır; canlı kimlik bilgisi olmadan dashboard dolu görünür.

## Tech Stack

- **Next.js 14 (App Router) + TypeScript** — full-stack, connector'lar API routes
- **Tailwind CSS** + shadcn/ui konvansiyonunda hafif bileşenler
- **Recharts** — trend grafikleri
- `src/connectors/` — veri kaynağı soyutlaması (`jira.ts`, `jenkins.ts`, `sql.ts`)

## Mimari

```
src/
  app/
    page.tsx                     # ana sayfa (server component)
    api/metrics/*/route.ts       # DORA + ek metrik API route'ları
  components/                    # MetricCard, TrendChart, Filters, ThresholdEditor...
  connectors/
    types.ts                     # ortak MetricResult shape ve MetricsConnector arayüzü
    index.ts                     # USE_MOCK'a göre mock/live dispatcher
    mock.ts                      # deterministik mock connector
    jira.ts                      # Jira REST (MTTR, Lead Time)
    jenkins.ts                   # Jenkins REST (Deploy Freq, Change Failure Rate)
    sql.ts                       # metrics DB SQL connector (opsiyonel `pg`)
  lib/
    thresholds.ts                # eşik tanımları + severity (LOW/MEDIUM/HIGH)
    query.ts                     # API query param normalizasyonu
    mock/data.ts                 # mock veri üreteci
```

Tüm connector'lar ortak normalize shape döner:

```ts
{ metric, component, period, value, unit, label, threshold, severity, trend }
```

## DORA Metrikleri ve Kaynakları

| Metrik | Kaynak | Hesap |
| --- | --- | --- |
| **Deployment Frequency** | Jenkins | Başarılı (SUCCESS) build sayısı / hafta |
| **Lead Time for Changes** | Jira (+Jenkins) | Issue oluşturma → çözülme/deploy süresi |
| **Time to Restore (MTTR)** | Jira (Incident) | Arıza açılış → çözülme süresi |
| **Change Failure Rate** | Jenkins | (FAILURE+UNSTABLE) / toplam build |

## Özellikler

- 4 DORA metriği için özet kart + trend grafiği
- Component / proje (Jira project key) bazlı filtreleme
- Zaman aralığı filtresi: son 7 / 30 / 90 gün
- Threshold tanımlama: her metrik için MEDIUM/HIGH eşiği → yeşil/sarı/kırmızı
  severity uyarısı (LOW / MEDIUM / HIGH)
- Ek metrik paneli: Code Coverage, Mutation Test, Test Otomasyon, Application
  Anomaly, Code Review

## Mock → Gerçek API Geçişi

`.env.local` içinde tek değişiklik yeterlidir:

```bash
USE_MOCK=false
```

Ardından `JIRA_*`, `JENKINS_*` ve (kullanılıyorsa) `METRICS_DB_URL`
değişkenleri doldurulur. SQL connector için `pg` paketi gerekir:

```bash
npm install pg
```

## Komutlar

```bash
npm run dev        # geliştirme sunucusu
npm run build      # production build
npm run start      # production sunucu
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```