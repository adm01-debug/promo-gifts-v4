import { forwardRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const routeLabels: Record<string, string> = {
  '/': 'Início',
  '/produtos': 'Produtos',
  '/filtros': 'Super Filtro',
  '/novidades': 'Novidades',
  '/colecoes': 'Coleções',
  '/orcamentos': 'Orçamentos',
  '/simulador': 'Simulador',
  '/simulador-precos': 'Preços por Tiragem',
  '/mockup-generator': 'Gerador de Mockups',
  '/magic-up': 'Magic Up',
  '/favoritos': 'Favoritos',
  '/comparar': 'Comparar',

  '/configuracoes': 'Configurações',
  '/admin': 'Administração',
  '/seguranca': 'Segurança',
  '/estoque': 'Estoque',
};

interface BackButtonProps {
  className?: string;
  fallbackPath?: string;
}

export const BackButton = forwardRef<HTMLButtonElement, BackButtonProps>(
  ({ className, fallbackPath }: BackButtonProps, ref) => {
    const navigate = useNavigate();
    const location = useLocation();

    const getParentPath = useCallback(() => {
      const pathParts = location.pathname.split('/').filter(Boolean);
      if (pathParts.length <= 1) return '/';

      const lastPart = pathParts[pathParts.length - 1];
      const isId =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastPart) ||
        /^\d+$/.test(lastPart);

      if (isId && pathParts.length > 2) {
        return `/${pathParts.slice(0, -2).join('/')}`;
      }
      return `/${pathParts.slice(0, -1).join('/')}`;
    }, [location.pathname]);

    if (location.pathname === '/') return null;

    const targetPath = fallbackPath || getParentPath();
    const parentLabel = routeLabels[targetPath] || targetPath.split('/').pop() || 'Início';

    const handleBack = () => {
      if (window.history.length > 2) {
        navigate(-1);
      } else {
        navigate(targetPath);
      }
    };

    const ariaLabel = `Voltar para ${parentLabel}`;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="animate-fade-in">
            <Button
              ref={ref}
              variant="ghost"
              size="sm"
              onClick={handleBack}
              aria-label={ariaLabel}
              className={cn(
                'group -ml-2 h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                className,
              )}
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden text-sm sm:inline">Voltar para {parentLabel}</span>
              <span className="text-sm sm:hidden">Voltar</span>
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">{ariaLabel}</TooltipContent>
      </Tooltip>
    );
  },
);
