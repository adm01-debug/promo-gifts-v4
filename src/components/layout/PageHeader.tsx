import { type ReactNode } from 'react';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/navigation/Breadcrumbs';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
  showBreadcrumbs?: boolean;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
  showBreadcrumbs = true,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-6 space-y-4', className)}>
      {/* Breadcrumbs */}
      {showBreadcrumbs && <Breadcrumbs items={breadcrumbs} className="text-muted-foreground" />}

      {/* Title row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// Compact variant for nested pages
interface PageHeaderCompactProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeaderCompact({ title, subtitle, actions, className }: PageHeaderCompactProps) {
  return (
    <header className={cn('mb-4 flex items-center justify-between', className)}>
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
