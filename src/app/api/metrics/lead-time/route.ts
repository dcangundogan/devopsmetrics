import { NextResponse } from "next/server";
import { getConnector } from "@/connectors";
import { parseMetricQuery } from "@/lib/query";

// Lead Time for Changes — Jira issue/commit -> deployment süresi
export async function GET(request: Request) {
  try {
    const query = parseMetricQuery(request.url);
    const result = await getConnector().leadTime(query);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
