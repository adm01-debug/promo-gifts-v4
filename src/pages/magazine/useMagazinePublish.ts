/**
 * useMagazinePublish — extrai o fluxo de publicação da revista da página.
 *
 * Motivação: o `MagazineEditorPage` estava com o handler `publish()` inline,
 * misturando 5 caminhos de UX (validação, exceção, RLS silent-fail, sucesso
 * parcial sem token, sucesso completo) + clipboard fallback. Extrair para um
 * hook permite testar cada branch em isolamento (Vitest) sem montar o editor
 * completo, e reutilizar o mesmo fluxo em futuros pontos (ex: quick-publish
 * a partir do dashboard de revistas).
 *
 * Contratos testados pelo `useMagazinePublish.test.ts`:
 *  U1 — publishable=false → toast.error, não chama publishFn.
 *  U2 — publishing=true (reentrada) → no-op.
 *  U3 — publishFn lança → toast.error com error.message.
 *  U4 — publishFn resolve null → toast.error (RLS/permissão).
 *  U5 — publishFn resolve sem publicToken → toast.warning (sucesso parcial).
 *  U6 — publishFn resolve com token + clipboard OK → toast.success + link.
 *  U7 — publishFn resolve com token + clipboard falha → toast.success + link visível.
 *  U8 — publishing volta a false SEMPRE (finally) mesmo com exceção.
 *
 * PERF FIX (2026-07-16):
 *  - Destructure args in signature so useCallback deps are stable primitives.
 *  - Guard de reentrância migrado de `publishing` state para `publishingRef`
 *    (useRef síncrono). Isso remove `publishing` das deps do useCallback,
 *    evitando que a fn seja recriada a cada setPublishing(true/false).
 *  - Resultado: `publish` ref é estável enquanto publishable e publishFn não
 *    mudam — React.memo em botões funciona corretamente.
 */

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Magazine } from '@/types/magazine';

export interface UseMagazinePublishArgs {
  publishable: boolean;
  publishFn: () => Promise<Magazine | null>;
  /**
   * Base URL para montar o link público. Default: `window.location.origin`.
   * Injetável para testes que rodam em Node/jsdom sem origin.
   */
  origin?: string;
  /**
   * Copiar para clipboard. Default: `navigator.clipboard.writeText`.
   * Injetável para simular ausência de clipboard / permissão negada.
   */
  writeClipboard?: (text: string) => Promise<void>;
}

export interface UseMagazinePublishState {
  publishing: boolean;
  /** Último link público gerado com sucesso (para exibir na UI mesmo se o toast sumiu). */
  lastPublicUrl: string | null;
  publish: () => Promise<void>;
}

const DEFAULT_CLIPBOARD = (text: string): Promise<void> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('clipboard-unavailable'));
};

const DEFAULT_ORIGIN = (): string =>
  typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';

export function useMagazinePublish({
  publishable,
  publishFn,
  origin,
  writeClipboard,
}: UseMagazinePublishArgs): UseMagazinePublishState {
  const [publishing, setPublishing] = useState(false);
  const [lastPublicUrl, setLastPublicUrl] = useState<string | null>(null);

  /**
   * PERF FIX: useRef para guard de reentrância.
   *
   * Antes: `if (publishing)` lia o STATE dentro do callback, obrigando
   * `publishing` a estar nas deps do useCallback. Isso recriava `publish`
   * toda vez que setPublishing(true/false) era chamado — ou seja, 2x por
   * publicação, além de qualquer render intermediário.
   *
   * Depois: publishingRef é síncrono. É atualizado ANTES do primeiro await,
   * portanto qualquer chamada concorrente vê o flag imediatamente (mesmo
   * sem re-render). O state `publishing` ainda é atualizado para a UI.
   * Com isso, `publishing` sai das deps → hook estável.
   */
  const publishingRef = useRef(false);

  const publish = useCallback(async () => {
    if (!publishable) {
      toast.error('Não é possível publicar ainda.', {
        description:
          'Complete o título e adicione ao menos um produto antes de publicar.',
      });
      return;
    }
    // Guard síncrono — não depende de re-render para ser efetivo
    if (publishingRef.current) return;

    publishingRef.current = true;
    setPublishing(true);
    try {
      let updated: Magazine | null = null;
      try {
        updated = await publishFn();
      } catch (err) {
        toast.error('Falha ao publicar a revista.', {
          description:
            err instanceof Error && err.message
              ? `Erro do servidor: ${err.message}`
              : 'Não foi possível concluir o UPDATE no banco. Verifique sua conexão e tente novamente.',
        });
        return;
      }

      if (!updated) {
        toast.error('Falha ao publicar a revista.', {
          description:
            'O UPDATE não retornou dados — a operação pode ter sido bloqueada por permissões (RLS) ou por indisponibilidade do banco. Tente novamente em alguns segundos.',
        });
        return;
      }

      if (!updated.publicToken) {
        toast.warning('Revista publicada, mas sem link público.', {
          description:
            'O status foi atualizado, porém o token público ficou vazio. Republique em instantes ou contate o suporte se o problema persistir.',
        });
        return;
      }

      const base = origin ?? DEFAULT_ORIGIN();
      const url = `${base}/revista-publica/${updated.publicToken}`;
      setLastPublicUrl(url);

      const writer = writeClipboard ?? DEFAULT_CLIPBOARD;
      try {
        await writer(url);
        toast.success('Revista publicada com sucesso.', {
          description: `Link copiado: ${url}`,
        });
      } catch {
        toast.success('Revista publicada com sucesso.', {
          description: `Não foi possível copiar automaticamente. Link: ${url}`,
        });
      }
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
    // Deps estáveis: sem `args` objeto e sem `publishing` state.
    // publishFn é estável graças ao useCallback em useMagazineEditor ([]).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishable, publishFn, origin, writeClipboard]);

  return { publishing, lastPublicUrl, publish };
}
