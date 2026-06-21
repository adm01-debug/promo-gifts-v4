import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LayoutTemplate, Save, Trash2, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { TemplatePreview } from './TemplatePreview';

interface TemplateArea {
  name: string;
  positionX: number;
  positionY: number;
  logoWidth: number;
  logoHeight: number;
  logoRotation?: number;
  logoScale?: number;
}

export interface ProductTemplate {
  id: string;
  name: string;
  icon: React.ElementType;
  areas: TemplateArea[];
  isCustom?: boolean;
}

interface TemplateSelectorProps {
  builtInTemplates: ProductTemplate[];
  customTemplates: ProductTemplate[];
  onApply: (template: ProductTemplate) => void;
  onDeleteCustom: (templateId: string) => void;
  onSaveClick: () => void;
  hasAreas: boolean;
}

export function TemplateSelector({
  builtInTemplates,
  customTemplates,
  onApply,
  onDeleteCustom,
  onSaveClick,
  hasAreas,
}: TemplateSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1">
          <LayoutTemplate aria-hidden="true" className="mr-1 h-4 w-4" />
          Templates
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Tipo de Produto</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {builtInTemplates.map((template) => (
            <HoverCard key={template.id} openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <DropdownMenuItem onClick={() => onApply(template)} className="cursor-pointer">
                  <template.icon aria-hidden="true" className="mr-2 h-4 w-4" />
                  {template.name}
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {template.areas.length}
                  </Badge>
                </DropdownMenuItem>
              </HoverCardTrigger>
              <HoverCardContent side="right" align="start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <template.icon aria-hidden="true" className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{template.name}</span>
                  </div>
                  <TemplatePreview areas={template.areas} />
                  <div className="space-y-0.5">
                    {template.areas.map((area, idx) => (
                      <div
                        key={`${area.name}-${idx}`}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground"
                      >
                        <span className="flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
                          {idx + 1}
                        </span>
                        {area.name} ({area.logoWidth}x{area.logoHeight}cm)
                      </div>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          ))}
        </DropdownMenuGroup>

        {customTemplates.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Meus Templates</DropdownMenuLabel>
            <DropdownMenuGroup>
              {customTemplates.map((template) => (
                <HoverCard key={template.id} openDelay={200} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <DropdownMenuItem className="group cursor-pointer">
                      <div className="flex flex-1 items-center" onClick={() => onApply(template)}>
                        <User aria-hidden="true" className="mr-2 h-4 w-4 text-primary" />
                        {template.name}
                        <Badge variant="secondary" className="ml-auto mr-2 text-[10px]">
                          {template.areas.length}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir template ${template.name}`}
                        className="h-5 w-5 text-destructive opacity-0 hover:text-destructive group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCustom(template.id);
                        }}
                      >
                        <Trash2 aria-hidden="true" className="h-3 w-3" />
                      </Button>
                    </DropdownMenuItem>
                  </HoverCardTrigger>
                  <HoverCardContent side="right" align="start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User aria-hidden="true" className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{template.name}</span>
                      </div>
                      <TemplatePreview areas={template.areas} />
                      <div className="space-y-0.5">
                        {template.areas.map((area, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground"
                          >
                            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">
                              {idx + 1}
                            </span>
                            {area.name} ({area.logoWidth}x{area.logoHeight}cm)
                          </div>
                        ))}
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSaveClick}
          className="cursor-pointer text-primary"
          disabled={!hasAreas}
        >
          <Save aria-hidden="true" className="mr-2 h-4 w-4" />
          Salvar Posicionamento Atual
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
