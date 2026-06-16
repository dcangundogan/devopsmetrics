import { DashboardClient } from "@/components/DashboardClient";
import {
  getComponentList,
  getDataSource,
  dataSourceLabel,
} from "@/lib/datasource";

// Ana sayfa — server component. Component listesini ve aktif veri kaynağını
// datasource resolver'dan alır, interaktif kısmı DashboardClient'a devreder.

export default function HomePage() {
  const components = getComponentList();
  const source = getDataSource();
  const label = dataSourceLabel(source);

  const badgeClass =
    source === "mock"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : source === "devlake"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-green-50 text-green-700 border-green-200";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            DevOps Metrikleri Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Ekip DevOps sağlığı · DORA metrikleri · Jira + Jenkins
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${badgeClass}`}
        >
          {label}
        </span>
      </header>

      <DashboardClient components={components} />
    </main>
  );
}
