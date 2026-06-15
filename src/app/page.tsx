import { DashboardClient } from "@/components/DashboardClient";
import { MOCK_COMPONENTS } from "@/lib/mock/data";

// Ana sayfa — server component. Component listesini env/mock'tan alır,
// interaktif kısmı DashboardClient'a devreder.

function getComponents(): string[] {
  // Gerçek modda Jira project key'lerinden, mock modda sabit listeden.
  const useMock = (process.env.USE_MOCK ?? "true").toLowerCase() !== "false";
  if (useMock) return [...MOCK_COMPONENTS];

  const raw = process.env.JIRA_PROJECT_KEYS ?? "";
  const keys = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return keys.length > 0 ? keys : [...MOCK_COMPONENTS];
}

export default function HomePage() {
  const components = getComponents();
  const useMock = (process.env.USE_MOCK ?? "true").toLowerCase() !== "false";

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
          className={
            "rounded-full px-3 py-1 text-xs font-medium " +
            (useMock
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-green-50 text-green-700 border border-green-200")
          }
        >
          {useMock ? "MOCK veri" : "CANLI veri"}
        </span>
      </header>

      <DashboardClient components={components} />
    </main>
  );
}
