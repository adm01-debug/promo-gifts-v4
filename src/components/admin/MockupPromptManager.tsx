/**
 * MockupPromptManager — Orchestrator (refactored)
 * Sub-components in ./mockup-prompts/
 */
import { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { untypedFrom } from '@/lib/supabase-untyped';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, Plus, Brain, Sparkles } from 'lucide-react';

import { PromptEditor, type PromptConfig } from './mockup-prompts/PromptEditor';
import {
  HistoryDialog,
  TestDialog,
  AddTechniqueDialog,
  type PromptHistory,
  type Technique,
} from './mockup-prompts/PromptDialogs';

const VARIABLE_REFERENCE = [
  ['{{productName}}', 'Nome do produto'],
  ['{{techniquePrompt}}', 'Descrição da técnica'],
  ['{{positionX}}', 'Posição X (%)'],
  ['{{positionY}}', 'Posição Y (%)'],
  ['{{horizontalPos}}', 'Descrição horizontal'],
  ['{{verticalPos}}', 'Descrição vertical'],
  ['{{positionDesc}}', 'Descrição posição completa'],
  ['{{sizeDesc}}', 'Tamanho (small/medium/large)'],
  ['{{logoWidthCm}}', 'Largura do logo (cm)'],
  ['{{logoHeightCm}}', 'Altura do logo (cm)'],
  ['{{scaleInstruction}}', 'Instrução de escala'],
  ['{{rotationInstruction}}', 'Instrução de rotação'],
];

