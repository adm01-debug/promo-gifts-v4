/**
 * KitAIPromptDialog — Prompt natural que chama edge function kit-ai-builder
 * e aplica a sugestão de kit_type + filtros de busca.
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { invokeEdge } from '@/lib/edge/safeInvokeCall';

interface Suggestion {
  kit_type: 'montado' | 'original' | 'simples';
  box_keywords: string[];
  item_keywords: string[];
  target_price_brl: { min: number; max: number };
  narrative: string;
}

interface KitAIPromptDialogProps {
  onApply: (s: Suggestion) => void;
}

export function KitAIPromptDialog({ onApply }: KitAIPromptDialogProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const handleGenerate = async () => {
    if (prompt.trim().length < 6) {
      toast.error('Descreva melhor o kit desejado');
      return;
    }
    setLoading(true);
    setSuggestion(null);
    try {
      const { data, error } = await invokeEdge<{ error?: string; suggestion?: Suggestion }>(
        'kit-ai-builder',
        {
          body: { prompt: prompt.trim() },
        },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setSuggestion(data?.suggestion ?? null);
    } catch {
      toast.error('Erro ao gerar sugestão');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!suggestion) return;
    onApply(suggestion);
    setOpen(false);
    setSuggestion(null);
    setPrompt('');
    toast.success('Sugestão aplicada — refine os detalhes!');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          Montar com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Montar kit com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            placeholder='Ex.: "Kit para 50 colaboradores, R$120/cabeça, tema sustentabilidade"'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            disabled={loading}
            maxLength={2000}
          />
          <Button
            onClick={handleGenerate}
            disabled={loading || prompt.trim().length < 6}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            {loading ? 'Gerando...' : 'Gerar sugestão'}
          </Button>

          {suggestion && (
            <div className="animate-fade-in space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm">{suggestion.narrative}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">
                  Tipo: {suggestion.kit_type}
                </Badge>
                <Badge variant="outline" className="border-primary text-[10px] text-primary">
                  R$ {suggestion.target_price_brl.min}–{suggestion.target_price_brl.max}/kit
                </Badge>
              </div>
              <div>
                <p className="mb-1 text-[10px] text-muted-foreground">Caixa:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestion.box_keywords.map((k) => (
                    <Badge key={k} variant="secondary" className="text-[10px]">
                      {k}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] text-muted-foreground">Itens sugeridos:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestion.item_keywords.map((k) => (
                    <Badge key={k} variant="secondary" className="text-[10px]">
                      {k}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={handleApply} className="w-full" size="sm">
                Aplicar sugestão
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
