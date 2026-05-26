import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

interface DeprecatedRouteProps {
  /** Mensagem amigável exibida no toast */
  message: string;
  /** Caminho de redirecionamento (default: "/") */
  redirectTo?: string;
}

/**
 * Componente para rotas descontinuadas — exibe toast informativo
 * e redireciona para destino sugerido. Mantém UX amigável para usuários
 * que tinham bookmarks de features removidas.
 */
export const DeprecatedRoute = ({ message, redirectTo = '/' }: DeprecatedRouteProps) => {
  useEffect(() => {
    toast.info('Funcionalidade descontinuada', {
      description: message,
      duration: 6000,
    });
  }, [message]);

  return <Navigate to={redirectTo} replace />;
};
