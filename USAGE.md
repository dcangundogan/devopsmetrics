# Kullanım & Yapılandırma Rehberi

Bu doküman, DevOps Metrikleri Dashboard'unun nasıl çalıştırılacağını ve hangi
parametrelerin nereden değiştirileceğini açıklar. (Genel proje özeti için
[`README.md`](./README.md) dosyasına bakın.)

---

## 1. Kurulum ve Çalıştırma

```bash
# 1) Bağımlılıkları kur
npm install

# 2) Ortam değişkenleri dosyasını oluştur
cp .env.example .env.local

# 3) Geliştirme sunucusunu başlat
npm run dev
```

Tarayıcıdan <http://localhost:3000> adresini açın. **Varsayılan olarak
`USE_MOCK=true`** olduğu için herhangi bir kimlik bilgisi girmeden dashboard
örnek (mock) verilerle dolu gelir.

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (hot reload) |
| `npm run build` | Production build |
| `npm run start` | Production sunucusu (önce `build` gerekir) |
| `npm run lint` | ESLint kontrolü |
| `npm run typecheck` | TypeScript tip kontrolü (`tsc --noEmit`) |

---

## 2. Ortam Değişkenleri (`.env.local`)

Tüm gizli/ortam bilgileri `.env.local` dosyasında tutulur. Bu dosya
`.gitignore` ile repoya **gönderilmez**. Şablon `.env.example`'dadır.

### 2.1. Veri Kaynağı Seçimi

```bash
DATA_SOURCE=mock     # deterministik örnek veri (kimlik bilgisi gerekmez)
DATA_SOURCE=live     # Jira + Jenkins REST API'leri doğrudan
DATA_SOURCE=devlake  # HİBRİT: Apache DevLake DB'sinden okur (önerilen)
```

Eski `USE_MOCK` değişkeni geriye dönük uyumluluk için hâlâ çalışır
(`DATA_SOURCE` boşsa: `USE_MOCK=false` → live, aksi halde mock).

> Tek bu satırı değiştirip sunucuyu yeniden başlatmak, tüm dashboard'un veri
> kaynağını değiştirir (env değişkenleri başlangıçta okunur).
>
> **Hibrit (`devlake`) kurulumu** için ayrı rehbere bakın:
> [`DEVLAKE.md`](./DEVLAKE.md) — DevLake'i veri motoru, bu paneli vitrin olarak
> kullanma.

### 2.2. Jira (MTTR + Lead Time)

```bash
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_EMAIL=devops@your-org.com
JIRA_TOKEN=your-jira-api-token
JIRA_PROJECT_KEYS=PAY,WEB,CORE        # izlenecek proje key'leri (virgülle)
JIRA_INCIDENT_ISSUE_TYPE=Incident      # arıza/incident issue type adı
```

- `JIRA_TOKEN`: Atlassian hesabınızdan **API token** üretin
  (Profil → Security → Create and manage API tokens).
- `JIRA_PROJECT_KEYS`: Dashboard'daki "Component / Proje" filtresinin
  seçenekleri **canlı modda** buradan gelir.
- `JIRA_INCIDENT_ISSUE_TYPE`: MTTR hesaplanırken hangi issue type'ın "arıza"
  sayılacağını belirler. Jira'nızda bu tip farklı adlanıyorsa (örn. "Bug",
  "Outage") burada güncelleyin.

### 2.3. Jenkins (Deployment Frequency + Change Failure Rate)

```bash
JENKINS_URL=https://jenkins.your-org.com
JENKINS_USER=devops
JENKINS_TOKEN=your-jenkins-api-token
JENKINS_DEPLOY_JOBS=[{"job":"pay-deploy-prod","component":"PAY"},{"job":"web-deploy-prod","component":"WEB"}]
```

- `JENKINS_TOKEN`: Jenkins → kullanıcı → Configure → **API Token**.
- `JENKINS_DEPLOY_JOBS`: **En önemli eşleme.** Her deployment job'ını bir
  component'e bağlayan JSON dizisidir. Yeni bir deployment pipeline eklerseniz
  buraya bir satır ekleyin:

  ```json
  [
    { "job": "pay-deploy-prod",  "component": "PAY"  },
    { "job": "web-deploy-prod",  "component": "WEB"  },
    { "job": "core-deploy-prod", "component": "CORE" }
  ]
  ```

  - `job`: Jenkins'teki job adı (URL'deki `/job/<ad>` kısmı).
  - `component`: Bu job'ın ait olduğu component/proje (Jira key ile aynı
    tutmanız filtreleme için önerilir).
  - Aynı component için birden fazla job tanımlanabilir; sayımlar toplanır.

### 2.4. Metrics SQL DB (opsiyonel)

```bash
METRICS_DB_URL=postgres://user:password@db-host:5432/metrics
```

- Code coverage / test otomasyon gibi metrikleri doğrudan bir PostgreSQL
  metrics DB'den çekmek için kullanılır.
- SQL connector `pg` paketini **dinamik** yükler; canlı SQL kullanacaksanız:

  ```bash
  npm install pg
  ```

### 2.5. Grafana / Prometheus (opsiyonel)

```bash
GRAFANA_URL=https://grafana.your-org.com
GRAFANA_TOKEN=your-grafana-token
```

Application Anomaly ve monitoring tabanlı sinyaller için ayrılmıştır.

---

## 3. Eşik (Threshold) Değerlerini Değiştirme

Eşikler severity'yi (LOW / MEDIUM / HIGH → yeşil / sarı / kırmızı) belirler.
İki şekilde değiştirilebilir:

