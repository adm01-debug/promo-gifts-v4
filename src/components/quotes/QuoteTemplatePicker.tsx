/**
 * QuoteTemplatePicker — dropdown para selecionar e aplicar templates de orçamento salvos.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileStack } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface QuoteTemplatePickerProps {
  onSelect: (templateId: string) => void;
}

export function QuoteTemplatePicker({ onSelect }: QuoteTemplatePickerProps) {
  const { data } = useQuery({
    queryKey: ['quote-templates'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('quote_templates')
        .select('id, name, description, is_default')
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return rows || [];
    },
  });

  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-1 text-xs">
        <FileStack className="h-3 w-3" /> Aplicar template
      </Label>
      <Select onValueChange={onSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione um template..." />
        </SelectTrigger>
        <SelectContent>
          {(data ?? []).map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
              {t.is_default && ' · padrão'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
