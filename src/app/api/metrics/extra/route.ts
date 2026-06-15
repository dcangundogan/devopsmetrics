import { NextResponse } from "next/server";
import { parseMetricQuery } from "@/lib/query";
import { buildMockExtraMetrics } from "@/lib/mock/data";

// Ek metrikler (ikinci panel): Code Coverage, Mutation Test, Test Otomasyon,
// Application Anomaly, Code Review. Gerçek modda SonarQube/Grafana/SQL'den
// beslenir; mock modda deterministik veri döner.
export async function GET(request: Request) {
  try {
    const query = parseMetricQuery(request.url);
    const useMock = (process.env.USE_MOCK ?? "true").toLowerCase() !== "false";

    if (useMock) {
      return NextResponse.json({
        component: query.component,
        period: query.period,
        metrics: buildMockExtraMetrics(query.component, query.period),
      });
    }

    // Gerçek mod: SonarQube/Grafana/SQL connector'ları buraya bağlanır.
    // (sql.sqlCodeCoverage gibi) — henüz implemente edilmedi.
    return NextResponse.json(
      { error: "Ek metrikler için gerçek connector henüz bağlanmadı." },
      { status: 501 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
