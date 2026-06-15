import { NextResponse } from "next/server";
import { getConnector } from "@/connectors";
import { parseMetricQuery } from "@/lib/query";

// Deployment Frequency — Jenkins başarılı build sayısı (mock modda deterministik)
export async function GET(request: Request) {
  try {
    const query = parseMetricQuery(request.url);
    const result = await getConnector().deploymentFrequency(query);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