export function MockupPromptManager() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<PromptConfig[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<
    Record<string, { prompt_text: string; ai_model: string }>
  >({});
  const [changeNotes, setChangeNotes] = useState<Record<string, string>>({});
  const [historyDialog, setHistoryDialog] = useState<{ configId: string; label: string } | null>(
    null,
  );
  const [history, setHistory] = useState<PromptHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [addTechniqueDialog, setAddTechniqueDialog] = useState(false);
  const [selectedTechnique, setSelectedTechnique] = useState('');
  const [testDialog, setTestDialog] = useState<{ configId: string; label: string } | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const [cr, tr] = await Promise.all([
        supabase.from('mockup_prompt_configs').select('*').order('config_key'),
        // personalization_techniques existe no banco mas ainda não está no
        // types.ts gerado — padrão do repo para esses casos é untypedFrom.
        untypedFrom<Technique>('personalization_techniques')
          .select('id, name, code')
          .eq('is_active', true),
      ]);
      if (cr.error) throw cr.error;
      if (tr.error) throw tr.error;
      setConfigs(cr.data ?? []);
      setTechniques(tr.data ?? []);
    } catch (err: unknown) {
      toast.error('Erro ao carregar configurações', {
        description: sanitizeError(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getEdited = (c: PromptConfig) =>
    editedPrompts[c.id] || { prompt_text: c.prompt_text, ai_model: c.ai_model };
  const hasChanges = (c: PromptConfig) => {
    const e = editedPrompts[c.id];
    return !!e && (e.prompt_text !== c.prompt_text || e.ai_model !== c.ai_model);
  };

  const handleSave = async (config: PromptConfig) => {
    const edited = getEdited(config);
    if (!hasChanges(config)) return;
    setSavingId(config.id);
    try {
      await supabase.from('mockup_prompt_history').insert({
        config_id: config.id,
        config_key: config.config_key,
        version: config.version,
        new_prompt: edited.prompt_text,
        old_prompt: config.prompt_text,
        ai_model: config.ai_model,
        changed_by: user?.id,
        change_notes: changeNotes[config.id] || null,
      });
      const { error } = await supabase
        .from('mockup_prompt_configs')
        .update({
          prompt_text: edited.prompt_text,
          ai_model: edited.ai_model,
          version: config.version + 1,
        })
        .eq('id', config.id);
      if (error) throw error;
      toast.success(`Prompt "${config.label}" salvo (v${config.version + 1})`);
      setEditedPrompts((p) => {
        const n = { ...p };
        delete n[config.id];
        return n;
      });
      setChangeNotes((p) => {
        const n = { ...p };
        delete n[config.id];
        return n;
      });
      fetchAll();
    } catch (err: unknown) {
      toast.error('Erro ao salvar', {
        description: sanitizeError(err),
      });
    } finally {
      setSavingId(null);
    }
  };

  const openHistory = async (configId: string, label: string) => {
    setHistoryDialog({ configId, label });
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('mockup_prompt_history')
        .select('*')
        .eq('config_id', configId)
        .order('version', { ascending: false });
      if (error) throw error;
      setHistory(data ?? []);
    } catch {
      toast.error('Erro ao carregar histórico');
    } finally {
      setHistoryLoading(false);
    }
  };

  const restoreVersion = (entry: PromptHistory) => {
    if (!historyDialog) return;
    setEditedPrompts((p) => ({
      ...p,
      [historyDialog.configId]: { prompt_text: entry.new_prompt, ai_model: entry.ai_model },
    }));
    setChangeNotes((p) => ({
      ...p,
      [historyDialog.configId]: `Restaurado da versão ${entry.version}`,
    }));
    setHistoryDialog(null);
    toast.info(`Versão ${entry.version} carregada. Clique em Salvar para confirmar.`);
  };

  const handleAddTechnique = async () => {
    const tech = techniques.find((t) => t.id === selectedTechnique);
    if (!tech) return;
    if (configs.find((c) => c.config_key === `technique_${tech.id}`)) {
      toast.error('Já existe um prompt para essa técnica');
      return;
    }
    try {
      const { error } = await supabase.from('mockup_prompt_configs').insert({
        config_key: `technique_${tech.id}`,
        label: `Prompt: ${tech.name}`,
        prompt_text: `Apply the logo using ${tech.name} technique. The result should look realistic with proper ${tech.name.toLowerCase()} texture and finish on the product surface.`,
        ai_model: 'google/gemini-2.5-flash-image-preview',
        technique_id: tech.id,
      });
      if (error) throw error;
      toast.success(`Prompt para "${tech.name}" criado`);
      setAddTechniqueDialog(false);
      setSelectedTechnique('');
      fetchAll();
    } catch (err: unknown) {
      toast.error('Erro ao criar prompt', {
        description: sanitizeError(err),
      });
    }
  };

  const handleTest = (config: PromptConfig) => {
    const edited = getEdited(config);
    setTestDialog({ configId: config.id, label: config.label });
    setIsTesting(true);
    const result = edited.prompt_text
      .replace(/\{\{productName\}\}/g, 'Caneca Cerâmica Branca')
      .replace(/\{\{techniquePrompt\}\}/g, 'applied as sublimation print')
      .replace(/\{\{positionX\}\}/g, '50')
      .replace(/\{\{positionY\}\}/g, '50')
      .replace(/\{\{horizontalPos\}\}/g, 'horizontally centered')
      .replace(/\{\{verticalPos\}\}/g, 'vertically centered')
      .replace(/\{\{positionDesc\}\}/g, 'vertically centered, horizontally centered')
      .replace(/\{\{sizeDesc\}\}/g, 'medium-sized')
      .replace(/\{\{logoWidthCm\}\}/g, '5')
      .replace(/\{\{logoHeightCm\}\}/g, '5')
      .replace(/\{\{scaleInstruction\}\}/g, '')
      .replace(/\{\{rotationInstruction\}\}/g, '');
    setTestResult(result);
    setIsTesting(false);
  };

  const setPromptField = (
    id: string,
    config: PromptConfig,
    field: 'prompt_text' | 'ai_model',
    val: string,
  ) => {
    setEditedPrompts((p) => ({ ...p, [id]: { ...getEdited(config), [field]: val } }));
  };

  const { mainPrompt, techniquePrompts, techniquesWithoutPrompt } = useMemo(() => {
    const main = configs.find((c) => c.config_key === 'main_prompt');
    const techPrompts = configs.filter((c) => c.config_key.startsWith('technique_'));
    const withPrompt = new Set(techPrompts.map((c) => c.technique_id));
    const withoutPrompt = techniques.filter((t) => !withPrompt.has(t.id));
    return {
      mainPrompt: main,
      techniquePrompts: techPrompts,
      techniquesWithoutPrompt: withoutPrompt,
    };
  }, [configs, techniques]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Gestão de Prompts - Gerador de Mockups</CardTitle>
                <CardDescription>
                  Edite os prompts enviados para a IA, selecione o modelo e acompanhe versões
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddTechniqueDialog(true)}
              disabled={techniquesWithoutPrompt.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Prompt por Técnica
            </Button>
          </div>
        </CardHeader>
      </Card>

      {mainPrompt && (
        <PromptEditor
          config={mainPrompt}
          edited={getEdited(mainPrompt)}
          hasChanges={hasChanges(mainPrompt)}
          saving={savingId === mainPrompt.id}
          changeNote={changeNotes[mainPrompt.id] ?? ''}
          onChangePrompt={(v) => setPromptField(mainPrompt.id, mainPrompt, 'prompt_text', v)}
          onChangeModel={(v) => setPromptField(mainPrompt.id, mainPrompt, 'ai_model', v)}
          onChangeNote={(v) => setChangeNotes((p) => ({ ...p, [mainPrompt.id]: v }))}
          onSave={() => handleSave(mainPrompt)}
          onHistory={() => openHistory(mainPrompt.id, mainPrompt.label)}
          onTest={() => handleTest(mainPrompt)}
          isMain
        />
      )}

      {techniquePrompts.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Prompts por Técnica
            </CardTitle>
            <CardDescription>
              Prompts específicos que complementam o prompt principal para cada técnica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-2">
              {techniquePrompts.map((config) => (
                <AccordionItem key={config.id} value={config.id} className="rounded-lg border px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{config.label}</span>
                      <Badge variant="outline" className="text-xs">
                        v{config.version}
                      </Badge>
                      {hasChanges(config) && (
                        <Badge variant="secondary" className="bg-warning/10 text-xs text-warning">
                          Alterado
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <PromptEditor
                      config={config}
                      edited={getEdited(config)}
                      hasChanges={hasChanges(config)}
                      saving={savingId === config.id}
                      changeNote={changeNotes[config.id] ?? ''}
                      onChangePrompt={(v) => setPromptField(config.id, config, 'prompt_text', v)}
                      onChangeModel={(v) => setPromptField(config.id, config, 'ai_model', v)}
                      onChangeNote={(v) => setChangeNotes((p) => ({ ...p, [config.id]: v }))}
                      onSave={() => handleSave(config)}
                      onHistory={() => openHistory(config.id, config.label)}
                      onTest={() => handleTest(config)}
                      isMain={false}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">Variáveis Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
            {VARIABLE_REFERENCE.map(([key, desc]) => (
              <div key={key} className="flex items-center gap-2">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-primary">{key}</code>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AddTechniqueDialog
        open={addTechniqueDialog}
        techniques={techniquesWithoutPrompt}
        selected={selectedTechnique}
        onSelectTechnique={setSelectedTechnique}
        onAdd={handleAddTechnique}
        onClose={() => setAddTechniqueDialog(false)}
      />
      <HistoryDialog
        open={!!historyDialog}
        label={historyDialog?.label ?? ''}
        history={history}
        loading={historyLoading}
        onClose={() => setHistoryDialog(null)}
        onRestore={restoreVersion}
      />
      <TestDialog
        open={!!testDialog}
        label={testDialog?.label ?? ''}
        result={testResult}
        loading={isTesting}
        onClose={() => setTestDialog(null)}
      />
    </div>
  );
}
