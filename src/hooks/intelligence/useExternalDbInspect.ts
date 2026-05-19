/**
 * useExternalDbInspect — Admin hook for external database inspection
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TableInfo {
  name: string;
  schema: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
  rowCount?: number;
}

interface InspectResult {
  tables?: TableInfo[];
  table?: TableInfo;
  error?: string;
}

export function useExternalDbInspect() {
  const [result, setResult] = useState<InspectResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const inspect = useCallback(async (action: string = "list_tables", params: Record<string, unknown> = {}) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("external-db-inspect", {
        body: { action, ...params },
      });
      if (error) throw error;
      setResult(data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro na inspeção";
      toast.error("Erro ao inspecionar banco externo", { description: msg });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const listTables = useCallback(() => inspect("list_tables"), [inspect]);
  const describeTable = useCallback((tableName: string) => inspect("describe_table", { table_name: tableName }), [inspect]);

  return { result, isLoading, inspect, listTables, describeTable };
}
