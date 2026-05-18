/**
 * ContactSelector — Dropdown ou display de contato único
 */
import { useState, useEffect, useRef } from "react";
import { User, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactOption } from "./shared-types";
import type { SelectedContactInfo } from "../CompanyContactSelector";

interface ContactDropdownProps {
  contacts: ContactOption[];
  contactId?: string;
  onContactChange?: (id: string) => void;
  onContactInfoChange?: (info: SelectedContactInfo | null) => void;
}

export function ContactDropdown({ contacts, contactId, onContactChange, onContactInfoChange }: ContactDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = contacts.find((c) => c.id === contactId) || null;

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button 
        type="button" 
        data-testid="contact-selector-trigger"
        className={cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-accent/50 transition-colors")}
        onClick={() => setOpen(!open)}>
        <div className={cn("flex items-center gap-2 min-w-0", !selected && "text-muted-foreground")}>
          {selected ? (
            <><div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary"><User className="h-3.5 w-3.5" /></div><span className="truncate font-medium">{selected.name}</span></>
          ) : <span>Selecione um contato</span>}
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-[280px] overflow-y-auto">
          {contacts.map((contact) => (
            <button 
              key={contact.id} 
              type="button" 
              data-testid={`contact-option-${contact.id}`}
              className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors text-left", contactId === contact.id && "bg-accent")}
              onClick={() => { onContactChange?.(contact.id); onContactInfoChange?.({ id: contact.id, name: contact.name, email: contact.email, phone: contact.phone, cargo: contact.cargo }); setOpen(false); }}>
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0", contactId === contact.id ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                {contactId === contact.id ? <Check className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0"><p className="font-medium truncate">{contact.name}</p>{contact.cargo && <p className="text-xs text-muted-foreground">{contact.cargo}</p>}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SingleContactDisplay({ contact, contactId, onContactChange, onContactInfoChange }: {
  contact: ContactOption; contactId?: string; onContactChange?: (id: string) => void; onContactInfoChange?: (info: SelectedContactInfo | null) => void;
}) {
  useEffect(() => {
    if (contactId !== contact.id) {
      onContactChange?.(contact.id);
      onContactInfoChange?.({ id: contact.id, name: contact.name, email: contact.email || undefined, phone: contact.phone || undefined, cargo: contact.cargo || undefined });
    }
  }, [contact.id]);

  return (
    <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary"><User className="h-3.5 w-3.5" /></div>
        <span className="truncate font-medium">{contact.name}</span>
        {contact.cargo && <span className="text-xs text-muted-foreground hidden sm:inline">· {contact.cargo}</span>}
      </div>
    </div>
  );
}
