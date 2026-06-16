import { NextResponse } from "next/server";
import { parseMetricQuery } from "@/lib/query";
import { buildMockExtraMetrics } from "@/lib/mock/data";
import { getDataSource } from "@/lib/datasource";

// Ek metrikler (ikinci panel): Code Coverage, Mutation Test, Test Otomasyon,
// Application Anomaly, Code Review. Gerçek/DevLake modda SonarQube/Grafana/SQL'den
// beslenir; mock modda deterministik veri döner.
export async function GET(request: Request) {
  try {
    const query = parseMetricQuery(request.url);

    if (getDataSource() === "mock") {
      return NextResponse.json({
        component: query.component,
        period: query.period,
        metrics: buildMockExtraMetrics(query.component, query.period),
      });
    }

    // Gerçek/DevLake mod: SonarQube/Grafana/SQL connector'ları buraya bağlanır.
    // (henüz implemente edilmedi — DORA panelleri canlı, ek metrikler TODO)
    return NextResponse.json(
      { error: "Ek metrikler için gerçek connector henüz bağlanmadı." },
      { status: 501 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
