import { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useSecretsManager, type SecretStatus, type SecretMutationResult } from '@/hooks/admin';
import { normalizeSecret } from './secretNormalizers';
import { validateSecretName } from './secretWhitelist';
import { validateSecret, getMinLength, MIN_SUFFIX_LENGTH } from './secretValidators';
import { normalizeMaskedSuffix } from '@/lib/masked-suffix';
import { withRetryBackoff, CancelledError } from './secretRetry';
import { normalizeSecretError, type NormalizedSecretError } from './secretErrors';
import { useConnectionTestDetails } from '@/hooks/intelligence';
import { mapConnectionToTester } from './SecretField.utils';

export interface FlashState {
  masked_suffix: string | null;
  length: number;
  action: 'rotate' | 'set';
  was_update: boolean;
  was_env_fallback: boolean;
  key: number;
}

interface UseSecretFieldProps {
  secretName: string;
  status?: SecretStatus;
  connectionId?: string;
  onSaved?: () => void;
}

export function useSecretField({ secretName, status, connectionId, onSaved }: UseSecretFieldProps) {
  const { setSecret, rotateSecret } = useSecretsManager();
  const draftScope = connectionId ?? '_';
  const draftKey = `secret-draft:${draftScope}:${secretName}`;
  const legacyDraftKey = `secret-draft:${secretName}`;

  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<'rotate' | 'set'>('set');
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [rotationRefreshKey, setRotationRefreshKey] = useState(0);
  const [lastError, setLastError] = useState<NormalizedSecretError | null>(null);
  const flashCounter = useRef(0);
  const [lastNormalization, setLastNormalization] = useState<string[] | null>(null);
  const normTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [rotateConfirmError, setRotateConfirmError] = useState<string | null>(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saveConfirmError, setSaveConfirmError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const testerMap = useMemo(() => mapConnectionToTester(connectionId), [connectionId]);
  const testDetailsState = useConnectionTestDetails({
    open: detailsOpen && !!testerMap,
    type: testerMap?.type ?? 'n8n',
    envKey: testerMap?.envKey,
    connectionId,
  });

  const showNormalization = (changes: string[]) => {
    if (changes.length === 0) return;
    setLastNormalization(changes);
    if (normTimerRef.current) clearTimeout(normTimerRef.current);
    normTimerRef.current = setTimeout(() => setLastNormalization(null), 4000);
    toast.info('Valor normalizado', {
      id: `paste-norm-${secretName}`,
      description: changes.join(', '),
      duration: 3500,
    });
  };

  useEffect(() => {
    return () => {
      if (normTimerRef.current) clearTimeout(normTimerRef.current);
    };
  }, []);

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const raw = e.clipboardData.getData('text');
    if (!raw) return;
    e.preventDefault();
    const { value: normalized, changes } = normalizeSecret(secretName, raw);
    setValue(normalized);
    if (lastError) setLastError(null);
    showNormalization(changes);
  };

  const handleBlur = () => {
    if (!value) return;
    const { value: normalized, changes } = normalizeSecret(secretName, value);
    if (normalized !== value) {
      setValue(normalized);
      showNormalization(changes);
    }
  };

  useEffect(() => {
    const abortController = abortRef.current;

    // Reset transients on change
    abortController?.abort();
    abortRef.current = null;
    setValue('');
    setEditing(false);
    setMode('set');
    setShow(false);
    setSaving(false);
    setLastError(null);
    setLastNormalization(null);
    if (normTimerRef.current) {
      clearTimeout(normTimerRef.current);
      normTimerRef.current = null;
    }
    setRotateConfirmOpen(false);
    setRotateConfirmError(null);
    setSaveConfirmOpen(false);
    setSaveConfirmError(null);
    setFlash(null);

    // Re-hydrate
    try {
      const scopedRaw = sessionStorage.getItem(draftKey);
      const raw = scopedRaw ?? sessionStorage.getItem(legacyDraftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.value) {
          setValue(draft.value);
          setMode(draft.mode === 'rotate' ? 'rotate' : 'set');
          setEditing(true);
          if (!scopedRaw) {
            sessionStorage.setItem(draftKey, raw);
            sessionStorage.removeItem(legacyDraftKey);
          }
        }
      }
    } catch {
      /* empty */
    }
  }, [secretName, connectionId, draftScope, draftKey, legacyDraftKey]);

  useEffect(() => {
    if (editing && value.length > 0) {
      sessionStorage.setItem(draftKey, JSON.stringify({ value, mode }));
    } else {
      sessionStorage.removeItem(draftKey);
    }
  }, [editing, value, mode, draftKey]);

  const performSave = async (
    currentMode: 'rotate' | 'set',
    currentValue: string,
    notes?: string,
  ) => {
    const wasEnvFallback = !!status?.env_fallback_active;
    const toastId = `secret-${secretName}-${Date.now()}`;
    const controller = new AbortController();
    abortRef.current = controller;

    const baseLabel =
      currentMode === 'rotate' ? `Rotacionando ${secretName}` : `Salvando ${secretName}`;
    const cancelAction = { label: 'Cancelar', onClick: () => controller.abort() };

    const slowTimer = setTimeout(() => {
      toast.loading(`${baseLabel}…`, { id: toastId, action: cancelAction });
    }, 800);

    let result: SecretMutationResult;
    try {
      result = await withRetryBackoff(
        () =>
          currentMode === 'rotate'
            ? rotateSecret(secretName, currentValue, notes)
            : setSecret(secretName, currentValue),
        {
          signal: controller.signal,
          onAttempt: (attempt, nextDelayMs) => {
            if (attempt > 1 || nextDelayMs !== null) {
              const sec = nextDelayMs ? Math.max(1, Math.round(nextDelayMs / 1000)) : null;
              const desc = nextDelayMs
                ? `Rede instável — nova tentativa em ${sec}s (tentativa ${attempt}/3)`
                : `Tentativa ${attempt}/3…`;
              toast.loading(`${baseLabel}…`, {
                id: toastId,
                description: desc,
                action: cancelAction,
              });
            }
          },
        },
      );
    } catch (err) {
      if (err instanceof CancelledError) {
        clearTimeout(slowTimer);
        abortRef.current = null;
        toast(`${baseLabel} cancelado`, { id: toastId, duration: 3000 });
        return { ok: false as const, errorDescription: 'Cancelado pelo usuário', cancelled: true };
      }
      result = {
        ok: false,
        error: {
          code: 'unexpected',
          message: err instanceof Error ? err.message : 'Erro inesperado',
        },
      };
    }

    clearTimeout(slowTimer);
    abortRef.current = null;

    if (!result.ok || !result.secret) {
      const err = result.error ?? { code: 'unexpected', message: 'Erro desconhecido' };
      const normalized = normalizeSecretError(err, secretName, {
        action: currentMode === 'rotate' ? 'rotate' : 'save',
      });
      setLastError(normalized);
      const toastDescription = normalized.hint
        ? `${normalized.description} ${normalized.hint}`
        : normalized.description;
      toast.error(normalized.title, {
        id: toastId,
        description: toastDescription,
        duration: 7000,
        action: normalized.retryable
          ? {
              label: 'Tentar novamente',
              onClick: () => {
                setMode(currentMode);
                setValue(currentValue);
                setEditing(true);
              },
            }
          : undefined,
      });
      return { ok: false as const, errorDescription: toastDescription, cancelled: false };
    }

    setLastError(null);
    const { secret, was_update, previous_suffix } = result;
    const suffix = normalizeMaskedSuffix(secret.masked_suffix);
    const length = secret.length ?? currentValue.length;

    toast.success(
      currentMode === 'rotate'
        ? 'Rotação concluída'
        : was_update
          ? 'Credencial atualizada'
          : 'Credencial salva',
      {
        id: toastId,
        description:
          currentMode === 'rotate'
            ? `${secretName}: ${previous_suffix} → ${suffix} (${length} chars · registrado no log)`
            : `${secretName} agora termina em ${suffix} (${length} chars)`,
        duration: 5000,
      },
    );

    flashCounter.current += 1;
    setFlash({
      masked_suffix: suffix,
      length,
      action: currentMode,
      was_update: !!was_update,
      was_env_fallback: wasEnvFallback,
      key: flashCounter.current,
    });

    if (currentMode === 'rotate') setRotationRefreshKey((k) => k + 1);
    setValue('');
    setEditing(false);
    setMode('set');
    onSaved?.();
    return { ok: true as const, cancelled: false };
  };

  const nameValidation = useMemo(() => validateSecretName(secretName), [secretName]);
  const validation = useMemo(() => validateSecret(secretName, value), [secretName, value]);
  const suffixGuardOk = value.length === 0 || value.length >= MIN_SUFFIX_LENGTH;

  const canSave =
    !saving && nameValidation.ok && value.length > 0 && suffixGuardOk && validation.ok;

  const saveDisabledReason = saving
    ? null
    : !nameValidation.ok
      ? (nameValidation.message ?? 'Nome não permitido')
      : value.length === 0
        ? 'Cole um valor'
        : !suffixGuardOk
          ? `Mínimo ${MIN_SUFFIX_LENGTH} caracteres`
          : !validation.ok
            ? (validation.message ?? 'Corrija o formato')
            : null;

  const minLen = getMinLength(secretName);
  const storedLooksSuspicious =
    !editing && !!status?.has_value && !!minLen && (status.length ?? 0) < minLen;

  const handleSave = async () => {
    if (!canSave) return;
    if (mode === 'rotate') {
      setRotateConfirmError(null);
      setRotateConfirmOpen(true);
    } else {
      setSaveConfirmError(null);
      setSaveConfirmOpen(true);
    }
  };

  const handleConfirmedSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveConfirmError(null);
    const res = await performSave('set', value);
    setSaving(false);
    if (res.ok) setSaveConfirmOpen(false);
    else if (!res.cancelled) setSaveConfirmError(res.errorDescription);
  };

  const handleConfirmedRotate = async (notes?: string) => {
    if (!value || !validation.ok || !nameValidation.ok) return;
    setSaving(true);
    setRotateConfirmError(null);
    const res = await performSave('rotate', value, notes);
    setSaving(false);
    if (res.ok) setRotateConfirmOpen(false);
    else if (!res.cancelled) setRotateConfirmError(res.errorDescription);
  };

  const startEdit = (m: 'rotate' | 'set') => {
    setMode(m);
    setEditing(true);
  };

  return {
    editing,
    setEditing,
    mode,
    setMode,
    value,
    setValue,
    show,
    setShow,
    saving,
    flash,
    rotationRefreshKey,
    lastError,
    lastNormalization,
    rotateConfirmOpen,
    setRotateConfirmOpen,
    rotateConfirmError,
    saveConfirmOpen,
    setSaveConfirmOpen,
    saveConfirmError,
    detailsOpen,
    setDetailsOpen,
    testDetailsState,
    handlePaste,
    handleBlur,
    handleSave,
    handleConfirmedSave,
    handleConfirmedRotate,
    startEdit,
    canSave,
    saveDisabledReason,
    storedLooksSuspicious,
    detailsAvailable: !!testerMap,
  };
}
