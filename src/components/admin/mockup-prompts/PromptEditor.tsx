/**
 * PromptEditor — Formulário de edição de prompt individual
 */
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, History, Brain, Clock, Eye } from 'lucide-react';

export const AI_MODELS = [
  {
    value: 'google/gemini-2.5-flash-image-preview',
    label: 'Gemini 2.5 Flash Image',
    description: 'Rápido e econômico',
  },
  {
    value: 'google/gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image',
    description: 'Maior qualidade, mais lento',
  },
];

export interface PromptConfig {
  id: string;
  config_key: string;
  label: string;
  prompt_text: string;
  ai_model: string;
  is_active: boolean;
  technique_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface PromptEditorProps {
  config: PromptConfig;
  edited: { prompt_text: string; ai_model: string };
  hasChanges: boolean;
  saving: boolean;
  changeNote: string;
  onChangePrompt: (v: string) => void;
  onChangeModel: (v: string) => void;
  onChangeNote: (v: string) => void;
  onSave: () => void;
  onHistory: () => void;
  onTest: () => void;
  isMain: boolean;
}

export function PromptEditor({
  config,
  edited,
  hasChanges,
  saving,
  changeNote,
  onChangePrompt,
  onChangeModel,
  onChangeNote,
  onSave,
  onHistory,
  onTest,
  isMain,
}: PromptEditorProps) {
  const Wrapper = isMain ? Card : 'div';
  const wrapperProps = isMain ? { className: 'border-border/50 border-primary/20' } : {};

  return (
    <Wrapper {...wrapperProps}>
      <div className={isMain ? 'space-y-4 p-6' : 'space-y-4'}>
        {isMain && (
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Brain className="h-5 w-5 text-primary" />
                {config.label}
              </h3>
              <p className="text-sm text-muted-foreground">
                Template base enviado para a IA em toda geração de mockup
              </p>
            </div>
            <Badge variant="outline">
              <Clock className="mr-1 h-3 w-3" />v{config.version}
            </Badge>
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="max-w-xs flex-1">
            <Label className="mb-1 block text-xs text-muted-foreground">Modelo de IA</Label>
            <Select value={edited.ai_model} onValueChange={onChangeModel}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex items-center gap-2">
                      <span>{m.label}</span>
                      <span className="text-xs text-muted-foreground">— {m.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Texto do Prompt</Label>
          <Textarea
            value={edited.prompt_text}
            onChange={(e) => onChangePrompt(e.target.value)}
            className="min-h-[200px] font-mono text-xs leading-relaxed"
            placeholder="Digite o prompt da IA..."
          />
        </div>
        <div className="flex items-end gap-3">
          {hasChanges && (
            <div className="max-w-sm flex-1">
              <Label className="mb-1 block text-xs text-muted-foreground">
                Nota da alteração (opcional)
              </Label>
              <Input
                value={changeNote}
                onChange={(e) => onChangeNote(e.target.value)}
                placeholder="Ex: Ajustei regra de posicionamento..."
                className="h-9 text-sm"
              />
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={onTest}>
              <Eye className="mr-1 h-4 w-4" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={onHistory}>
              <History className="mr-1 h-4 w-4" />
              Histórico
            </Button>
            <Button size="sm" onClick={onSave} disabled={!hasChanges || saving}>
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
