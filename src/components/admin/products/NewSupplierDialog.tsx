import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Loader2,
  Building2,
  Phone,
  DollarSign,
  Settings2,
  MapPin,
  Globe,
  Landmark,
  Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { applyPixMask, pixPlaceholder, validatePixKey } from '@/utils/pixMask';
import type { NewSupplierDialogProps } from './new-supplier/types';
import { useNewSupplierForm } from './new-supplier/useNewSupplierForm';
import { BasicDataTab } from './new-supplier/tabs/BasicDataTab';
import { ContactsTab } from './new-supplier/tabs/ContactsTab';
import { AddressTab } from './new-supplier/tabs/AddressTab';

const fieldClass = 'mt-1.5 h-9';

export function NewSupplierDialog({ onCreated }: NewSupplierDialogProps) {
  const form = useNewSupplierForm(onCreated);

  return (
    <Dialog open={form.open} onOpenChange={form.setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Cadastrar Fornecedor
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-2">
          <TabsList className="grid h-9 w-full grid-cols-7">
            <TabsTrigger value="basic" className="gap-1 text-xs">
              <Building2 className="h-3.5 w-3.5" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="contact" className="gap-1 text-xs">
              <Phone className="h-3.5 w-3.5" />
              Contatos
            </TabsTrigger>
            <TabsTrigger value="address" className="gap-1 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              Endereço
            </TabsTrigger>
            <TabsTrigger value="social" className="gap-1 text-xs">
              <Globe className="h-3.5 w-3.5" />
              Site/Redes
            </TabsTrigger>
            <TabsTrigger value="commercial" className="gap-1 text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              Comercial
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-1 text-xs">
              <Landmark className="h-3.5 w-3.5" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="classification" className="gap-1 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Tipo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <BasicDataTab form={form} />
          </TabsContent>
          <TabsContent value="contact">
            <ContactsTab
              contacts={form.contacts}
              updateContact={form.updateContact}
              addContact={form.addContact}
              removeContact={form.removeContact}
            />
          </TabsContent>
          <TabsContent value="address">
            <AddressTab form={form} />
          </TabsContent>

          {/* Social */}
          <TabsContent value="social" className="space-y-4 pt-3">
            <div>
              <Label className="text-xs font-semibold">Website</Label>
              <Input
                value={form.website}
                onChange={(e) => form.setWebsite(e.target.value)}
                placeholder="https://www.fornecedor.com.br"
                className={fieldClass}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Instagram</Label>
              <Input
                value={form.instagram}
                onChange={(e) => form.setInstagram(e.target.value)}
                placeholder="@fornecedor"
                className={fieldClass}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Facebook</Label>
              <Input
                value={form.facebook}
                onChange={(e) => form.setFacebook(e.target.value)}
                placeholder="https://facebook.com/fornecedor"
                className={fieldClass}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">LinkedIn</Label>
              <Input
                value={form.linkedin}
                onChange={(e) => form.setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/company/fornecedor"
                className={fieldClass}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">YouTube</Label>
              <Input
                value={form.youtube}
                onChange={(e) => form.setYoutube(e.target.value)}
                placeholder="https://youtube.com/@fornecedor"
                className={fieldClass}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">TikTok</Label>
              <Input
                value={form.tiktok}
                onChange={(e) => form.setTiktok(e.target.value)}
                placeholder="@fornecedor"
                className={fieldClass}
              />
            </div>
          </TabsContent>

          {/* Commercial */}
          <TabsContent value="commercial" className="space-y-4 pt-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Markup Padrão (%)</Label>
                <Input
                  type="number"
                  value={form.defaultMarkup}
                  onChange={(e) => form.setDefaultMarkup(e.target.value)}
                  placeholder="Ex: 115"
                  className={fieldClass}
                  min={0}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Pedido Mínimo (R$)</Label>
                <Input
                  type="number"
                  value={form.minOrderValue}
                  onChange={(e) => form.setMinOrderValue(e.target.value)}
                  placeholder="Ex: 500"
                  className={fieldClass}
                  min={0}
                  step={0.01}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Prazo Entrega (dias)</Label>
                <Input
                  type="number"
                  value={form.deliveryTimeDays}
                  onChange={(e) => form.setDeliveryTimeDays(e.target.value)}
                  placeholder="Ex: 15"
                  className={fieldClass}
                  min={0}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Condições de Pagamento</Label>
              <Input
                value={form.paymentTerms}
                onChange={(e) => form.setPaymentTerms(e.target.value)}
                placeholder="Ex: 30/60/90 dias"
                className={fieldClass}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Condições de Frete</Label>
              <Input
                value={form.shippingTerms}
                onChange={(e) => form.setShippingTerms(e.target.value)}
                placeholder="Ex: CIF acima de R$ 3.000"
                className={fieldClass}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Prioridade (0-100)</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => form.setPriority(e.target.value)}
                min={0}
                max={100}
                className={fieldClass}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => form.setNotes(e.target.value)}
                placeholder="Notas internas sobre este fornecedor..."
                className="mt-1.5 min-h-[80px]"
              />
            </div>
          </TabsContent>

          {/* Financial */}
          <TabsContent value="financial" className="space-y-4 pt-3">
            <div>
              <Label className="mb-2 block text-xs font-semibold">
                Formas de Pagamento Aceitas
              </Label>
              <div className="flex flex-wrap gap-2">
                {['Boleto', 'Cartão', 'PIX', 'Transferência', 'Depósito', 'Cheque'].map((fp) => (
                  <Button
                    key={fp}
                    type="button"
                    variant={form.formaPagamento.includes(fp) ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      form.setFormaPagamento((prev: string[]) =>
                        prev.includes(fp) ? prev.filter((p: string) => p !== fp) : [...prev, fp],
                      )
                    }
                  >
                    {fp}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Chaves PIX</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={form.addPixKey}
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>
              {form.pixKeys.map(
                (pix: {
                  id: string;
                  tipo: string;
                  chave: string;
                  favorecido: string;
                  principal: boolean;
                }) => (
                  <div
                    key={pix.id}
                    className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={pix.principal}
                          onCheckedChange={(v) => form.updatePixKey(pix.id, 'principal', v)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {pix.principal ? 'Principal' : 'Secundária'}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => form.removePixKey(pix.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px]">Tipo</Label>
                        <Select
                          value={pix.tipo}
                          onValueChange={(v) => form.updatePixKey(pix.id, 'tipo', v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cpf">CPF</SelectItem>
                            <SelectItem value="cnpj">CNPJ</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="phone">Telefone</SelectItem>
                            <SelectItem value="random">Aleatória</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">Chave</Label>
                        <Input
                          value={pix.chave}
                          onChange={(e) => {
                            const v = pix.tipo
                              ? applyPixMask(e.target.value, pix.tipo)
                              : e.target.value;
                            form.updatePixKey(pix.id, 'chave', v);
                          }}
                          placeholder={pixPlaceholder(pix.tipo)}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Favorecido</Label>
                        <Input
                          value={pix.favorecido}
                          onChange={(e) => form.updatePixKey(pix.id, 'favorecido', e.target.value)}
                          placeholder="Nome do favorecido"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    {pix.chave.trim() && validatePixKey(pix.chave, pix.tipo) && (
                      <p className="text-[10px] text-destructive">
                        {validatePixKey(pix.chave, pix.tipo)}
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          </TabsContent>

          {/* Classification */}
          <TabsContent value="classification" className="space-y-4 pt-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">Fornecedor de Produtos</Label>
                <p className="text-xs text-muted-foreground">Fornece brindes e produtos</p>
              </div>
              <Switch
                checked={form.isProductSupplier}
                onCheckedChange={form.setIsProductSupplier}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">Fornecedor de Gravação</Label>
                <p className="text-xs text-muted-foreground">Realiza personalização/gravação</p>
              </div>
              <Switch
                checked={form.isEngravingSupplier}
                onCheckedChange={form.setIsEngravingSupplier}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Save button */}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => form.setOpen(false)} disabled={form.saving}>
            Cancelar
          </Button>
          <Button onClick={form.handleCreate} disabled={form.saving || !form.name.trim()}>
            {form.saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Criar Fornecedor
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
