import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, Truck, X } from 'lucide-react';
import { maskCep, ESTADOS_BR } from '@/utils/masks';
import type { NewSupplierForm } from '../useNewSupplierForm';
import { cn } from '@/lib/utils';

const fieldClass = 'mt-1.5 h-9';

interface AddressTabProps {
  form: NewSupplierForm;
}

export function AddressTab({ form }: AddressTabProps) {
  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold">CEP</Label>
          <Input
            value={form.cep}
            onChange={async (e: ChangeEvent<HTMLInputElement>) =>
              form.handleCepLookup(maskCep(e.target.value))
            }
            placeholder="00000-000"
            className={cn(fieldClass, 'font-mono')}
            maxLength={9}
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Tipo Logradouro</Label>
          <select
            value={form.tipoLogradouro}
            onChange={(e) => form.setTipoLogradouro(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecione</option>
            {[
              'Rua',
              'Avenida',
              'Alameda',
              'Travessa',
              'Praça',
              'Rodovia',
              'Estrada',
              'Viela',
              'Largo',
              'Outro',
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold">Logradouro</Label>
        <Input
          value={form.logradouro}
          onChange={(e: ChangeEvent<HTMLInputElement>) => form.setLogradouro(e.target.value)}
          placeholder="Nome da rua"
          className={fieldClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold">Número</Label>
          <Input
            value={form.numero}
            onChange={(e: ChangeEvent<HTMLInputElement>) => form.setNumero(e.target.value)}
            placeholder="123"
            className={fieldClass}
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Complemento</Label>
          <Input
            value={form.complemento}
            onChange={(e: ChangeEvent<HTMLInputElement>) => form.setComplemento(e.target.value)}
            placeholder="Sala 101"
            className={fieldClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold">Bairro</Label>
          <Input
            value={form.bairro}
            onChange={(e: ChangeEvent<HTMLInputElement>) => form.setBairro(e.target.value)}
            placeholder="Centro"
            className={fieldClass}
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Cidade</Label>
          <Input
            value={form.cidade}
            onChange={(e: ChangeEvent<HTMLInputElement>) => form.setCidade(e.target.value)}
            placeholder="São Paulo"
            className={fieldClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold">Estado</Label>
          <select
            value={form.estado}
            onChange={(e) => form.setEstado(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecione</option>
            {ESTADOS_BR.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs font-semibold">País</Label>
          <Input
            value={form.pais}
            onChange={(e: ChangeEvent<HTMLInputElement>) => form.setPais(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold">Ponto de Referência</Label>
        <Input
          value={form.pontoReferencia}
          onChange={(e: ChangeEvent<HTMLInputElement>) => form.setPontoReferencia(e.target.value)}
          placeholder="Próximo ao..."
          className={fieldClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold">Latitude</Label>
          <Input
            type="number"
            step="any"
            value={form.latitude}
            onChange={(e: ChangeEvent<HTMLInputElement>) => form.setLatitude(e.target.value)}
            placeholder="-23.5505"
            className={cn(fieldClass, 'font-mono')}
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Longitude</Label>
          <Input
            type="number"
            step="any"
            value={form.longitude}
            onChange={(e: ChangeEvent<HTMLInputElement>) => form.setLongitude(e.target.value)}
            placeholder="-46.6333"
            className={cn(fieldClass, 'font-mono')}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold">Google Maps URL</Label>
          <Input
            value={form.googleMapsUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) => form.setGoogleMapsUrl(e.target.value)}
            placeholder="https://maps.google.com/..."
            className={fieldClass}
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Google Place ID</Label>
          <Input
            value={form.googlePlaceId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => form.setGooglePlaceId(e.target.value)}
            placeholder="ChIJ..."
            className={fieldClass}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold">Horário de Funcionamento</Label>
        <Input
          value={form.horarioFuncionamento}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            form.setHorarioFuncionamento(e.target.value)
          }
          placeholder="Seg-Sex 08:00-18:00"
          className={fieldClass}
        />
      </div>

      {/* Transportadora */}
      <div className="relative">
        <Label className="flex items-center gap-1.5 text-xs font-semibold">
          <Truck className="h-3.5 w-3.5" /> Transportadora Padrão
        </Label>
        {form.transportadoraPadrao ? (
          <div className="mt-1 flex items-center gap-2">
            <div className={cn(fieldClass, 'flex flex-1 items-center px-3 text-sm')}>
              {form.transportadoraPadrao}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Fechar"
              className="h-9 w-9 shrink-0"
              onClick={() => {
                form.setTransportadoraPadrao('');
                form.setTransportadoraId('');
                form.setCarrierSearch('');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={form.carrierSearch}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value;
                form.setCarrierSearch(val);
                clearTimeout(form.carrierSearchTimeout.current);
                form.carrierSearchTimeout.current = setTimeout(() => form.searchCarriers(val), 400);
              }}
              onFocus={() => {
                if (form.carrierResults.length > 0) form.setShowCarrierDropdown(true);
              }}
              onBlur={() => setTimeout(() => form.setShowCarrierDropdown(false), 200)}
              placeholder="Buscar transportadora..."
              className={cn(fieldClass, 'pl-9')}
            />
            {form.searchingCarriers && (
              <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            {form.showCarrierDropdown && form.carrierResults.length > 0 && (
              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
                {form.carrierResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      form.setTransportadoraPadrao(c.nome_fantasia || c.razao_social);
                      form.setTransportadoraId(c.id);
                      form.setCarrierSearch('');
                      form.setShowCarrierDropdown(false);
                    }}
                  >
                    <span className="font-medium">{c.nome_fantasia || c.razao_social}</span>
                    {c.nome_fantasia && c.razao_social && (
                      <span className="ml-2 text-xs text-muted-foreground">({c.razao_social})</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div>
        <Label className="text-xs font-semibold">Instruções de Entrega</Label>
        <Textarea
          value={form.instrucoesEntrega}
          onChange={(e) => form.setInstrucoesEntrega(e.target.value)}
          placeholder="Entrar pela portaria lateral..."
          className="mt-1.5 min-h-[60px]"
        />
      </div>
    </div>
  );
}
