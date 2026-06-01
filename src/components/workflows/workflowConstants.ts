/**
 * Constants extracted from WorkflowCanvas
 */
import { Bot, Zap, Search, FileText } from 'lucide-react';

export const STEP_TYPES = [
  {
    value: 'agent',
    label: 'Agente IA',
    icon: Bot,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/30',
  },
  {
    value: 'tool',
    label: 'Ferramenta',
    icon: Zap,
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
  },
  {
    value: 'condition',
    label: 'Condição',
    icon: Search,
    color: 'text-primary/80',
    bg: 'bg-primary/10',
    border: 'border-primary/25',
  },
  {
    value: 'output',
    label: 'Saída',
    icon: FileText,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/30',
  },
];

export const AI_MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'openai/gpt-5', label: 'GPT-5' },
];
