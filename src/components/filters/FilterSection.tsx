import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface FilterSectionProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  badge?: number;
  isOpen: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

export function FilterSection({
  id,
  title,
  icon,
  badge,
  isOpen,
  onToggle,
  children,
}: FilterSectionProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={() => onToggle(id)}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-3 text-sm font-medium transition-colors hover:text-primary">
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
          {badge !== undefined && badge > 0 && (
            <Badge
              variant="secondary"
              className="flex h-5 min-w-5 items-center justify-center text-xs"
            >
              {badge}
            </Badge>
          )}
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
