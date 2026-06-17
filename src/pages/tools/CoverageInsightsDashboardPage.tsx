import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

type CoverageSnapshot = {
  date: string;
  module: string;
  route: string;
  coverage: number;
};

type Dataset = {
  snapshots: CoverageSnapshot[];
};

const seedData: CoverageSnapshot[] = [
  { date: '2026-05-18', module: 'catalog', route: '/produtos', coverage: 86 },
  { date: '2026-05-19', module: 'catalog', route: '/produtos', coverage: 84 },
  { date: '2026-05-20', module: 'catalog', route: '/produtos', coverage: 81 },
  { date: '2026-05-18', module: 'quotes', route: '/orcamentos', coverage: 78 },
  { date: '2026-05-19', module: 'quotes', route: '/orcamentos', coverage: 74 },
  { date: '2026-05-20', module: 'quotes', route: '/orcamentos', coverage: 69 },
  { date: '2026-05-18', module: 'mockup', route: '/mockup-generator', coverage: 73 },
  { date: '2026-05-19', module: 'mockup', route: '/mockup-generator', coverage: 76 },
  { date: '2026-05-20', module: 'mockup', route: '/mockup-generator', coverage: 80 },
];

const parseDataset = (text: string): CoverageSnapshot[] => {
  const parsed = JSON.parse(text) as Dataset;
  if (!Array.isArray(parsed?.snapshots)) return [];
  return parsed.snapshots
    .filter((item) => item?.date && item?.module && item?.route)
    .map((item) => ({ ...item, coverage: Number(item.coverage) }))
    .filter((item) => Number.isFinite(item.coverage));
};

const getTrend = (values: number[]) => {
  if (values.length < 2) return 0;
  return Number((values[values.length - 1] - values[0]).toFixed(1));
};

export default function CoverageInsightsDashboardPage() {
  const [threshold, setThreshold] = useState(75);
  const [snapshots, setSnapshots] = useState<CoverageSnapshot[]>(seedData);

  const grouped = useMemo(() => {
    const map = new Map<string, CoverageSnapshot[]>();

    snapshots.forEach((item) => {
      const key = `${item.module}::${item.route}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    });

    return Array.from(map.entries())
      .map(([key, history]) => {
        const [module, route] = key.split('::');
        const sorted = history.sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1]?.coverage ?? 0;
        const trend = getTrend(sorted.map((i) => i.coverage));
        return { module, route, latest, trend, history: sorted };
      })
      .sort((a, b) => a.latest - b.latest);
  }, [snapshots]);

  const critical = useMemo(
    () => grouped.filter((item) => item.latest < threshold),
    [grouped, threshold],
  );

  return (
    <main className="space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Dashboard de Cobertura por Módulo e Rota</h1>
        <p className="text-sm text-muted-foreground">
          Visão temporal para uso interno/artefato de CI com detecção automática de áreas abaixo do
          limiar.
        </p>
      </header>

      <section className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="text-sm font-medium">Limiar mínimo: {threshold}%</label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Upload size={14} /> Importar JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                const data = parseDataset(text);
                if (data.length > 0) setSnapshots(data);
              }}
            />
          </label>
        </div>

        <input
          type="range"
          min={50}
          max={100}
          step={1}
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
          className="w-full"
        />
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Alertas automáticos</h2>
        {critical.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 size={16} /> Nenhuma área abaixo do limiar.
          </div>
        ) : (
          <ul className="space-y-2">
            {critical.map((item) => (
              <li
                key={`${item.module}-${item.route}`}
                className="flex items-center gap-2 text-amber-600"
              >
                <AlertTriangle size={16} />
                <span>
                  <strong>{item.module}</strong> · <code>{item.route}</code> está em{' '}
                  <strong>{item.latest}%</strong>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Visão por módulo / rota e evolução temporal</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Módulo</th>
                <th className="py-2">Rota</th>
                <th className="py-2">Cobertura atual</th>
                <th className="py-2">Evolução</th>
                <th className="py-2">Histórico</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((item) => (
                <tr key={`${item.module}-${item.route}`} className="border-b">
                  <td className="py-2">{item.module}</td>
                  <td className="py-2">
                    <code>{item.route}</code>
                  </td>
                  <td
                    className={cn(
                      'py-2 font-medium',
                      item.latest < threshold ? 'text-amber-600' : 'text-emerald-600',
                    )}
                  >
                    {item.latest}%
                  </td>
                  <td className={cn('py-2', item.trend < 0 ? 'text-red-600' : 'text-emerald-600')}>
                    {item.trend > 0 ? '+' : ''}
                    {item.trend} pp
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {item.history.map((point) => `${point.date}: ${point.coverage}%`).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
