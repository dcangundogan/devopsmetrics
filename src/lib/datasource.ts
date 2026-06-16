import { MOCK_COMPONENTS } from "@/lib/mock/data";

// ============================================================
// Veri kaynağı seçimi — tüm uygulama (API route'lar + sayfa) buradan
// hangi kaynağın aktif olduğunu öğrenir.
//
//   mock    -> deterministik örnek veri (kimlik bilgisi gerekmez)
//   live    -> Jira + Jenkins REST API'leri doğrudan
//   devlake -> HİBRİT: Apache DevLake'in DB'sinden okur (önerilen)
//
// Seçim önceliği:
//   1) DATA_SOURCE env (mock | live | devlake)
//   2) Geriye dönük uyumluluk: USE_MOCK=false -> live, aksi halde mock
// ============================================================

export type DataSource = "mock" | "live" | "devlake";

export function getDataSource(): DataSource {
  const explicit = (process.env.DATA_SOURCE ?? "").trim().toLowerCase();
  if (explicit === "mock" || explicit === "live" || explicit === "devlake") {
    return explicit;
  }
  const useMock = (process.env.USE_MOCK ?? "true").toLowerCase() !== "false";
  return useMock ? "mock" : "live";
}

function splitCsv(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Filtre menüsünde gösterilecek component/proje listesi.
 * Kaynağa göre uygun env'den okunur; boşsa mock listesine düşer.
 */
export function getComponentList(): string[] {
  switch (getDataSource()) {
    case "devlake": {
      const list = splitCsv(process.env.DEVLAKE_PROJECTS);
      return list.length > 0 ? list : [...MOCK_COMPONENTS];
    }
    case "live": {
      const list = splitCsv(process.env.JIRA_PROJECT_KEYS);
      return list.length > 0 ? list : [...MOCK_COMPONENTS];
    }
    default:
      return [...MOCK_COMPONENTS];
  }
}

/** UI rozeti için kaynak etiketi */
export function dataSourceLabel(source: DataSource): string {
  switch (source) {
    case "devlake":
      return "DEVLAKE (hibrit)";
    case "live":
      return "CANLI (Jira+Jenkins)";
    default:
      return "MOCK veri";
  }
}
