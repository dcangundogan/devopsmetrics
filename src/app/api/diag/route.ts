import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { createDbClient } from "@/connectors/db";

// ============================================================
// Teşhis (diagnostics) endpoint'i — DevLake hibrit kurulumunu doğrular.
//
// GET /api/diag
//   - Aktif veri kaynağını gösterir
//   - DevLake DB'sine bağlanır
//   - Anahtar tabloların satır sayılarını ve PRODUCTION SUCCESS deployment
//     sayısını döner
//   - DevLake'teki gerçek project_name değerlerini listeler
//
// "Grafik gelmiyor" durumunda: tablolar boşsa veri toplanmamıştır;
// project_name listesi DEVLAKE_PROJECTS ile eşleşmiyorsa filtre yanlıştır.
// ============================================================

export async function GET() {
  const source = getDataSource();
  if (source !== "devlake") {
    return NextResponse.json({
      dataSource: source,
      note: "Teşhis yalnızca DATA_SOURCE=devlake modunda anlamlıdır.",
    });
  }

  const url = process.env.DEVLAKE_DB_URL;
  if (!url) {
    return NextResponse.json(
      { dataSource: source, error: "DEVLAKE_DB_URL tanımlı değil" },
      { status: 500 },
    );
  }

  try {
    const db = await createDbClient(url);

    // Tek tek çalıştır; biri hata verse (tablo yoksa) diğerleri çalışsın.
    const safeScalar = async (sql: string, params: unknown[] = []) => {
      try {
        const rows = await db.query<Record<string, unknown>>(sql, params);
        const first = rows[0] ?? {};
        const val = Object.values(first)[0];
        return Number(val ?? 0);
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    };

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      deploymentCommits,
      projectMappings,
      issues,
      incidents,
      pullRequests,
      prMetrics,
      issueMetrics,
      prodSuccess30d,
    ] = await Promise.all([
      safeScalar("SELECT COUNT(*) AS c FROM cicd_deployment_commits"),
      safeScalar("SELECT COUNT(*) AS c FROM project_mapping"),
      safeScalar("SELECT COUNT(*) AS c FROM issues"),
      safeScalar("SELECT COUNT(*) AS c FROM issues WHERE type = 'INCIDENT'"),
      safeScalar("SELECT COUNT(*) AS c FROM pull_requests"),
      safeScalar("SELECT COUNT(*) AS c FROM project_pr_metrics"),
      safeScalar("SELECT COUNT(*) AS c FROM project_issue_metrics"),
      safeScalar(
        `SELECT COUNT(*) AS c FROM cicd_deployment_commits
         WHERE result = 'SUCCESS' AND environment = 'PRODUCTION'
           AND finished_date >= ?`,
        [since],
      ),
    ]);

    // DevLake'teki gerçek proje adları (filtre tutarlılığı kontrolü için)
    let projectNames: unknown;
    try {
      const rows = await db.query<{ project_name: string }>(
        "SELECT DISTINCT project_name FROM project_mapping ORDER BY project_name",
      );
      projectNames = rows.map((r) => r.project_name);
    } catch (e) {
      projectNames = { error: e instanceof Error ? e.message : String(e) };
    }

    return NextResponse.json({
      dataSource: source,
      dialect: db.dialect,
      connected: true,
      configuredProjects:
        (process.env.DEVLAKE_PROJECTS ?? "(boş — ALL = tüm projeler)") || null,
      rowCounts: {
        cicd_deployment_commits: deploymentCommits,
        project_mapping: projectMappings,
        issues,
        "issues(INCIDENT)": incidents,
        pull_requests: pullRequests,
        project_pr_metrics: prMetrics,
        project_issue_metrics: issueMetrics,
      },
      productionSuccessDeploymentsLast30d: prodSuccess30d,
      projectNamesInDevLake: projectNames,
    });
  } catch (err) {
    return NextResponse.json(
      {
        dataSource: source,
        connected: false,
        error: err instanceof Error ? err.message : "Bilinmeyen hata",
      },
      { status: 500 },
    );
  }
}
