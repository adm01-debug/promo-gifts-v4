import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/auth/useRBAC';

export interface CommandDefinition {
  id: string;
  command: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
  action: () => Promise<void> | void;
  keywords?: string[];
  devOnly?: boolean;
}

export function useSlashCommands(onClose: () => void) {
  const navigate = useNavigate();
  const { setTheme: _setTheme } = useTheme();
  const { signOut } = useAuth();
  const { isDev } = useRBAC();

  const commands: CommandDefinition[] = useMemo(
    () =>
      [
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
        {
          id: 'status',
          command: '/status',
          label: 'Status do Sistema',
          description: 'Verificar saúde do backend e APIs',
          icon: 'Activity',
          action: () => {
            navigate('/admin/status');
            onClose();
          },
          keywords: ['saúde', 'health', 'diagnostico'],
          devOnly: true,
        },
      ].filter((cmd) => !cmd.devOnly || isDev),
    [isDev, navigate, signOut, onClose],
  );

  return { commands };
}
