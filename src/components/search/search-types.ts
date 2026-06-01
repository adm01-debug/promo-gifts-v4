import {
  Package,
  Users,
  FileText,
  ShoppingCart,
  FolderHeart,
  Boxes,
  Sparkles,
  Image as ImageIcon,
  ClipboardList,
  Bell,
  MessageSquare,
  Wand2,
  Tag,
  Puzzle,
  Terminal,
  type LucideIcon,
} from 'lucide-react';

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  shortcut?: string;
}

export const typeConfig: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  product: { label: 'Produto', color: 'bg-primary', icon: Package },
  client: { label: 'Cliente', color: 'bg-success', icon: Users },
  quote: { label: 'Orçamento', color: 'bg-brand-primary', icon: FileText },
  order: { label: 'Pedido', color: 'bg-info', icon: ShoppingCart },
  collection: { label: 'Coleção', color: 'bg-pink-500', icon: FolderHeart },
  kit: { label: 'Kit', color: 'bg-violet-500', icon: Boxes },
  mockup: { label: 'Mockup', color: 'bg-fuchsia-500', icon: Sparkles },
  art_file: { label: 'Arquivo', color: 'bg-amber-500', icon: ImageIcon },
  cart_template: { label: 'Template', color: 'bg-cyan-500', icon: ClipboardList },
  reminder: { label: 'Lembrete', color: 'bg-yellow-500', icon: Bell },
  conversation: { label: 'Conversa', color: 'bg-emerald-500', icon: MessageSquare },
  magic_up: { label: 'Magic Up', color: 'bg-purple-500', icon: Wand2 },
  category: { label: 'Categoria', color: 'bg-blue-500', icon: Tag },
  component: { label: 'Componente', color: 'bg-indigo-500', icon: Puzzle },
  media: { label: 'Mídia', color: 'bg-rose-500', icon: ImageIcon },
  command: { label: 'Comando', color: 'bg-slate-700', icon: Terminal },
};
