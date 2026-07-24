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
import { PageSEO } from '@/components/seo/PageSEO';

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
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-6">
      <PageSEO
        title="Observabilidade do Sistema"
        description="Dashboard de observabilidade — kill-switches, hits e smoke tests"
      />
      <header className="flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Observabilidade do Sistema</h1>
          <p className="text-sm text-gray-500">
            Kill-switches, hits e smoke tests · Auto-refresh a cada 30s
          </p>
        </div>
        <button
          onClick={() => {
            ksData.refresh();
            void smoke.runNow();
          }}
          className="shrink-0 rounded-md border bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-gray-50"
        >
          ↺ Atualizar
        </button>
      </header>

      {/* SEÇÃO 1: Switches ativos */}
      <section data-testid="section-switches" className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          🚦 Kill-Switches
          {ksData.lastRefresh && (
            <span className="text-xs font-normal text-gray-500">
              · atualizado {formatRelative(ksData.lastRefresh.toISOString())}
            </span>
          )}
        </h2>
        {ksData.loading && <p className="text-sm text-gray-500">Carregando...</p>}
        {ksData.error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
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
              className="flex items-center justify-between rounded-md border bg-white p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm font-medium">{s.switch_name}</div>
                {s.legacy_message && (
                  <div className="mt-1 text-xs text-gray-600">{s.legacy_message}</div>
                )}
                {s.updated_at && (
                  <div className="mt-0.5 text-xs text-gray-400">
                    atualizado {formatRelative(s.updated_at)}
                  </div>
                )}
              </div>
              <div className="ml-3 flex shrink-0 flex-col items-end gap-1">
                <span
                  className={
                    s.enabled
                      ? 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'
                      : 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800'
                  }
                >
                  {s.enabled ? '● ATIVO' : '○ DESLIGADO'}
                </span>
                {!s.enabled && (s.rollout_percentage ?? 100) < 100 && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    rollout {s.rollout_percentage ?? 100}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SEÇÃO 2: Hits do kill-switch */}
      <section data-testid="section-hits" className="space-y-3">
        <h2 className="text-lg font-semibold">📊 Hits do Kill-Switch (callers bloqueados)</h2>
        {ksData.summary.length === 0 && !ksData.loading && (
          <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-gray-500">
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
                      <span
                        className={
                          row.source === 'front'
                            ? 'inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800'
                            : 'inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-800'
                        }
                      >
                        {row.source}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.operation ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.target ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.hits_1h}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {row.hits_24h}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                      {row.hits_7d}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">
                      {formatRelative(row.last_hit)}
                    </td>
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
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            🧪 Smoke Tests
            {smoke.lastRun && (
              <span className="text-xs font-normal text-gray-500">
                · última: {formatDate(smoke.lastRun.toISOString())}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => {
              smoke.runNow();
            }}
            disabled={smoke.running}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {smoke.running ? 'Rodando...' : 'Rodar agora'}
          </button>
        </div>

        {smoke.error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {smoke.error}
          </p>
        )}

        {smoke.latest.length > 0 && (
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded border bg-white p-3 text-sm">
              <div className="text-gray-500">Taxa de flake</div>
              <div className="text-lg font-semibold">{smoke.summary.flake_rate.toFixed(1)}%</div>
            </div>
            <div className="rounded border bg-white p-3 text-sm">
              <div className="text-gray-500">Tempo médio</div>
              <div className="text-lg font-semibold">
                {smoke.summary.avg_duration_ms !== null
                  ? `${smoke.summary.avg_duration_ms.toFixed(1)}ms`
                  : '—'}
              </div>
            </div>
            <div className="rounded border bg-white p-3 text-sm">
              <div className="text-gray-500">Falhas</div>
              <div className="text-lg font-semibold">
                {smoke.summary.failed}/{smoke.summary.total}
              </div>
            </div>
            <div className="rounded border bg-white p-3 text-sm">
              <div className="text-gray-500">Densidade de asserts úteis</div>
              <div className="text-lg font-semibold">
                {smoke.summary.useful_assert_density.toFixed(2)} / teste
              </div>
            </div>
          </div>
        )}

        {smoke.summary.module_failure_rates.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Módulo</th>
                  <th className="px-3 py-2 text-right">Falhas</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Taxa de falha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {smoke.summary.module_failure_rates.slice(0, 8).map((row) => (
                  <tr key={row.module} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{row.module}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.failed}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.total}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {row.failure_rate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {smoke.historical.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Execução</th>
                  <th className="px-3 py-2 text-right">Taxa de falha</th>
                  <th className="px-3 py-2 text-right">Tempo médio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {smoke.historical.map((item) => (
                  <tr key={item.ran_at}>
                    <td className="px-3 py-2 text-xs">{formatDate(item.ran_at)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {item.failure_rate.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {item.avg_duration_ms !== null ? `${item.avg_duration_ms.toFixed(1)}ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tendência: últimas execuções */}
        {smoke.trend.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto text-xs">
            <span className="shrink-0 text-gray-500">Tendência:</span>
            {smoke.trend
              .slice(0, 12)
              .reverse()
              .map((t) => {
                const allPass = t.failed === 0 && t.warned === 0;
                const hasFail = t.failed > 0;
                return (
                  <div
                    key={t.ran_at}
                    title={`${formatDate(t.ran_at)}\nPASS:${t.passed} FAIL:${t.failed} WARN:${t.warned}`}
                    className={
                      hasFail
                        ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded bg-red-500 font-medium text-white'
                        : allPass
                          ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded bg-green-500 font-medium text-white'
                          : 'flex h-8 w-8 shrink-0 items-center justify-center rounded bg-amber-500 font-medium text-white'
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
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{row.result}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.test_name}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{row.test_category ?? '—'}</td>
                    <td
                      className="max-w-md truncate px-3 py-2 text-xs text-gray-600"
                      title={row.details ?? ''}
                    >
                      {row.details ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-500">
                      {row.duration_ms !== null ? `${Number(row.duration_ms).toFixed(1)}ms` : '—'}
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
