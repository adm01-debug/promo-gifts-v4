/**
 * useDropboxFiles — Hook for browsing Dropbox files via dropbox-list edge function
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { invokeEdge } from '@/lib/edge/safeInvokeCall';

export interface DropboxEntry {
  '.tag': 'file' | 'folder';
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
  size?: number;
  client_modified?: string;
  server_modified?: string;
  thumbnail_url?: string;
}

export function useDropboxFiles() {
  const [entries, setEntries] = useState<DropboxEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [error, setError] = useState<unknown>(null);

  const checkConnection = useCallback(async () => {
    try {
      const { data, error: edgeErr } = await invokeEdge<{ connected?: boolean }>('dropbox-list', {
        body: { action: 'check' },
      });
      if (edgeErr) throw new Error(edgeErr.message);
      setIsConnected(data?.connected || false);
      return data?.connected || false;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, []);

  const listFiles = useCallback(async (path = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: edgeErr } = await invokeEdge<{ entries?: DropboxEntry[] }>(
        'dropbox-list',
        {
          body: { path, action: 'list' },
        },
      );
      if (edgeErr) throw new Error(edgeErr.message);
      setEntries(data?.entries ?? []);
      setCurrentPath(path);
      return data?.entries ?? [];
    } catch (err) {
      setError(err);
      setEntries([]);
      const msg = err instanceof Error ? err.message : 'Erro ao listar arquivos';
      toast.error('Erro Dropbox', { description: msg });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const navigateToFolder = useCallback(
    async (folderPath: string) => {
      return listFiles(folderPath);
    },
    [listFiles],
  );

  const navigateUp = useCallback(async () => {
    if (!currentPath) return;
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    return listFiles(parentPath);
  }, [currentPath, listFiles]);

  const retry = useCallback(async () => {
    if (isConnected === false) {
      const ok = await checkConnection();
      if (ok) await listFiles(currentPath);
      return;
    }
    await listFiles(currentPath);
  }, [checkConnection, currentPath, isConnected, listFiles]);

  return {
    entries,
    isLoading,
    isConnected,
    currentPath,
    error,
    checkConnection,
    listFiles,
    navigateToFolder,
    navigateUp,
    retry,
  };
}
