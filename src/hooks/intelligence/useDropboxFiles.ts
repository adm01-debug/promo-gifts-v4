/**
 * useDropboxFiles — Hook for browsing Dropbox files via dropbox-list edge function
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const checkConnection = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('dropbox-list', {
        body: { action: 'check' },
      });
      if (error) throw error;
      setIsConnected(data?.connected ?? false);
      return data?.connected ?? false;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, []);

  const listFiles = useCallback(async (path = '') => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('dropbox-list', {
        body: { path, action: 'list' },
      });
      if (error) throw error;
      setEntries(data?.entries ?? []);
      setCurrentPath(path);
      return data?.entries ?? [];
    } catch (err) {
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

  return {
    entries,
    isLoading,
    isConnected,
    currentPath,
    checkConnection,
    listFiles,
    navigateToFolder,
    navigateUp,
  };
}
