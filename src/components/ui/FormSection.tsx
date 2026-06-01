import { type ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  required?: boolean;
  badge?: ReactNode;
}

/**
 * FormSection - Agrupamento semântico de campos de formulário
 *
 * @example
 * <FormSection
 *   title="Informações Básicas"
 *   description="Preencha os dados principais do produto"
 *   collapsible
 *   defaultOpen
 * >
 *   <Input label="Nome" />
 *   <Input label="Descrição" />
 * </FormSection>
 */
export function FormSection({
  title,
  description,
  children,
  collapsible = false,
  defaultOpen = true,
  className,
  required = false,
  badge,
}: FormSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const headerContent = (
    <div className="flex items-center gap-2">
      <h3 className="font-display text-base font-semibold text-foreground">
        {title}
        {required && <span className="ml-1 text-destructive">*</span>}
      </h3>
      {badge}
    </div>
  );

  const descriptionContent = description && (
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
  );

  if (collapsible) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn('space-y-4', className)}>
        <div className="flex items-start justify-between">
          <div>
            {headerContent}
            {descriptionContent}
          </div>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="rounded-md p-1 transition-colors hover:bg-muted"
              aria-label={isOpen ? 'Recolher seção' : 'Expandir seção'}
            >
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-4">{children}</CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <fieldset className={cn('space-y-4', className)}>
      <legend className="sr-only">{title}</legend>
      <div>
        {headerContent}
        {descriptionContent}
      </div>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

// Divider between form sections
export function FormDivider({ className }: { className?: string }) {
  return <div className={cn('my-6 border-t border-border', className)} role="separator" />;
}

// Form actions footer
interface FormActionsProps {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
}

export function FormActions({ children, className, sticky = false }: FormActionsProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 pt-6',
        sticky && 'sticky bottom-0 -mx-6 border-t border-border bg-background px-6 py-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
