import { dbInvoke, dbInvokeSingle, dbInvokeDelete } from '@/lib/db/postgrest';
import { untypedFrom } from '@/lib/supabase-untyped';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { applyPixMask, validatePixKey } from '@/utils/pixMask';
import { searchCrm } from '@/lib/crm-db';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validateCnpj, maskCep } from '@/utils/masks';
import { fetchAddressByCep } from '@/utils/viacep';
import { fetchCnpjData } from '@/utils/cnpj-lookup';
import { logger } from '@/lib/logger';
import {
  type Supplier,
  type SupplierContact,
  type PixKey,
  EMPTY_SUPPLIER,
  ORGANIZATION_ID,
  createEmptyContact,
  createEmptyPixKey,
} from './types';

/**
 * Fixes applied (audit 26/05/2026):
 *   BUG-04: handleDelete uses state instead of confirm() — exposes deleteConfirmSupplier/confirmDelete/cancelDelete
 *   BUG-07 + BUG-30: social media fields (instagram, facebook, linkedin, youtube, tiktok) added to payload & handleEdit
 *   BUG-12: fetchSuppliers paginates up to 2000 records (200/page loop)
 *   BUG-13: removed deprecated minimum_order_value from payload
 *   BUG-16: JSON.parse of contacts handles both string and already-parsed object
 *   BUG-17: handleCnpjLookup only fills empty fields (never overwrites existing data)
 *   BUG-21: name/tradingName dup checks use __ilike_ for case-insensitive comparison
 *   BUG-23: carrier search timeout cleanup on unmount
 *   BUG-25: removed dead code for address_details/social_details (fields don't exist in DB)
 */
