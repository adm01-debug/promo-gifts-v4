import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  RotateCw,
  Save,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { SecretStatus } from '@/hooks/admin';

import { useSecretField } from './useSecretField';
import { MIN_SUFFIX_LENGTH } from './secretValidators';
import { buildUpdatedTooltip } from './SecretField.utils';
import { MaskedSuffixBadge } from './MaskedSuffixBadge';
import { JustSavedFlash } from './JustSavedFlash';
import { RotationHistoryRow } from './RotationHistoryRow';
import { CredentialSourceBadge } from './CredentialSourceBadge';
import { SecretImpactTooltip } from './SecretImpactTooltip';
import { useCredentialsSourceFilter } from './CredentialsSourceFilterContext';
import { RotateSecretConfirmDialog } from './RotateSecretConfirmDialog';
import { SaveSecretConfirmDialog } from './SaveSecretConfirmDialog';
import { SecretErrorAlert } from './SecretErrorAlert';
import { ConnectionTestDetailsDialog } from './ConnectionTestDetailsDialog';

interface Props {
  label: string;
  secretName: string;
  status?: SecretStatus;
  helperText?: string;
  onSaved?: () => void;
  connectionId?: string;
}

export function SecretField({
  label,
  secretName,
  status,
  helperText,
  onSaved,
  connectionId,
}: Props) {
  const { matchesFilter, filter } = useCredentialsSourceFilter();
  const logic = useSecretField({ secretName, status, connectionId, onSaved });

  const fadeOut = !matchesFilter(status);

  return (
    <div
      className={cn(
        'space-y-1.5 transition-opacity duration-200',
        fadeOut && 'pointer-events-none opacity-40',
      )}
      aria-hidden={fadeOut || undefined}
      data-source-filter={filter}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SecretImpactTooltip secretName={secretName} isMissing={!status?.has_value}>
            <Label className="cursor-help text-sm font-medium">{label}</Label>
          </SecretImpactTooltip>
          <CredentialSourceBadge status={status} />
          {logic.storedLooksSuspicious && (
            <div className="flex animate-pulse items-center gap-1 text-[10px] font-semibold text-destructive">
              <ShieldAlert className="h-3 w-3" />
              VALOR SUSPEITO
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {logic.lastError && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-destructive animate-in fade-in slide-in-from-right-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {logic.lastError.title}
            </div>
          )}
          {!logic.editing && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs hover:bg-primary/10"
                onClick={() => logic.startEdit('set')}
              >
                <Save className="h-3.5 w-3.5" />
                Alterar
              </Button>
              {status?.has_value && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 text-xs text-primary hover:bg-primary/10"
                  onClick={() => logic.startEdit('rotate')}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Rotacionar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="group/field relative">
        <div className="flex items-center gap-2">
          <div className="group relative flex-1">
            <Input
              type={logic.show ? 'text' : 'password'}
              placeholder={
                logic.editing ? `Cole o novo valor para ${secretName}...` : '••••••••••••••••'
              }
              value={logic.editing ? logic.value : ''}
              onChange={(e) => logic.setValue(e.target.value)}
              onPaste={logic.handlePaste}
              onBlur={logic.handleBlur}
              disabled={!logic.editing || logic.saving}
              className={cn(
                'h-9 border-border/40 bg-muted/20 pr-24 font-mono text-sm transition-all duration-200',
                logic.editing && 'border-primary/40 bg-background ring-1 ring-primary/10',
                !logic.editing && status?.has_value && 'cursor-default text-muted-foreground/60',
                logic.lastError && 'border-destructive/50 ring-destructive/10',
              )}
            />

            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              {!logic.editing && status?.has_value && (
                <MaskedSuffixBadge
                  suffix={status.masked_suffix}
                  length={status.length}
                  tooltip={buildUpdatedTooltip(
                    status.updated_at,
                    status.updated_by_email,
                    status.updated_by,
                  )}
                />
              )}

              {logic.editing && (
                <button
                  type="button"
                  onClick={() => logic.setShow(!logic.show)}
                  aria-label={logic.show ? 'Ocultar valor' : 'Mostrar valor'}
                  className="p-1.5 text-muted-foreground transition-colors hover:text-primary"
                >
                  {logic.show ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              )}
            </div>

            {logic.flash && (
              <div className="pointer-events-none absolute inset-0">
                <JustSavedFlash
                  key={logic.flash.key}
                  maskedSuffix={logic.flash.masked_suffix}
                  length={logic.flash.length}
                  action={logic.flash.action}
                  wasUpdate={logic.flash.was_update}
                  wasEnvFallback={logic.flash.was_env_fallback}
                />
              </div>
            )}
          </div>

          {logic.editing && (
            <div className="flex items-center gap-1 duration-200 animate-in fade-in zoom-in-95">
              <Button
                size="sm"
                className="h-9 gap-1.5 px-3 shadow-sm"
                onClick={logic.handleSave}
                disabled={!logic.canSave}
                title={logic.saveDisabledReason ?? undefined}
              >
                {logic.saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : logic.mode === 'rotate' ? (
                  <RotateCw className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {logic.mode === 'rotate' ? 'Rotacionar' : 'Salvar'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-muted-foreground hover:text-foreground"
                onClick={() => logic.setEditing(false)}
                disabled={logic.saving}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>

        {/* Banner de sufixo inválido (<MIN_SUFFIX_LENGTH chars).
            WCAG 2.1 AA: role=alert, aria-live=assertive, aria-atomic=true,
            programaticamente focável (tabIndex=-1) para screen readers. */}
        {logic.editing && logic.value.length > 0 && logic.value.length < MIN_SUFFIX_LENGTH && (
          <div
            data-testid="suffix-invalid-banner"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            tabIndex={-1}
            className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
          >
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <div className="space-y-1">
                <strong className="block font-semibold text-destructive">
                  Sufixo inválido — mínimo {MIN_SUFFIX_LENGTH} caracteres
                </strong>
                <p className="text-foreground/80">
                  O valor tem apenas {logic.value.length}{' '}
                  {logic.value.length === 1 ? 'caractere' : 'caracteres'}. O sufixo mascarado{' '}
                  <code className="font-mono">••••XXXX</code> precisa de pelo menos{' '}
                  {MIN_SUFFIX_LENGTH} caracteres.
                </p>
                <p className="text-xs text-muted-foreground">
                  O sufixo mascarado serve para identificar a credencial sem expor o segredo.
                  Salvamento bloqueado até atingir o mínimo.
                </p>
              </div>
            </div>
          </div>
        )}

        {logic.lastNormalization && (
          <div className="absolute -bottom-5 left-0 flex items-center gap-1.5 text-[10px] font-medium text-primary animate-in fade-in slide-in-from-top-1">
            <Sparkles className="h-3 w-3" />
            Normalizado: {logic.lastNormalization.join(', ')}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {helperText && !logic.lastError && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {helperText}
          </p>
        )}

        {logic.lastError && (
          <SecretErrorAlert
            error={logic.lastError}
            onViewDetails={logic.detailsAvailable ? () => logic.setDetailsOpen(true) : undefined}
          />
        )}

        <RotationHistoryRow secretName={secretName} refreshKey={logic.rotationRefreshKey} />
      </div>

      <RotateSecretConfirmDialog
        open={logic.rotateConfirmOpen}
        onOpenChange={logic.setRotateConfirmOpen}
        secretName={secretName}
        onConfirm={logic.handleConfirmedRotate}
        isLoading={logic.saving}
        error={logic.rotateConfirmError}
      />

      <SaveSecretConfirmDialog
        open={logic.saveConfirmOpen}
        onOpenChange={logic.setSaveConfirmOpen}
        secretName={secretName}
        onConfirm={logic.handleConfirmedSave}
        isLoading={logic.saving}
        error={logic.saveConfirmError}
      />

      {logic.detailsAvailable && (
        <ConnectionTestDetailsDialog
          open={logic.detailsOpen}
          onOpenChange={logic.setDetailsOpen}
          state={logic.testDetailsState}
        />
      )}
    </div>
  );
}
