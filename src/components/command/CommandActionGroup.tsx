/**
 * CommandActionGroup — Renderiza um grupo de ações no CommandBar
 */
import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import type { CommandAction } from './commandActions';

interface CommandActionGroupProps {
  heading: string;
  actions: CommandAction[];
  iconColor?: string;
  showSeparator?: boolean;
}

export function CommandActionGroup({
  heading,
  actions,
  iconColor = 'text-muted-foreground',
  showSeparator = true,
}: CommandActionGroupProps) {
  if (actions.length === 0) return null;

  return (
    <>
      {showSeparator && <CommandSeparator />}
      <CommandGroup heading={heading}>
        {actions.map((action) => (
          <CommandItem
            key={action.id}
            onSelect={action.action}
            className="flex cursor-pointer items-center gap-3 p-2"
          >
            <span className={iconColor}>{action.icon}</span>
            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-2">
                <span>{action.label}</span>
                {action.badge && (
                  <Badge
                    variant={action.badgeVariant || 'secondary'}
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {action.badge}
                  </Badge>
                )}
              </div>
              {action.description && (
                <span className="text-xs text-muted-foreground">{action.description}</span>
              )}
            </div>
            {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}
