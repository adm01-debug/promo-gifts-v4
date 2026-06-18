/**
 * ContactSelector — Dropdown ou display de contato único
 */
import { useState, useEffect, useRef } from 'react';
import { User, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContactOption } from './shared-types';
import type { SelectedContactInfo } from '../CompanyContactSelector';

interface ContactDropdownProps {
  contacts: ContactOption[];
  contactId?: string;
  onContactChange?: (id: string) => void;
  onContactInfoChange?: (info: SelectedContactInfo | null) => void;
}

export function ContactDropdown({
  contacts,
  contactId,
  onContactChange,
  onContactInfoChange,
}: ContactDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = contacts.find((c) => c.id === contactId) ?? null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="contact-selector-trigger"
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        )}
        onClick={() => setOpen(!open)}
      >
        <div
          className={cn('flex min-w-0 items-center gap-2', !selected && 'text-muted-foreground')}
        >
          {selected ? (
            <>
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-3.5 w-3.5" />
              </div>
              <span className="truncate font-medium">{selected.name}</span>
            </>
          ) : (
            <span>Selecione um contato</span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-[280px] w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              data-testid={`contact-option-${contact.id}`}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/50',
                contactId === contact.id && 'bg-accent',
              )}
              onClick={() => {
                onContactChange?.(contact.id);
                onContactInfoChange?.({
                  id: contact.id,
                  name: contact.name,
                  email: contact.email ?? undefined,
                  phone: contact.phone ?? undefined,
                  cargo: contact.cargo ?? undefined,
                });
                setOpen(false);
              }}
            >
              <div
                className={cn(
                  'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
                  contactId === contact.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-primary/10 text-primary',
                )}
              >
                {contactId === contact.id ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{contact.name}</p>
                {contact.cargo && <p className="text-xs text-muted-foreground">{contact.cargo}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SingleContactDisplay({
  contact,
  contactId,
  onContactChange,
  onContactInfoChange,
}: {
  contact: ContactOption;
  contactId?: string;
  onContactChange?: (id: string) => void;
  onContactInfoChange?: (info: SelectedContactInfo | null) => void;
}) {
  useEffect(() => {
    if (contactId !== contact.id) {
      onContactChange?.(contact.id);
      onContactInfoChange?.({
        id: contact.id,
        name: contact.name,
        email: contact.email || undefined,
        phone: contact.phone || undefined,
        cargo: contact.cargo || undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id]);

  return (
    <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-3.5 w-3.5" />
        </div>
        <span className="truncate font-medium">{contact.name}</span>
        {contact.cargo && (
          <span className="hidden text-xs text-muted-foreground sm:inline">· {contact.cargo}</span>
        )}
      </div>
    </div>
  );
}
