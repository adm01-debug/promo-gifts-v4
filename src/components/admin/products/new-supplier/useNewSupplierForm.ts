import { useState, useRef, useCallback, useEffect } from 'react';
import { searchCrm } from '@/lib/crm-db';
import { applyPixMask, validatePixKey } from '@/utils/pixMask';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { validateCnpj, maskCep } from '@/utils/masks';
import { fetchAddressByCep } from '@/utils/viacep';
import { fetchCnpjData } from '@/utils/cnpj-lookup';
import { logger } from '@/lib/logger';
import {
  type SupplierContact,
  type PixKey,
  createEmptyContact,
  createEmptyPixKey,
  ORGANIZATION_ID,
} from './types';

/**
 * Fixes applied (audit 26/05/2026):
 *   BUG-01: buildNotesField() no longer serializes phone/fiscal in notes — those use dedicated columns
 *   BUG-06 + BUG-22: handleCreate payload includes inscricao_estadual, tax_regime, state_uf, phone2
 *   BUG-14: removed deprecated minimum_order_value from payload
 *   BUG-19: instagram, facebook, linkedin, youtube, tiktok included in payload
 *   BUG-24: carrier search timeout cleanup on unmount
 */
export function useNewSupplierForm(onCreated: (id: string) => void) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Basic
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [cnpjError, setCnpjError] = useState('');
  const [fetchingCnpj, setFetchingCnpj] = useState(false);
  const [website, setWebsite] = useState('');
  const [foneFixo1, setFoneFixo1] = useState('');
  const [foneFixo2, setFoneFixo2] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [regimeTributario, setRegimeTributario] = useState('');
  const [estadoFaturamento, setEstadoFaturamento] = useState('');
  const [transportadoraPadrao, setTransportadoraPadrao] = useState('');
  const [transportadoraId, setTransportadoraId] = useState('');
  const [carrierSearch, setCarrierSearch] = useState('');
  const [carrierResults, setCarrierResults] = useState<
    Array<{ id: string; nome_fantasia: string; razao_social: string }>
  >([]);
  const [searchingCarriers, setSearchingCarriers] = useState(false);
  const [showCarrierDropdown, setShowCarrierDropdown] = useState(false);
  const carrierSearchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // BUG-24 FIX: cleanup carrier search timeout on unmount
  useEffect(() => {
    const timeoutRef = carrierSearchTimeout;
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Social
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [youtube, setYoutube] = useState('');
  const [tiktok, setTiktok] = useState('');

  // Contacts
  const [contacts, setContacts] = useState<SupplierContact[]>([createEmptyContact()]);

  // Address
  const [tipoLogradouro, setTipoLogradouro] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');
  const [pais, setPais] = useState('Brasil');
  const [pontoReferencia, setPontoReferencia] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [horarioFuncionamento, setHorarioFuncionamento] = useState('');
  const [instrucoesEntrega, setInstrucoesEntrega] = useState('');

  // Commercial
  const [defaultMarkup, setDefaultMarkup] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [deliveryTimeDays, setDeliveryTimeDays] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [shippingTerms, setShippingTerms] = useState('');
  const [priority, setPriority] = useState('50');
  const [notes, setNotes] = useState('');

  // Financial
  const [formaPagamento, setFormaPagamento] = useState<string[]>([]);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([createEmptyPixKey(true)]);

  // Classification
  const [isProductSupplier, setIsProductSupplier] = useState(true);
  const [isEngravingSupplier, setIsEngravingSupplier] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const searchCarriers = useCallback(async (term: string) => {
    if (term.length < 2) {
      setCarrierResults([]);
      setShowCarrierDropdown(false);
      return;
    }
    setSearchingCarriers(true);
    try {
      const companies = await searchCrm<{
        id: string;
        nome_fantasia: string;
        razao_social: string;
      }>('companies', 'razao_social', term, {
        select: 'id,nome_fantasia,razao_social',
        limit: 15,
      }).catch(() => []);
      const list = (companies || []).filter((c) => c.nome_fantasia || c.razao_social);
      setCarrierResults(list);
      setShowCarrierDropdown(list.length > 0);
    } catch {
      setCarrierResults([]);
    } finally {
      setSearchingCarriers(false);
    }
  }, []);

  const hasPixDuplicate = (keys: PixKey[]): string | null => {
    const filled = keys.filter((k) => k.chave.trim());
    const seen = new Set<string>();
    for (const k of filled) {
      const norm = k.chave.trim().toLowerCase();
      if (seen.has(norm)) return norm;
      seen.add(norm);
    }
    return null;
  };

  const updatePixKey = (id: string, field: keyof Omit<PixKey, 'id'>, value: string | boolean) => {
    setPixKeys((prev) => {
      const updated = prev.map((k) => {
        if (k.id !== id)
          return field === 'principal' && value === true ? { ...k, principal: false } : k;
        const next = { ...k, [field]: value };
        if (field === 'tipo' && typeof value === 'string' && k.chave.trim()) {
          next.chave = applyPixMask(k.chave, value);
        }
        return next;
      });
      if (field === 'chave' && typeof value === 'string' && value.trim()) {
        const dup = hasPixDuplicate(updated);
        if (dup) toast.warning(`Chave PIX "${dup}" já existe neste fornecedor`);
      }
      return updated;
    });
  };

  const addPixKey = () => setPixKeys((prev) => [...prev, createEmptyPixKey(prev.length === 0)]);
  const removePixKey = (id: string) =>
    setPixKeys((prev) => {
      const next = prev.filter((k) => k.id !== id);
      if (next.length > 0 && !next.some((k) => k.principal)) next[0].principal = true;
      return next.length > 0 ? next : [createEmptyPixKey(true)];
    });

  const updateContact = (id: string, field: keyof SupplierContact, value: string) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };
  const addContact = () => setContacts((prev) => [...prev, createEmptyContact()]);
  const removeContact = (id: string) =>
    setContacts((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));

  const resetForm = () => {
    setName('');
    setCode('');
    setTradingName('');
    setCnpj('');
    setContacts([createEmptyContact()]);
    setWebsite('');
    setFoneFixo1('');
    setFoneFixo2('');
    setInstagram('');
    setFacebook('');
    setLinkedin('');
    setYoutube('');
    setTiktok('');
    setTipoLogradouro('');
    setLogradouro('');
    setNumero('');
    setComplemento('');
    setBairro('');
    setCidade('');
    setEstado('');
    setCep('');
    setPais('Brasil');
    setPontoReferencia('');
    setGoogleMapsUrl('');
    setGooglePlaceId('');
    setLatitude('');
    setLongitude('');
    setHorarioFuncionamento('');
    setInstrucoesEntrega('');
    setDefaultMarkup('');
    setMinOrderValue('');
    setDeliveryTimeDays('');
    setPaymentTerms('');
    setShippingTerms('');
    setPriority('50');
    setNotes('');
    setFormaPagamento([]);
    setPixKeys([createEmptyPixKey(true)]);
    setIsProductSupplier(true);
    setIsEngravingSupplier(false);
    setIsActive(true);
    setInscricaoEstadual('');
    setRegimeTributario('');
    setEstadoFaturamento('');
    setTransportadoraPadrao('');
    setTransportadoraId('');
    setCarrierSearch('');
    setCarrierResults([]);
    setShowCarrierDropdown(false);
    setLogoUrl('');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Máximo 2MB');
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const filePath = `suppliers/new-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('supplier-logos')
        .upload(filePath, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('supplier-logos').getPublicUrl(filePath);
      setLogoUrl(urlData.publicUrl);
      toast.success('Logo enviada');
    } catch (err: unknown) {
      logger.error('Failed to upload supplier logo', err);
      toast.error('Erro ao enviar logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleCnpjLookup = async () => {
    const digits = cnpj.replace(/\D/g, '');
    if (!validateCnpj(digits)) {
      setCnpjError('CNPJ inválido');
      return;
    }
    setFetchingCnpj(true);
    try {
      const data = await fetchCnpjData(digits);
      if (data) {
        if (data.razao_social && !name.trim()) setName(data.razao_social);
        if (data.nome_fantasia && !tradingName.trim()) setTradingName(data.nome_fantasia);
        if (data.logradouro && !logradouro.trim()) setLogradouro(data.logradouro);
        if (data.numero && !numero.trim()) setNumero(data.numero);
        if (data.complemento && !complemento.trim()) setComplemento(data.complemento);
        if (data.bairro && !bairro.trim()) setBairro(data.bairro);
        if (data.cidade && !cidade.trim()) setCidade(data.cidade);
        if (data.estado && !estado.trim()) setEstado(data.estado);
        if (data.cep && !cep.trim()) setCep(maskCep(data.cep));
        if (data.email && !contacts[0]?.email?.trim())
          updateContact(contacts[0].id, 'email', data.email);
        if (data.telefone && !foneFixo1.trim()) setFoneFixo1(data.telefone);
        toast.success('Dados preenchidos via CNPJ!');
      }
    } catch (err: unknown) {
      logger.error('Failed to lookup supplier CNPJ', err);
      toast.error('Erro ao consultar CNPJ');
    } finally {
      setFetchingCnpj(false);
    }
  };

  const handleCepLookup = async (masked: string) => {
    setCep(masked);
    if (masked.replace(/\D/g, '').length === 8) {
      const addr = await fetchAddressByCep(masked);
      if (addr) {
        if (addr.logradouro) setLogradouro(addr.logradouro);
        if (addr.bairro) setBairro(addr.bairro);
        if (addr.localidade) setCidade(addr.localidade);
        if (addr.uf) setEstado(addr.uf);
        toast.success('Endereço preenchido via CEP');
      }
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Nome do fornecedor é obrigatório');
      return;
    }
    const dupPix = hasPixDuplicate(pixKeys);
    if (dupPix) {
      toast.error(`Chave PIX duplicada: "${dupPix}". Remova a duplicata antes de salvar.`);
      return;
    }
    const invalidPix = pixKeys
      .filter((k) => k.chave.trim())
      .find((k) => validatePixKey(k.chave, k.tipo));
    if (invalidPix) {
      toast.error(validatePixKey(invalidPix.chave, invalidPix.tipo) ?? 'Chave PIX inválida');
      return;
    }
    const cnpjDigits = cnpj.replace(/\D/g, '');
    if (cnpjDigits.length > 0 && !validateCnpj(cnpjDigits)) {
      setCnpjError('CNPJ inválido');
      toast.error('CNPJ informado é inválido');
      return;
    }
    setCnpjError('');
    setSaving(true);

    // Duplicate checks
    if (cnpjDigits.length === 14) {
      try {
        const { untypedFrom } = await import('@/lib/supabase-untyped');
        const { data: existingRecords } = await untypedFrom<{
          id: string;
          name: string;
          cnpj: string;
        }>('suppliers')
          .select('id,name,cnpj')
          .eq('cnpj', cnpj.trim())
          .limit(1);
        if (existingRecords && existingRecords.length > 0) {
          toast.error(`Já existe um fornecedor com este CNPJ: "${existingRecords[0].name}".`);
          setSaving(false);
          return;
        }
      } catch (err) {
        logger.warn('[NewSupplierDialog] Falha ao verificar duplicidade de CNPJ:', err);
      }
    }
    try {
      const { dbInvoke: invokeDbName } = await import('@/lib/db/postgrest');
      const existingByName = await invokeDbName<{ id: string; name: string }>({
        table: 'suppliers',
        operation: 'select',
        select: 'id,name',
        filters: { name: name.trim() },
        limit: 1,
      });
      if (existingByName.records && existingByName.records.length > 0) {
        toast.error(`Já existe um fornecedor com este nome: "${existingByName.records[0].name}".`);
        setSaving(false);
        return;
      }
    } catch (err) {
      logger.warn('[NewSupplierDialog] Falha ao verificar duplicidade de nome:', err);
    }
    if (tradingName.trim()) {
      try {
        const { dbInvoke: invokeDbTN } = await import('@/lib/db/postgrest');
        const existingByTN = await invokeDbTN<{ id: string; name: string; trading_name: string }>({
          table: 'suppliers',
          operation: 'select',
          select: 'id,name,trading_name',
          filters: { trading_name: tradingName.trim() },
          limit: 1,
        });
        if (existingByTN.records && existingByTN.records.length > 0) {
          toast.error(
            `Já existe um fornecedor com este Nome Fantasia: "${existingByTN.records[0].trading_name || existingByTN.records[0].name}".`,
          );
          setSaving(false);
          return;
        }
      } catch (err) {
        logger.warn('[NewSupplierDialog] Falha ao verificar duplicidade de nome fantasia:', err);
      }
    }

    try {
      const { dbInvokeSingle } = await import('@/lib/db/postgrest');
      const now = new Date().toISOString();
      const generatedCode =
        code.trim() ||
        name
          .trim()
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^A-Z0-9_]/g, '')
          .slice(0, 20);
      const addressParts =
        [
          tipoLogradouro && logradouro ? `${tipoLogradouro} ${logradouro}` : logradouro,
          numero,
          complemento,
          bairro,
          cidade,
          estado,
          cep ? `CEP ${cep}` : null,
        ]
          .filter(Boolean)
          .join(', ') || null;

      // BUG-01 FIX: buildNotesField no longer serializes phone/fiscal data — those use dedicated columns
      const notesValue = buildNotesField(
        notes,
        contacts,
        formaPagamento,
        pixKeys,
        transportadoraPadrao,
        transportadoraId,
      );

      const data: Record<string, unknown> = {
        name: name.trim(),
        code: generatedCode,
        trading_name: tradingName.trim() || null,
        cnpj: cnpj.trim() || null,
        active: isActive,
        organization_id: ORGANIZATION_ID,
        contact_name: contacts[0]?.name?.trim() || null,
        contact_person: contacts[0]?.role?.trim() || null,
        email: contacts[0]?.email?.trim() || null,
        phone: foneFixo1.trim() || contacts[0]?.phone?.trim() || null,
        // BUG-06 FIX: persist phone2 to dedicated column
        phone2: foneFixo2.trim() || null,
        address: addressParts,
        website: website.trim() || null,
        default_markup_percent: defaultMarkup ? parseFloat(defaultMarkup) : null,
        min_order_value: minOrderValue ? parseFloat(minOrderValue) : null,
        // BUG-14 FIX: removed deprecated minimum_order_value
        delivery_time_days: deliveryTimeDays ? parseInt(deliveryTimeDays, 10) : null,
        payment_terms: paymentTerms.trim() || null,
        shipping_terms: shippingTerms.trim() || null,
        priority: priority ? parseInt(priority, 10) : 50,
        notes: notesValue,
        is_product_supplier: isProductSupplier,
        is_engraving_supplier: isEngravingSupplier,
        // BUG-22 FIX: persist fiscal fields to dedicated columns
        inscricao_estadual: inscricaoEstadual.trim() || null,
        tax_regime: regimeTributario || null,
        state_uf: estadoFaturamento || null,
        // NOTE: the suppliers table has NO instagram/facebook/linkedin/youtube/tiktok
        // columns, so sending them made PostgREST reject the whole insert (PGRST204).
        // They are omitted here until dedicated columns exist; the UI inputs are kept.
        created_at: now,
        updated_at: now,
      };
      if (logoUrl) data.logo_url = logoUrl;

      const result = await dbInvokeSingle<{ id: string }>({
        table: 'suppliers',
        operation: 'insert',
        data,
      });
      if (result?.id) {
        // BUG-20 FIX: rename the logo from temp path to the canonical {id}.{ext} path
        if (logoUrl) {
          try {
            const tempPath = new URL(logoUrl).pathname.split('/supplier-logos/').pop();
            if (tempPath && tempPath.startsWith('suppliers/new-')) {
              const ext = tempPath.split('.').pop() || 'png';
              const canonicalPath = `suppliers/${result.id}.${ext}`;
              const { error: moveError } = await supabase.storage
                .from('supplier-logos')
                .move(tempPath, canonicalPath);
              // Only point logo_url at the canonical path if the move actually succeeded;
              // otherwise keep the (valid) temp URL.
              if (moveError) throw moveError;
              const { data: urlData } = supabase.storage
                .from('supplier-logos')
                .getPublicUrl(canonicalPath);
              try {
                await dbInvokeSingle({
                  table: 'suppliers',
                  operation: 'update',
                  filters: { id: result.id },
                  data: { logo_url: urlData.publicUrl },
                });
              } catch (updateErr) {
                // File was moved but the DB still points at the temp path —
                // roll the move back so the stored logo_url stays valid.
                await supabase.storage
                  .from('supplier-logos')
                  .move(canonicalPath, tempPath)
                  .catch(() => undefined);
                throw updateErr;
              }
            }
          } catch (logoErr) {
            // Logo rename is best-effort; supplier was created successfully.
            logger.warn('Supplier logo rename failed; keeping temp logo URL', logoErr);
          }
        }
        onCreated(result.id);
        toast.success(`Fornecedor "${name.trim()}" criado com sucesso`);
        setOpen(false);
        resetForm();
      }
    } catch (err: unknown) {
      logger.error('Failed to create supplier', err);
      toast.error('Erro ao criar fornecedor');
    } finally {
      setSaving(false);
    }
  };

  return {
    open,
    setOpen,
    saving,
    logoUrl,
    setLogoUrl,
    uploadingLogo,
    logoInputRef,
    name,
    setName,
    code,
    setCode,
    tradingName,
    setTradingName,
    cnpj,
    setCnpj,
    cnpjError,
    setCnpjError,
    fetchingCnpj,
    website,
    setWebsite,
    foneFixo1,
    setFoneFixo1,
    foneFixo2,
    setFoneFixo2,
    inscricaoEstadual,
    setInscricaoEstadual,
    regimeTributario,
    setRegimeTributario,
    estadoFaturamento,
    setEstadoFaturamento,
    transportadoraPadrao,
    setTransportadoraPadrao,
    transportadoraId,
    setTransportadoraId,
    carrierSearch,
    setCarrierSearch,
    carrierResults,
    searchingCarriers,
    showCarrierDropdown,
    setShowCarrierDropdown,
    carrierSearchTimeout,
    instagram,
    setInstagram,
    facebook,
    setFacebook,
    linkedin,
    setLinkedin,
    youtube,
    setYoutube,
    tiktok,
    setTiktok,
    contacts,
    updateContact,
    addContact,
    removeContact,
    tipoLogradouro,
    setTipoLogradouro,
    logradouro,
    setLogradouro,
    numero,
    setNumero,
    complemento,
    setComplemento,
    bairro,
    setBairro,
    cidade,
    setCidade,
    estado,
    setEstado,
    cep,
    pais,
    setPais,
    pontoReferencia,
    setPontoReferencia,
    googleMapsUrl,
    setGoogleMapsUrl,
    googlePlaceId,
    setGooglePlaceId,
    latitude,
    setLatitude,
    longitude,
    setLongitude,
    horarioFuncionamento,
    setHorarioFuncionamento,
    instrucoesEntrega,
    setInstrucoesEntrega,
    defaultMarkup,
    setDefaultMarkup,
    minOrderValue,
    setMinOrderValue,
    deliveryTimeDays,
    setDeliveryTimeDays,
    paymentTerms,
    setPaymentTerms,
    shippingTerms,
    setShippingTerms,
    priority,
    setPriority,
    notes,
    setNotes,
    formaPagamento,
    setFormaPagamento,
    pixKeys,
    updatePixKey,
    addPixKey,
    removePixKey,
    isProductSupplier,
    setIsProductSupplier,
    isEngravingSupplier,
    setIsEngravingSupplier,
    isActive,
    setIsActive,
    searchCarriers,
    handleLogoUpload,
    handleCnpjLookup,
    handleCepLookup,
    handleCreate,
  };
}

/**
 * Tipo do objeto retornado por `useNewSupplierForm`, derivado diretamente do
 * hook para permanecer sempre em sincronia.
 */
export type NewSupplierForm = ReturnType<typeof useNewSupplierForm>;

/**
 * BUG-01 FIX: buildNotesField no longer serializes phone/fiscal/social data.
 * Those fields now use dedicated DB columns. Only free-text notes, PIX,
 * contact extras, and transportadora remain here.
 */
function buildNotesField(
  notes: string,
  contacts: SupplierContact[],
  formaPagamento: string[],
  pixKeys: PixKey[],
  transportadoraPadrao: string,
  transportadoraId: string,
): string | null {
  const parts: string[] = [];
  if (notes.trim()) parts.push(notes.trim());
  const c0 = contacts[0];
  if (c0?.signature?.trim() || c0?.nickname?.trim()) {
    parts.push(
      `[Contato 1 extras: Assinatura: ${c0.signature?.trim() || '-'}, Apelido: ${c0.nickname?.trim() || '-'}]`,
    );
  }
  const extraContacts = contacts.slice(1).filter((c) => c.name.trim());
  if (extraContacts.length > 0) {
    parts.push(
      `[Contatos adicionais: ${extraContacts.map((c) => `${c.role || 'N/A'} - ${c.name} (${c.email || '-'}, ${c.phone || '-'}, Assinatura: ${c.signature?.trim() || '-'}, Apelido: ${c.nickname?.trim() || '-'})`).join('; ')}]`,
    );
  }
  if (formaPagamento.length > 0 || pixKeys.some((k) => k.chave.trim())) {
    const now_date = new Date().toISOString().split('T')[0];
    const pixData = pixKeys
      .filter((k) => k.chave.trim())
      .map((k) => `${k.tipo || '-'}|${k.chave}|${k.favorecido || '-'}|${k.principal ? '1' : '0'}`)
      .join(';;');
    parts.push(
      `[Financeiro: Forma: ${formaPagamento.join(',') || '-'}, PIX: ${pixData || '-'}, PIX Atualizado: ${now_date}]`,
    );
  }
  if (transportadoraPadrao.trim())
    parts.push(`[Transportadora: ${transportadoraPadrao.trim()}, ID: ${transportadoraId || '-'}]`);
  // NOTE: phone, phone2, inscricao_estadual, tax_regime, state_uf, social media
  // are NO LONGER serialized here — they use dedicated columns.
  return parts.join('\n') || null;
}
