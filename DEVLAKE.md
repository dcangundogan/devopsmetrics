# Hibrit Mimari — Apache DevLake + Bu Panel

Bu dokümanda **hibrit** kurulum anlatılır: **Apache DevLake = veri motoru**,
**bu panel = vitrin**.

```
Jira / Jenkins / GitHub
        │  (DevLake toplar + DORA hesaplar)
        ▼
   DevLake DB  ◀────────  bu panel (SQL ile okur, Türkçe/sade UI)
   (MySQL/PG)             DATA_SOURCE=devlake
```

DevLake olgun connector'ları ve tarihsel veriyi sağlar; biz onun "domain
layer" tablolarını okuyup kendi normalize shape'imize çevirir, hafif ve kuruma
özel bir arayüzde gösteririz. Grafana karmaşası olmadan.

## 1. DevLake'i kurun

DevLake'i resmî talimatlarla ayağa kaldırın (Docker Compose):
<https://devlake.apache.org/docs/GettingStarted>

- DevLake config-ui'dan Jira ve Jenkins connection'larını ekleyin.
- Bir **Project** oluşturup veri kaynaklarını bu projeye bağlayın
  (DORA için zorunlu — `project_mapping` tablosunu besler).
- **DORA transformation** kurallarını tanımlayın:
  - Hangi Jenkins job/pipeline'ı **deployment** sayılır (PRODUCTION ortamı).
  - Hangi Jira issue type **INCIDENT** sayılır.
- İlk **collection (blueprint)** çalıştırmasını tamamlayın.

> DevLake varsayılan olarak **MySQL** kullanır (`lake` veritabanı).
> İsterseniz PostgreSQL ile de kurulabilir; bu panel ikisini de destekler.

## 2. Bu paneli DevLake DB'sine bağlayın

`.env.local`:

```bash
DATA_SOURCE=devlake

# MySQL (DevLake varsayılanı)
DEVLAKE_DB_URL=mysql://merico:merico@localhost:3306/lake
# veya PostgreSQL:
# DEVLAKE_DB_URL=postgres://user:pass@localhost:5432/lake

# 'ALL' filtresi için DevLake project_name listesi
DEVLAKE_PROJECTS=PAY,WEB,CORE
```

Gerekli DB sürücüsü `optionalDependencies` ile gelir; gelmemişse:

```bash
npm install mysql2   # MySQL için
npm install pg       # PostgreSQL için
```

Sunucuyu başlatın — sağ üst rozet **"DEVLAKE (hibrit)"** gösterir.

```bash
npm run dev
```

## 3. Metrik → DevLake tablo eşlemesi

Sorgular DevLake'in resmî Grafana DORA dashboard'undan uyarlanmıştır
([kaynak](https://devlake.apache.org/docs/DORA)). Tarih/medyan hesapları
dialect bağımsızlığı için TypeScript tarafında yapılır.

| Metrik | DevLake tabloları | Mantık |
| --- | --- | --- |
| **Deployment Frequency** | `cicd_deployment_commits` + `project_mapping` | `result='SUCCESS'` & `environment='PRODUCTION'` deployment'lar / dönem → haftalık |
| **Lead Time for Changes** | `pull_requests` + `project_pr_metrics` + `cicd_deployment_commits` | `pr_cycle_time` (dk → saat) medyanı |
| **Time to Restore (MTTR)** | `issues` + `board_issues` + `boards` + `project_mapping` | `type='INCIDENT'` `lead_time_minutes` (dk → saat) medyanı |
| **Change Failure Rate** | deployments + `project_issue_metrics` + `issues` | incident'a yol açan deployment / toplam deployment (%) |

İlgili kod: [`src/connectors/devlake.ts`](./src/connectors/devlake.ts) ve
dual-dialect DB katmanı [`src/connectors/db.ts`](./src/connectors/db.ts).

## 4. Üç mod karşılaştırması

| `DATA_SOURCE` | Kaynak | Ne zaman |
| --- | --- | --- |
| `mock` | Deterministik örnek veri | Demo / geliştirme (kimlik bilgisi gerekmez) |
| `live` | Jira + Jenkins REST doğrudan | DevLake yokken hızlı/basit canlı veri |
| `devlake` | DevLake DB (hibrit) | **Önerilen** — olgun toplama + tarihsel veri |

## 5. Sorun giderme — "grafik gelmiyor"

Sadece `DEVLAKE_DB_URL` girip grafik göremiyorsanız, sırayla kontrol edin:

1. **Teşhis endpoint'ini açın:** <http://localhost:3000/api/diag>
   - `connected: false` + hata → DB bağlantısı/kimlik bilgisi yanlış.
   - `rowCounts` hepsi 0 → DevLake henüz veri toplamamış (blueprint'i çalıştırın).
   - `productionSuccessDeploymentsLast30d: 0` → deployment'lar PRODUCTION/SUCCESS
     olarak işaretlenmemiş (DevLake DORA transformation kurallarını kontrol edin).
   - `projectNamesInDevLake` → DevLake'teki gerçek proje adları. `DEVLAKE_PROJECTS`
     bu adlarla **birebir** eşleşmeli.
   - Bir tabloda `error` → DevLake sürümünüzde şema farklı olabilir.

2. **`DEVLAKE_PROJECTS` zorunlu değil:** boş bırakırsanız "ALL" filtresi
   DevLake'teki **tüm** projeleri sorgular. Belirli projeleri ayırmak isterseniz
   `projectNamesInDevLake` çıktısındaki adları kullanın.

3. **Tarayıcıdaki kırmızı uyarı şeridi** artık başarısız metriğin gerçek DB
   hatasını gösterir; bir metrik hata verse bile diğer kartlar yine çizilir.

4. **Veri var ama grafik düz/0** → o dönemde (7/30/90 gün) veri yok; zaman
   aralığını büyütün veya DevLake'in son collection tarihini kontrol edin.

## 6. Notlar / sınırlar

- `project_name` DevLake'in proje adıdır; filtre tutarlılığı için Jira project
  key'leriyle aynı tutmanız önerilir (`DEVLAKE_PROJECTS`).
- DORA panelleri DevLake'ten canlı gelir; **ek metrik paneli** (coverage,
  test otomasyon vb.) henüz mock'tur — DevLake'in `cq_*`/SonarQube tablolarına
  bağlanması TODO.
- Eşik/severity ve UI mantığı tüm modlarda aynıdır; sadece veri kaynağı değişir.
