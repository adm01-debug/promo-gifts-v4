import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditFieldProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  type?: 'number' | 'text';
  disabled?: boolean;
}

export function InlineEditField({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
  type = 'text',
  disabled = false,
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className={cn('h-7 text-sm', inputClassName)}
          placeholder={placeholder}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-success hover:text-success/80"
          onClick={handleSave}
          aria-label="Confirmar"
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive"
          onClick={handleCancel}
          aria-label="Fechar"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group -mx-1 flex cursor-pointer items-center gap-1 rounded px-1 transition-colors hover:bg-muted/50',
        disabled && 'cursor-default hover:bg-transparent',
        className,
      )}
      onClick={() => !disabled && setIsEditing(true)}
    >
      <span className={cn('text-sm', !value && 'text-muted-foreground')}>
        {value || placeholder || '—'}
      </span>
      {!disabled && (
        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
      )}
    </div>
  );
}