export function useSuppliersManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'product' | 'engraving'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  // BUG-04 FIX: state-based delete confirmation — no more confirm() blocking dialog
  const [deleteConfirmSupplier, setDeleteConfirmSupplier] = useState<Supplier | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [fetchingCnpj, setFetchingCnpj] = useState(false);
  const [contacts, setContacts] = useState<SupplierContact[]>([createEmptyContact()]);
  const [formaPagamento, setFormaPagamento] = useState<string[]>([]);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([createEmptyPixKey(true)]);
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
  const logoInputRef = useRef<HTMLInputElement>(null);

  // BUG-23 FIX: cleanup carrier search timeout on unmount
  useEffect(() => {
    const timeoutRef = carrierSearchTimeout;
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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
      setShowCarrierDropdown(true);
    } catch {
      setCarrierResults([]);
      setShowCarrierDropdown(false);
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

  // BUG-12 FIX: paginate suppliers up to 2000 records (200/page)
  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const all: Supplier[] = [];
      const pageSize = 200;
      const maxPages = 10; // cap at 2000 to prevent runaway
      for (let page = 0; page < maxPages; page++) {
        const { data: records, error } = await untypedFrom<Supplier>('suppliers')
          .select(
            'id, name, code, cnpj, contact_name, email, phone, address, active, created_at, website, contact_person, payment_terms, delivery_time_days, minimum_order_value, notes, updated_at, organization_id, trading_name, api_type, api_base_url, min_order_value, shipping_terms, default_markup_percent, is_product_supplier, is_engraving_supplier, sync_enabled, sync_interval_minutes, last_full_sync_at, last_sync_status, last_sync_error, api_rate_limit_per_hour, priority, api_requests_current_hour, api_requests_reset_at, state_uf, tax_regime, inscricao_estadual, phone2, logo_url',
          )
          .order('name', { ascending: true })
          .range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) throw error;
        // O parser do select tipa a linha só com as 40 colunas listadas;
        // os campos sociais/endereço do Supplier não são colunas do DB
        // (preenchidos em runtime a partir dos JSONs address/contacts).
        all.push(...(records as unknown as Supplier[]));
        if (records.length < pageSize) break; // last page
      }
      setSuppliers(all);
    } catch {
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const filtered = useMemo(() => {
    let result = suppliers;
    if (filterType === 'product') result = result.filter((s) => s.is_product_supplier);
    else if (filterType === 'engraving') result = result.filter((s) => s.is_engraving_supplier);
    if (filterStatus === 'active') result = result.filter((s) => s.active);
    else if (filterStatus === 'inactive') result = result.filter((s) => !s.active);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.trading_name?.toLowerCase().includes(q) ||
          s.cnpj?.includes(q) ||
          s.email?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [suppliers, search, filterType, filterStatus]);

  const handleNew = () => {
    setEditingSupplier({ ...EMPTY_SUPPLIER });
    setContacts([createEmptyContact()]);
    setIsNew(true);
  };

  const handleEdit = (supplier: Supplier) => {
    // BUG-25 FIX: removed dead code blocks for address_details / social_details
    // (those fields do not exist in the real DB schema)
    const s: Partial<Supplier> = { ...supplier };
    setEditingSupplier(s);

    // BUG-16 FIX: contacts may come from DB as parsed object (JSONB) or as JSON string
    try {
      const raw = supplier.contacts;
      const parsed: unknown =
        raw === null || raw === undefined ? null : typeof raw === 'string' ? JSON.parse(raw) : raw; // already parsed by PostgREST JSONB
      if (Array.isArray(parsed) && parsed.length > 0) {
        setContacts(
          parsed.map(
            (c: Record<string, unknown>) =>
              ({ ...c, id: (c.id as string) || crypto.randomUUID() }) as SupplierContact,
          ),
        );
      } else {
        const legacy = createEmptyContact();
        if (supplier.contact_name) legacy.name = supplier.contact_name;
        if (supplier.contact_person) legacy.role = supplier.contact_person;
        if (supplier.email) legacy.email = supplier.email;
        if (supplier.phone) legacy.phone = supplier.phone;
        setContacts([legacy]);
      }
    } catch {
      setContacts([createEmptyContact()]);
    }

    // Parse financial data (still in notes for payment/pix)
    const notesStr = supplier.notes || '';
    const finMatchNew = notesStr.match(
      /\[Financeiro: Forma: (.*?), PIX: (.*?), PIX Atualizado: (.*?)\]/,
    );
    const finMatchLegacy = notesStr.match(
      /\[Financeiro: Forma: (.*?), PIX Tipo: (.*?), PIX Número: (.*?), PIX Favorecido: (.*?), PIX Atualizado: (.*?)\]/,
    );
    if (finMatchNew) {
      setFormaPagamento(finMatchNew[1] !== '-' ? finMatchNew[1].split(',').filter(Boolean) : []);
      const pixData = finMatchNew[2];
      if (pixData && pixData !== '-') {
        const keys = pixData.split(';;').map((entry) => {
          const [tipo, chave, favorecido, principal] = entry.split('|');
          return {
            id: crypto.randomUUID(),
            tipo: tipo === '-' ? '' : tipo,
            chave,
            favorecido: favorecido === '-' ? '' : favorecido,
            principal: principal === '1',
          };
        });
        if (keys.length > 0 && !keys.some((k) => k.principal)) keys[0].principal = true;
        setPixKeys(keys.length > 0 ? keys : [createEmptyPixKey(true)]);
      } else {
        setPixKeys([createEmptyPixKey(true)]);
      }
    } else if (finMatchLegacy) {
      setFormaPagamento(
        finMatchLegacy[1] !== '-' ? finMatchLegacy[1].split(',').filter(Boolean) : [],
      );
      const chave = finMatchLegacy[3] !== '-' ? finMatchLegacy[3] : '';
      if (chave) {
        setPixKeys([
          {
            id: crypto.randomUUID(),
            tipo: finMatchLegacy[2] !== '-' ? finMatchLegacy[2] : '',
            chave,
            favorecido: finMatchLegacy[4] !== '-' ? finMatchLegacy[4] : '',
            principal: true,
          },
        ]);
      } else {
        setPixKeys([createEmptyPixKey(true)]);
      }
    } else {
      setFormaPagamento([]);
      setPixKeys([createEmptyPixKey(true)]);
    }

    // ── Read dedicated columns ──
    setFoneFixo1(supplier.phone || '');
    setFoneFixo2(supplier.phone2 || '');
    setInscricaoEstadual(supplier.inscricao_estadual || '');
    setRegimeTributario(supplier.tax_regime || '');
    setEstadoFaturamento(supplier.state_uf || '');

    // ── Backward compat: migrate legacy notes data if dedicated columns are empty ──
    if (!supplier.inscricao_estadual && !supplier.tax_regime && !supplier.state_uf) {
      const fiscalMatch = notesStr.match(
        /\[Fiscal: IE: (.*?), Regime: (.*?), UF Faturamento: (.*?)\]/,
      );
      if (fiscalMatch) {
        setInscricaoEstadual(fiscalMatch[1] !== '-' ? fiscalMatch[1] : '');
        setRegimeTributario(fiscalMatch[2] !== '-' ? fiscalMatch[2] : '');
        setEstadoFaturamento(fiscalMatch[3] !== '-' ? fiscalMatch[3] : '');
      }
    }
    if (!supplier.phone2) {
      const foneMatch = notesStr.match(/\[Fones Fixos: 01: (.*?), 02: (.*?)\]/);
      if (foneMatch) {
        setFoneFixo2(foneMatch[2] !== '-' ? foneMatch[2] : '');
      }
    }

    const carrierMatch = notesStr.match(/\[Transportadora: (.*?), ID: (.*?)\]/);
    if (carrierMatch) {
      setTransportadoraPadrao(carrierMatch[1] !== '-' ? carrierMatch[1] : '');
      setTransportadoraId(carrierMatch[2] !== '-' ? carrierMatch[2] : '');
    } else {
      setTransportadoraPadrao('');
      setTransportadoraId('');
    }
    setCarrierSearch('');
    setCarrierResults([]);
    setShowCarrierDropdown(false);

    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editingSupplier?.name?.trim()) {
      toast.error('Nome é obrigatório');
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
    const cnpjRaw = editingSupplier.cnpj?.replace(/\D/g, '') ?? '';
    if (cnpjRaw.length > 0 && !validateCnpj(cnpjRaw)) {
      toast.error('CNPJ informado é inválido');
      return;
    }
    setSaving(true);

    // Duplicate checks
    if (cnpjRaw.length === 14 && editingSupplier.cnpj) {
      try {
        const { data: existingRecords } = await untypedFrom<{
          id: string;
          name: string;
          cnpj: string;
        }>('suppliers')
          .select('id,name,cnpj')
          .eq('cnpj', editingSupplier.cnpj.trim())
          .limit(5);
        const duplicate = existingRecords?.find((r) => r.id !== editingSupplier.id);
        if (duplicate) {
          toast.error(`Já existe outro fornecedor com este CNPJ: "${duplicate.name}".`);
          setSaving(false);
          return;
        }
      } catch (err) {
        logger.warn('[SuppliersManager] CNPJ dup check failed:', err);
      }
    }
    // BUG-21 FIX: case-insensitive name dup check via __ilike_ prefix
    if (editingSupplier.name?.trim()) {
      try {
        const existingByName = await dbInvoke<{ id: string; name: string }>({
          table: 'suppliers',
          operation: 'select',
          select: 'id,name',
          filters: { __ilike_name: editingSupplier.name.trim() },
          limit: 5,
        });
        const dupByName = existingByName.records?.find((r) => r.id !== editingSupplier.id);
        if (dupByName) {
          toast.error(`Já existe outro fornecedor com este nome: "${dupByName.name}".`);
          setSaving(false);
          return;
        }
      } catch (err) {
        logger.warn('[SuppliersManager] Name dup check failed:', err);
      }
    }
    if (editingSupplier.trading_name?.trim()) {
      try {
        const existingByTN = await dbInvoke<{
          id: string;
          name: string;
          trading_name: string;
        }>({
          table: 'suppliers',
          operation: 'select',
          select: 'id,name,trading_name',
          // BUG-21 FIX: case-insensitive trading_name dup check
          filters: { __ilike_trading_name: editingSupplier.trading_name.trim() },
          limit: 5,
        });
        const dupByTN = existingByTN.records?.find((r) => r.id !== editingSupplier.id);
        if (dupByTN) {
          toast.error(
            `Já existe outro fornecedor com este Nome Fantasia: "${dupByTN.trading_name || dupByTN.name}".`,
          );
          setSaving(false);
          return;
        }
      } catch (err) {
        logger.warn('[SuppliersManager] Trading name dup check failed:', err);
      }
    }

    try {
      const now = new Date().toISOString();
      const es = editingSupplier;
      const addressParts =
        [
          es.tipo_logradouro && es.logradouro
            ? `${es.tipo_logradouro} ${es.logradouro}`
            : es.logradouro,
          es.numero,
          es.complemento,
          es.bairro,
          es.cidade,
          es.estado,
          es.cep ? `CEP ${es.cep}` : null,
        ]
          .filter(Boolean)
          .join(', ') ||
        es.address?.trim() ||
        null;

      const payload: Record<string, unknown> = {
        name: (es.name ?? '').trim(),
        code:
          es.code?.trim() ||
          (es.name ?? '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '_')
            .replace(/[^A-Z0-9_]/g, '')
            .slice(0, 20),
        trading_name: es.trading_name?.trim() || null,
        cnpj: es.cnpj?.trim() || null,
        active: es.active ?? true,
        contact_name: contacts[0]?.name?.trim() || null,
        contact_person: contacts[0]?.role?.trim() || null,
        email: contacts[0]?.email?.trim() || null,
        phone: foneFixo1.trim() || contacts[0]?.phone?.trim() || null,
        phone2: foneFixo2.trim() || null,
        address: addressParts,
        website: es.website?.trim() || null,
        default_markup_percent: es.default_markup_percent ?? null,
        min_order_value: es.min_order_value ?? null,
        // BUG-13 FIX: removed deprecated minimum_order_value column
        delivery_time_days: es.delivery_time_days ?? null,
        payment_terms: es.payment_terms?.trim() || null,
        shipping_terms: es.shipping_terms?.trim() || null,
        priority: es.priority ?? 50,
        inscricao_estadual: inscricaoEstadual.trim() || null,
        tax_regime: regimeTributario || null,
        state_uf: estadoFaturamento || null,
        // BUG-07 + BUG-30 FIX: persist social media fields to dedicated columns
        instagram: es.instagram?.trim() || null,
        facebook: es.facebook?.trim() || null,
        linkedin: es.linkedin?.trim() || null,
        youtube: es.youtube?.trim() || null,
        tiktok: es.tiktok?.trim() || null,
        notes: buildNotesPayload(
          es,
          contacts,
          formaPagamento,
          pixKeys,
          transportadoraPadrao,
          transportadoraId,
        ),
        is_product_supplier: es.is_product_supplier ?? true,
        is_engraving_supplier: es.is_engraving_supplier ?? false,
        updated_at: now,
      };

      if (editingSupplier.logo_url) payload.logo_url = editingSupplier.logo_url;
      else if (!isNew && editingSupplier.logo_url === null) {
        payload.logo_url = null;
      }

      if (isNew) {
        payload.organization_id = ORGANIZATION_ID;
        payload.created_at = now;
        await dbInvokeSingle({ table: 'suppliers', operation: 'insert', data: payload });
        toast.success(`Fornecedor "${editingSupplier.name}" criado`);
      } else {
        await dbInvokeSingle({
          table: 'suppliers',
          operation: 'update',
          id: editingSupplier.id,
          data: payload,
        });
        toast.success(`Fornecedor "${editingSupplier.name}" atualizado`);
      }
      setEditingSupplier(null);
      fetchSuppliers();
    } catch (err: unknown) {
      toast.error('Erro ao salvar fornecedor');
    } finally {
      setSaving(false);
    }
  };

  // BUG-04 FIX: requestDelete sets confirmation state; actual delete in confirmDelete
  const handleDelete = (supplier: Supplier) => {
    setDeleteConfirmSupplier(supplier);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmSupplier) return;
    const supplier = deleteConfirmSupplier;
    setDeleteConfirmSupplier(null);
    setDeleting(supplier.id);
    try {
      await dbInvokeDelete({ table: 'suppliers', id: supplier.id });
      toast.success(`Fornecedor "${supplier.name}" excluído`);
      fetchSuppliers();
    } catch (err: unknown) {
      toast.error('Erro ao excluir fornecedor');
    } finally {
      setDeleting(null);
    }
  };

  const cancelDelete = () => setDeleteConfirmSupplier(null);

  const updateField = (field: string, value: unknown) => {
    setEditingSupplier((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 2MB');
      return;
    }
    setUploadingLogo(true);
    try {
      const supplierId = editingSupplier?.id || `new-${Date.now()}`;
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const filePath = `suppliers/${supplierId}.${ext}`;
      const { error } = await supabase.storage
        .from('supplier-logos')
        .upload(filePath, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('supplier-logos').getPublicUrl(filePath);
      updateField('logo_url', urlData.publicUrl);
      toast.success('Logo enviada com sucesso');
    } catch (err: unknown) {
      toast.error('Erro ao enviar logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  // BUG-17 FIX: only fill fields that are currently empty — never overwrite existing data
  const handleCnpjLookup = async () => {
    const digits = editingSupplier?.cnpj?.replace(/\D/g, '') ?? '';
    if (!validateCnpj(digits)) {
      toast.error('CNPJ inválido');
      return;
    }
    setFetchingCnpj(true);
    try {
      const data = await fetchCnpjData(digits);
      if (data) {
        const es = editingSupplier ?? {};
        if (data.razao_social && !es.name?.trim()) updateField('name', data.razao_social);
        if (data.nome_fantasia && !es.trading_name?.trim())
          updateField('trading_name', data.nome_fantasia);
        if (data.logradouro && !es.logradouro?.trim()) updateField('logradouro', data.logradouro);
        if (data.numero && !es.numero?.trim()) updateField('numero', data.numero);
        if (data.complemento && !es.complemento?.trim())
          updateField('complemento', data.complemento);
        if (data.bairro && !es.bairro?.trim()) updateField('bairro', data.bairro);
        if (data.cidade && !es.cidade?.trim()) updateField('cidade', data.cidade);
        if (data.estado && !es.estado?.trim()) updateField('estado', data.estado);
        if (data.cep && !es.cep?.trim()) updateField('cep', maskCep(data.cep));
        if (data.email && !es.email?.trim()) updateField('email', data.email);
        if (data.telefone && !foneFixo1.trim()) setFoneFixo1(data.telefone);
        toast.success('Dados preenchidos via CNPJ!');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao consultar CNPJ');
    } finally {
      setFetchingCnpj(false);
    }
  };

  const handleCepLookup = async (cep: string) => {
    const masked = maskCep(cep);
    updateField('cep', masked);
    if (masked.replace(/\D/g, '').length === 8) {
      const addr = await fetchAddressByCep(masked);
      if (addr) {
        if (addr.logradouro) updateField('logradouro', addr.logradouro);
        if (addr.bairro) updateField('bairro', addr.bairro);
        if (addr.localidade) updateField('cidade', addr.localidade);
        if (addr.uf) updateField('estado', addr.uf);
        toast.success('Endereço preenchido via CEP');
      }
    }
  };

  return {
    suppliers,
    loading,
    search,
    setSearch,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    editingSupplier,
    setEditingSupplier,
    isNew,
    saving,
    deleting,
    // BUG-04: new delete confirmation state/actions
    deleteConfirmSupplier,
    confirmDelete,
    cancelDelete,
    uploadingLogo,
    fetchingCnpj,
    contacts,
    setContacts,
    formaPagamento,
    setFormaPagamento,
    pixKeys,
    setPixKeys,
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
    searchCarriers,
    carrierSearchTimeout,
    logoInputRef,
    filtered,
    handleNew,
    handleEdit,
    handleSave,
    handleDelete,
    updateField,
    handleLogoUpload,
    handleCnpjLookup,
    handleCepLookup,
    fetchSuppliers,
    updatePixKey,
    addPixKey,
    removePixKey,
    updateContact,
    addContact,
    removeContact,
  };
}

function buildNotesPayload(
  es: Partial<Supplier>,
  contacts: SupplierContact[],
  formaPagamento: string[],
  pixKeys: PixKey[],
  transportadoraPadrao: string,
  transportadoraId: string,
): string | null {
  const parts: string[] = [];
  // Strip ALL legacy serialized blocks from notes — keep only free-text
  const userNotes = es.notes
    ?.trim()
    ?.replace(/\[Contato 1 extras:.*?\]/g, '')
    ?.replace(/\[Contatos adicionais:.*?\]/g, '')
    ?.replace(/\[Redes Sociais:.*?\]/g, '')
    ?.replace(/\[Financeiro:.*?\]/g, '')
    ?.replace(/\[Fones Fixos:.*?\]/g, '')
    ?.replace(/\[Fiscal:.*?\]/g, '')
    ?.replace(/\[Transportadora:.*?\]/g, '')
    ?.trim();
  if (userNotes) parts.push(userNotes);

  // Contact extras (signature/nickname) — still in notes (no dedicated columns yet)
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

  // Financial/PIX data — still in notes (no dedicated columns yet)
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

  // Transportadora — still in notes (no dedicated column yet)
  if (transportadoraPadrao.trim()) {
    parts.push(`[Transportadora: ${transportadoraPadrao.trim()}, ID: ${transportadoraId || '-'}]`);
  }

  // NOTE: Fones Fixos, Fiscal (IE, Regime, UF) are NO LONGER serialized here.
  // They now use dedicated columns: phone, phone2, inscricao_estadual, tax_regime, state_uf.
  // Social media (instagram, facebook, etc.) also use dedicated columns now.

  return parts.join('\n') || null;
}
