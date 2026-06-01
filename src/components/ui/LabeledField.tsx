/**
 * LabeledField — Compound component that correctly links <Label> to <Input>
 * (or <Textarea>) via a shared `React.useId()` id.
 *
 * This is the canonical fix for the DevTools accessibility warning:
 *  "No label associated with a form field"
 *
 * Usage:
 *   // Instead of:
 *   <Label>Email</Label>
 *   <Input type="email" />
 *
 *   // Use:
 *   <LabeledField label="Email" name="email" type="email" />
 *
 *   // With error:
 *   <LabeledField
 *     label="Email"
 *     name="email"
 *     type="email"
 *     required
 *     description="Usado para login"
 *     error={errors.email?.message}
 *   />
 *
 *   // Textarea variant:
 *   <LabeledTextarea label="Observações" name="obs" rows={4} />
 */
import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────

interface LabeledFieldBaseProps {
  /** Text shown in the <label>. Required for accessibility. */
  label: string;
  /** Marks field as required — appends a red asterisk to the label. */
  required?: boolean;
  /** Optional helper text shown below the field. */
  description?: string;
  /** Error message shown below the field in destructive colour. */
  error?: string;
  /** Additional class names for the outer wrapper div. */
  wrapperClassName?: string;
  /** Additional class names for the label. */
  labelClassName?: string;
}

// ─────────────────────────────────────────────
// LabeledField  (wraps <Input>)
// ─────────────────────────────────────────────

export type LabeledFieldProps = LabeledFieldBaseProps & Omit<React.ComponentProps<'input'>, 'id'>;

/**
 * Renders a <Label> + <Input> pair with a shared `id` so the browser
 * correctly associates them. The id is auto-generated when not supplied.
 */
export const LabeledField = React.forwardRef<HTMLInputElement, LabeledFieldProps>(
  (
    {
      label,
      required,
      description,
      error,
      wrapperClassName,
      labelClassName,
      name,
      className,
      ...inputProps
    },
    ref,
  ) => {
    const autoId = React.useId();
    // Prefer name-based id for readability in DevTools; fall back to autoId.
    const fieldId = name ? `field-${name}` : autoId;
    const descriptionId = description ? `${fieldId}-description` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;

    const ariaDescribedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={cn('space-y-2', wrapperClassName)}>
        <Label htmlFor={fieldId} className={cn(error && 'text-destructive', labelClassName)}>
          {label}
          {required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>

        <Input
          ref={ref}
          id={fieldId}
          name={name}
          aria-describedby={ariaDescribedBy}
          aria-invalid={!!error}
          aria-required={required}
          className={className}
          {...inputProps}
        />

        {description && !error && (
          <p id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </p>
        )}

        {error && (
          <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
LabeledField.displayName = 'LabeledField';

// ─────────────────────────────────────────────
// LabeledTextarea  (wraps <Textarea>)
// ─────────────────────────────────────────────

export type LabeledTextareaProps = LabeledFieldBaseProps &
  Omit<React.ComponentProps<'textarea'>, 'id'>;

/**
 * Renders a <Label> + <Textarea> pair with a shared `id`.
 */
export const LabeledTextarea = React.forwardRef<HTMLTextAreaElement, LabeledTextareaProps>(
  (
    {
      label,
      required,
      description,
      error,
      wrapperClassName,
      labelClassName,
      name,
      className,
      ...textareaProps
    },
    ref,
  ) => {
    const autoId = React.useId();
    const fieldId = name ? `field-${name}` : autoId;
    const descriptionId = description ? `${fieldId}-description` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;
    const ariaDescribedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={cn('space-y-2', wrapperClassName)}>
        <Label htmlFor={fieldId} className={cn(error && 'text-destructive', labelClassName)}>
          {label}
          {required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>

        <Textarea
          ref={ref}
          id={fieldId}
          name={name}
          aria-describedby={ariaDescribedBy}
          aria-invalid={!!error}
          aria-required={required}
          className={className}
          {...textareaProps}
        />

        {description && !error && (
          <p id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </p>
        )}

        {error && (
          <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
LabeledTextarea.displayName = 'LabeledTextarea';