### 3.1. Arayüzden (geçici)

Dashboard'daki **"Eşik (Threshold) Ayarları"** kartında **Düzenle**'ye tıklayın.
Her metrik için MEDIUM ve HIGH eşiklerini girin; severity renkleri **anında**
yeniden hesaplanır. Bu değişiklikler yalnızca o tarayıcı oturumunda geçerlidir
(kalıcı değildir, sayfa yenilenince varsayılana döner).

### 3.2. Koddan (kalıcı varsayılan)

Kalıcı varsayılanlar [`src/lib/thresholds.ts`](./src/lib/thresholds.ts)
dosyasındaki `DEFAULT_THRESHOLDS` içindedir:

```ts
export const DEFAULT_THRESHOLDS: Record<MetricKey, ThresholdConfig> = {
  "deployment-frequency": {
    direction: "higher-is-better", // yüksek = iyi
    medium: 7,   // haftalık deploy bu değerin ALTINA düşerse MEDIUM
    high: 3,     // bu değerin ALTINA düşerse HIGH
    unit: "deploy/hafta",
    label: "Deployment Frequency",
  },
  "lead-time": {
    direction: "lower-is-better",  // düşük = iyi
    medium: 24,  // saat: bu değeri AŞARSA MEDIUM
    high: 72,    // bu değeri AŞARSA HIGH
    unit: "saat",
    label: "Lead Time for Changes",
  },
  // ... mttr, change-failure-rate
};
```

`direction` alanı, eşiğin nasıl yorumlanacağını belirler:

| direction | Anlamı | Örnek metrik |
| --- | --- | --- |
| `higher-is-better` | Değer eşiğin **altına** düşerse kötüleşir | Deployment Frequency |
| `lower-is-better` | Değer eşiği **aşarsa** kötüleşir | Lead Time, MTTR, Change Failure Rate |

Bir eşiği kalıcı değiştirmek için ilgili `medium` / `high` sayısını düzenleyin
ve sunucuyu yeniden başlatın.

---

## 4. Component / Zaman Aralığı Filtreleri

- **Component / Proje filtresi**: "Tümü" (`ALL`) veya tek bir component.
  - Mock modda seçenekler `src/lib/mock/data.ts` içindeki `MOCK_COMPONENTS`
    (`PAY`, `WEB`, `CORE`) listesinden gelir.
  - Canlı modda `JIRA_PROJECT_KEYS`'ten gelir.
- **Zaman aralığı**: Son **7 / 30 / 90** gün. Geçerli değerler
  `src/lib/query.ts` içindeki `VALID_PERIODS` ile sınırlandırılmıştır.

Filtreler URL query parametrelerine dönüşür ve API'ye iletilir:

```
/api/metrics/mttr?component=PAY&period=30
```

---

## 5. Sık Yapılan Değişiklikler — Nereye Bakmalı?

| Yapmak istediğiniz | Düzenlenecek yer |
| --- | --- |
| Mock ↔ canlı veri geçişi | `.env.local` → `USE_MOCK` |
| Jira/Jenkins/DB bağlantısı | `.env.local` (bkz. bölüm 2) |
| Deployment job → component eşlemesi | `.env.local` → `JENKINS_DEPLOY_JOBS` |
| Incident issue type adı | `.env.local` → `JIRA_INCIDENT_ISSUE_TYPE` |
| Eşik varsayılanları (kalıcı) | `src/lib/thresholds.ts` → `DEFAULT_THRESHOLDS` |
| Severity renkleri | `src/lib/thresholds.ts` → `SEVERITY_STYLES` |
| Mock component listesi / üretilen değerler | `src/lib/mock/data.ts` |
| Geçerli zaman aralıkları | `src/lib/query.ts` → `VALID_PERIODS` |
| Yeni veri kaynağı / metrik hesabı | `src/connectors/*.ts` |
| Ek metrik panelindeki metrikler | `src/lib/mock/data.ts` → `buildMockExtraMetrics` |

---

## 6. Yeni Bir Component Ekleme (örnek)

1. **Canlı mod**: `.env.local` içinde `JIRA_PROJECT_KEYS`'e key'i ekleyin
   (örn. `PAY,WEB,CORE,MOBILE`).
2. Jenkins deployment job'ı varsa `JENKINS_DEPLOY_JOBS`'a eşlemesini ekleyin:
   ```json
   { "job": "mobile-deploy-prod", "component": "MOBILE" }
   ```
3. Sunucuyu yeniden başlatın. Yeni component, filtre menüsünde otomatik görünür.

> **Mock modda** test için `src/lib/mock/data.ts` içindeki `MOCK_COMPONENTS`
> dizisine ekleyin.

---

## 7. Canlı Veriye Geçiş Kontrol Listesi

- [ ] `npm install pg` (yalnızca SQL connector kullanılacaksa)
- [ ] `.env.local` içinde `USE_MOCK=false`
- [ ] `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_TOKEN`, `JIRA_PROJECT_KEYS` dolu
- [ ] `JENKINS_URL`, `JENKINS_USER`, `JENKINS_TOKEN`, `JENKINS_DEPLOY_JOBS` dolu
- [ ] (Opsiyonel) `METRICS_DB_URL`, `GRAFANA_URL` / `GRAFANA_TOKEN` dolu
- [ ] Sunucu yeniden başlatıldı (`npm run dev` veya `npm run build && npm run start`)
- [ ] Sağ üstteki rozet **"CANLI veri"** gösteriyor
