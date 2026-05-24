import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ImagePlus, X, Search } from 'lucide-react';
import { maskCnpj, maskPhone, ESTADOS_BR } from '@/utils/masks';
import type { NewSupplierForm } from '../useNewSupplierForm';

const fieldClass = "mt-1.5 h-9";

interface BasicDataTabProps {
  form: NewSupplierForm;
}

export function BasicDataTab({ form }: BasicDataTabProps) {
  return (
    <div className="space-y-4 pt-3">
      {/* Logo + Nome Fantasia + Código */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {form.logoUrl ? (
            <div className="relative w-20 h-20 rounded-lg border border-border overflow-hidden bg-muted">
              
<img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain"  loading="lazy" />
              <button type="button" onClick={() => form.setLogoUrl('')} className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground p-0.5">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => form.logoInputRef.current?.click()} disabled={form.uploadingLogo} className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors">
              {form.uploadingLogo ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ImagePlus className="h-5 w-5" /><span className="text-[10px]">Logo</span></>}
            </button>
          )}
          <input ref={form.logoInputRef} type="file" accept="image/*" className="hidden" onChange={form.handleLogoUpload} />
        </div>
        <div className="flex-1">
          <Label className="text-xs font-semibold">Nome Fantasia</Label>
          <Input value={form.tradingName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setTradingName(e.target.value)} placeholder="Ex: Asia Import" className={fieldClass} autoFocus />
        </div>
        <div className="w-40 shrink-0">
          <Label className="text-xs font-semibold">Código <span className="text-destructive">*</span></Label>
          <Input value={form.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setCode(e.target.value)} placeholder="Auto-gerado" className={`${fieldClass} font-mono uppercase`} />
        </div>
      </div>

      {/* Razão Social */}
      <div>
        <Label className="text-xs font-semibold">Razão Social <span className="text-destructive">*</span></Label>
        <Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setName(e.target.value)} placeholder="Ex: Asia Import Comércio LTDA" className={fieldClass} />
      </div>

      {/* CNPJ + Inscrição Estadual */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold">CNPJ</Label>
          <div className="flex gap-1.5">
            <Input value={form.cnpj} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { form.setCnpj(maskCnpj(e.target.value)); form.setCnpjError(''); }} placeholder="00.000.000/0000-00" className={`${fieldClass} font-mono flex-1 ${form.cnpjError ? 'border-destructive' : ''}`} maxLength={18} />
            <Button type="button" variant="outline" size="sm" className="h-9 px-2.5 shrink-0" disabled={form.fetchingCnpj || form.cnpj.replace(/\D/g, '').length !== 14} onClick={form.handleCnpjLookup}>
              {form.fetchingCnpj ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {form.cnpjError && <p className="text-[10px] text-destructive mt-0.5">{form.cnpjError}</p>}
        </div>
        <div>
          <Label className="text-xs font-semibold">Inscrição Estadual</Label>
          <Input value={form.inscricaoEstadual} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setInscricaoEstadual(e.target.value)} placeholder="Ex: 123.456.789.000" className={fieldClass} />
        </div>
      </div>

      {/* Fone Fixo 01 + 02 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold">Fone Fixo 01</Label>
          <Input value={form.foneFixo1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setFoneFixo1(maskPhone(e.target.value))} placeholder="(00) 0000-0000" className={fieldClass} maxLength={15} />
        </div>
        <div>
          <Label className="text-xs font-semibold">Fone Fixo 02</Label>
          <Input value={form.foneFixo2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setFoneFixo2(maskPhone(e.target.value))} placeholder="(00) 0000-0000" className={fieldClass} maxLength={15} />
        </div>
      </div>

      {/* Regime Tributário + Estado de Faturamento */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold">Regime Tributário</Label>
          <Select value={form.regimeTributario} onValueChange={form.setRegimeTributario}>
            <SelectTrigger className={fieldClass}><SelectValue placeholder="Selecione o regime" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MEI">MEI</SelectItem>
              <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
              <SelectItem value="Lucro Real">Lucro Real</SelectItem>
              <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold">Estado de Faturamento</Label>
          <Select value={form.estadoFaturamento} onValueChange={form.setEstadoFaturamento}>
            <SelectTrigger className={fieldClass}><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
            <SelectContent>
              {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <Label className="text-sm">Ativo</Label>
        <Switch checked={form.isActive} onCheckedChange={form.setIsActive} />
      </div>
    </div>
  );
}
