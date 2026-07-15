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
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { Magazine } from './types';

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

export function useMagazinePublish(args: UseMagazinePublishArgs): UseMagazinePublishState {
  const { publishable, publishFn } = args;
  const [publishing, setPublishing] = useState(false);
  const [lastPublicUrl, setLastPublicUrl] = useState<string | null>(null);

  const publish = useCallback(async () => {
    if (!publishable) {
      toast.error('Não é possível publicar ainda.', {
        description:
          'Complete o título e adicione ao menos um produto antes de publicar.',
      });
      return;
    }
    if (publishing) return;

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

      const origin = args.origin ?? DEFAULT_ORIGIN();
      const url = `${origin}/revista-publica/${updated.publicToken}`;
      setLastPublicUrl(url);

      const writer = args.writeClipboard ?? DEFAULT_CLIPBOARD;
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
      setPublishing(false);
    }
  }, [args, publishable, publishing, publishFn]);

  return { publishing, lastPublicUrl, publish };
}
