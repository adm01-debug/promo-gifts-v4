/**
 * invokeExport — Onda 22
 * ----------------------------------------------------------------
 * Utilitários puros para exportar os eventos do `invokeTelemetrySink`
 * em CSV/JSON e disparar downloads via Blob. Sem PII: só os campos
 * já expostos pelo sink (ts, kind, fn, requestId, latencyMs, errorKind,
 * attempts).
 *
 * Também expõe o helper `emitRequestIdLookup(requestId)` que dispara
 * um `CustomEvent` global para o `AppHealthDashboard` capturar e abrir
 * o lookup histórico (fechando o loop live → histórico).
 */
import type { InvokeEvent } from './invokeTelemetrySink';

export const REQUEST_ID_LOOKUP_EVENT = 'app-health:lookup-request-id';

const CSV_COLUMNS = ['ts', 'iso', 'kind', 'fn', 'requestId', 'latencyMs', 'errorKind', 'attempts'] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function invokeEventsToCSV(events: readonly InvokeEvent[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = events.map((ev) => {
    const iso = new Date(ev.ts).toISOString();
    return [
      ev.ts,
      iso,
      ev.kind,
      ev.fn,
      ev.requestId,
      ev.latencyMs ?? '',
      ev.errorKind ?? '',
      ev.attempts ?? '',
    ]
      .map(csvEscape)
      .join(',');
  });
  return [header, ...rows].join('\n');
}

export function invokeEventsToJSON(events: readonly InvokeEvent[]): string {
  return JSON.stringify(
    events.map((ev) => ({ ...ev, iso: new Date(ev.ts).toISOString() })),
    null,
    2,
  );
}

export function buildDownloadFilename(kind: 'csv' | 'json', now: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `edge-invokes-${stamp}.${kind}`;
}

export function triggerDownload(filename: string, content: string, mime: string): void {
  try {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return;
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* nunca lança */
  }
}

export function emitRequestIdLookup(requestId: string): void {
  try {
    if (typeof window === 'undefined' || !requestId) return;
    window.dispatchEvent(
      new CustomEvent(REQUEST_ID_LOOKUP_EVENT, { detail: { requestId } }),
    );
  } catch {
    /* nunca lança */
  }
}

export async function copyRequestId(requestId: string): Promise<boolean> {
  try {
    if (!requestId) return false;
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(requestId);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
