import { NextResponse } from "next/server";
import { getConnector } from "@/connectors";
import { parseMetricQuery } from "@/lib/query";

// Change Failure Rate — Hatalı Dağıtım / Toplam Dağıtım (Jenkins build sonuçları)
export async function GET(request: Request) {
  try {
    const query = parseMetricQuery(request.url);
    const result = await getConnector().changeFailureRate(query);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
