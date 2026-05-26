import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CommandDefinition {
  id: string;
  command: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
  action: () => void | Promise<void>;
  keywords?: string[];
}

export function useSlashCommands(onClose: () => void) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const { signOut } = useAuth();

  const commands: CommandDefinition[] = [
    {
      id: 'theme-light',
      command: '/tema claro',
      label: 'Mudar para Tema Claro',
      description: 'Alterna a interface para o modo claro',
      icon: 'Sun',
      action: () => {
        setTheme('light');
        toast.success('Tema alterado', { description: 'Modo claro ativado.' });
        onClose();
      },
      keywords: ['light', 'claro', 'branco'],
    },
    {
      id: 'theme-dark',
      command: '/tema escuro',
      label: 'Mudar para Tema Escuro',
      description: 'Alterna a interface para o modo escuro',
      icon: 'Moon',
      action: () => {
        setTheme('dark');
        toast.success('Tema alterado', { description: 'Modo escuro ativado.' });
        onClose();
      },
      keywords: ['dark', 'escuro', 'preto'],
    },
    {
      id: 'logout',
      command: '/logout',
      label: 'Sair do Sistema',
      description: 'Encerra sua sessão atual com segurança',
      icon: 'LogOut',
      action: async () => {
        await signOut();
        navigate('/auth');
        onClose();
      },
      keywords: ['sair', 'exit', 'logoff'],
    },
    {
      id: 'new-quote',
      command: '/novo-orcamento',
      label: 'Novo Orçamento',
      description: 'Inicia a criação de um novo orçamento',
      icon: 'PlusCircle',
      action: () => {
        navigate('/orcamentos/novo');
        onClose();
      },
      keywords: ['criar', 'venda', 'proposta'],
    },
    {
      id: 'catalog',
      command: '/catalogo',
      label: 'Ir para o Catálogo',
      description: 'Ver todos os produtos disponíveis',
      icon: 'Package',
      action: () => {
        navigate('/');
        onClose();
      },
      keywords: ['produtos', 'itens', 'lista'],
    },
    {
      id: 'clients',
      command: '/clientes',
      label: 'Ir para Clientes',
      description: 'Gerenciar sua base de clientes e contatos',
      icon: 'Users',
      action: () => {
        navigate('/clientes');
        onClose();
      },
      keywords: ['crm', 'contatos', 'empresas'],
    },
    {
      id: 'simulator',
      command: '/simulador',
      label: 'Ir para o Simulador',
      description: 'Calcular preços e margens rapidamente',
      icon: 'Calculator',
      action: () => {
        navigate('/simulador');
        onClose();
      },
      keywords: ['preço', 'calculadora', 'margem'],
    },
    {
      id: 'support',
      command: '/suporte',
      label: 'Abrir Suporte',
      description: 'Falar com nosso time de atendimento',
      icon: 'LifeBuoy',
      action: () => {
        window.open('https://suporte.lovable.app', '_blank');
        onClose();
      },
      keywords: ['ajuda', 'ticket', 'duvida'],
    },
  ];

  return { commands };
}
