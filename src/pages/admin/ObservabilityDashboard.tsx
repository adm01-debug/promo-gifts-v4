/**
 * Dashboard admin de observabilidade do sistema.
 *
 * Mostra:
 *   1. Switches ativos (system_kill_switches) com toggle visual
 *   2. Hits do kill-switch (agregados 1h/24h/7d por origem)
 *   3. Smoke tests da última execução + tendência das últimas 12
 *   4. Botão "Rodar smoke tests agora"
 *
 * Acesso: protegido por RLS no banco — qualquer não-admin recebe array vazio.
 * Auto-refresh kill-switch: 30s. Smoke tests: sob demanda.
 */
import { useKillSwitchObservability } from '@/hooks/admin/useKillSwitchObservability';
import { useSmokeTests } from '@/hooks/admin/useSmokeTests';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export default function ObservabilityDashboard(): JSX.Element {
  const ksData = useKillSwitchObservability();
  const smoke = useSmokeTests();

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-8">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold">Observabilidade do Sistema</h1>
        <p className="text-sm text-gray-500">
          Kill-switches, hits e smoke tests · Atualização kill-switch a cada 30s
        </p>
      </header>

      {/* SEÇÃO 1: Switches ativos */}
      <section data-testid="section-switches" className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          🚦 Kill-Switches
          {ksData.lastRefresh && (
            <span className="text-xs font-normal text-gray-500">
              · atualizado {formatRelative(ksData.lastRefresh.toISOString())}
            </span>
          )}
        </h2>
        {ksData.loading && <p className="text-sm text-gray-500">Carregando...</p>}
        {ksData.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            Erro: {ksData.error}
          </p>
        )}
        {!ksData.loading && ksData.switches.length === 0 && (
          <p className="text-sm text-gray-500">Nenhum switch configurado.</p>
        )}
        <div className="grid gap-2">
          {ksData.switches.map((s) => (
            <div
              key={s.switch_name}
              className="border rounded-md p-3 flex items-center justify-between bg-white"
            >
              <div className="min-w-0">
                <div className="font-mono text-sm font-medium">{s.switch_name}</div>
                {s.legacy_message && (
                  <div className="text-xs text-gray-600 mt-1">{s.legacy_message}</div>
                )}
              </div>
              <span
                className={
                  s.enabled
                    ? 'shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'
                    : 'shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800'
                }
              >
                {s.enabled ? '● ATIVO' : '○ DESLIGADO'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* SEÇÃO 2: Hits do kill-switch */}
      <section data-testid="section-hits" className="space-y-3">
        <h2 className="text-lg font-semibold">📊 Hits do Kill-Switch (callers bloqueados)</h2>
        {ksData.summary.length === 0 && !ksData.loading && (
          <p className="text-sm text-gray-500 bg-green-50 border border-green-200 rounded px-3 py-2">
            ✅ Zero hits registrados. Sistema migrado com sucesso ou switches todos ATIVOS.
          </p>
        )}
        {ksData.summary.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Switch</th>
                  <th className="px-3 py-2 text-left">Origem</th>
                  <th className="px-3 py-2 text-left">Operação</th>
                  <th className="px-3 py-2 text-left">Alvo</th>
                  <th className="px-3 py-2 text-right">1h</th>
                  <th className="px-3 py-2 text-right">24h</th>
                  <th className="px-3 py-2 text-right">7d</th>
                  <th className="px-3 py-2 text-right">Último</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ksData.summary.slice(0, 25).map((row, idx) => (
                  <tr key={`${row.switch_name}-${row.source}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{row.switch_name}</td>
                    <td className="px-3 py-2">
                      <span className={
                        row.source === 'front'
                          ? 'inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-800'
                          : 'inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-800'
                      }>{row.source}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.operation ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.target ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.hits_1h}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{row.hits_24h}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{row.hits_7d}</td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">{formatRelative(row.last_hit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SEÇÃO 3: Smoke tests */}
      <section data-testid="section-smoke" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            🧪 Smoke Tests
            {smoke.lastRun && (
              <span className="text-xs font-normal text-gray-500">
                · última: {formatDate(smoke.lastRun.toISOString())}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => void smoke.runNow()}
            disabled={smoke.running}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {smoke.running ? 'Rodando...' : 'Rodar agora'}
          </button>
        </div>

        {smoke.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {smoke.error}
          </p>
        )}

        {/* Tendência: últimas execuções */}
        {smoke.trend.length > 0 && (
          <div className="flex gap-2 items-center text-xs overflow-x-auto">
            <span className="text-gray-500 shrink-0">Tendência:</span>
            {smoke.trend.slice(0, 12).reverse().map((t) => {
              const allPass = t.failed === 0 && t.warned === 0;
              const hasFail = t.failed > 0;
              return (
                <div
                  key={t.ran_at}
                  title={`${formatDate(t.ran_at)}\nPASS:${t.passed} FAIL:${t.failed} WARN:${t.warned}`}
                  className={
                    hasFail
                      ? 'shrink-0 w-8 h-8 rounded bg-red-500 text-white flex items-center justify-center font-medium'
                      : allPass
                        ? 'shrink-0 w-8 h-8 rounded bg-green-500 text-white flex items-center justify-center font-medium'
                        : 'shrink-0 w-8 h-8 rounded bg-amber-500 text-white flex items-center justify-center font-medium'
                  }
                >
                  {t.passed}
                </div>
              );
            })}
          </div>
        )}

        {/* Tabela latest */}
        {smoke.latest.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Resultado</th>
                  <th className="px-3 py-2 text-left">Teste</th>
                  <th className="px-3 py-2 text-left">Categoria</th>
                  <th className="px-3 py-2 text-left">Detalhes</th>
                  <th className="px-3 py-2 text-right">Duração</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {smoke.latest.map((row, idx) => (
                  <tr key={`${row.test_name}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{row.result}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.test_name}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{row.test_category ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-md truncate" title={row.details ?? ''}>
                      {row.details ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs text-gray-500">
                      {row.duration_ms != null ? `${Number(row.duration_ms).toFixed(1)}ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
