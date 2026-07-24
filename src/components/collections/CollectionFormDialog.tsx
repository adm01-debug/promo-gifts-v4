/**
 * CollectionFormDialog — Create / Edit collection dialog.
 * Extracted from CollectionsPage for modularity.
 */
import { m as motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { FavoritesClientPicker } from '@/components/favorites/FavoritesClientPicker';

interface FormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  clientId?: string | null;
  clientName?: string | null;
}

interface CollectionFormDialogProps {
  open: boolean;
  isEditing: boolean;
  formData: FormData;
  onFormChange: (data: FormData) => void;
  onSubmit: () => void;
  onClose: () => void;
  defaultColors: string[];
  defaultIcons: string[];
}

export function CollectionFormDialog({
  open,
  isEditing,
  formData,
  onFormChange,
  onSubmit,
  onClose,
  defaultColors,
  defaultIcons,
}: CollectionFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Coleção' : 'Nova Coleção'}</DialogTitle>
        </DialogHeader>

        <div
          className="space-y-5"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && formData.name.trim()) {
              e.preventDefault();
              onSubmit();
            }
          }}
        >
          {/* Live preview */}
          <motion.div
            layout
            className="flex items-center gap-3 rounded-xl border-[1.5px] border-primary/20 bg-muted/30 p-3"
          >
            <motion.div
              key={`${formData.color}-${formData.icon}`}
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ backgroundColor: `${formData.color}20` }}
            >
              {formData.icon}
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display font-semibold text-foreground">
                {formData.name || 'Nome da coleção...'}
              </p>
              {formData.description && (
                <p className="truncate text-xs text-muted-foreground">{formData.description}</p>
              )}
            </div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Preview
            </Badge>
          </motion.div>

          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              placeholder="Ex: Clientes Premium"
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input
              placeholder="Descreva esta coleção..."
              value={formData.description}
              onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Cliente CRM (opcional)</Label>
            <FavoritesClientPicker
              selectedClientId={formData.clientId ?? null}
              selectedClientName={formData.clientName ?? null}
              onSelect={(client) =>
                onFormChange({
                  ...formData,
                  clientId: client?.id ?? null,
                  clientName: client?.name ?? null,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {defaultColors.map((color) => (
                <motion.button
                  key={color}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onFormChange({ ...formData, color })}
                  className={cn(
                    'h-8 w-8 rounded-full transition-all duration-200',
                    formData.color === color &&
                      'scale-110 shadow-md ring-2 ring-primary ring-offset-2',
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="flex flex-wrap gap-2">
              {defaultIcons.map((icon) => (
                <motion.button
                  key={icon}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onFormChange({ ...formData, icon })}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition-all',
                    formData.icon === icon
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  {icon}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2 shadow-lg shadow-primary/20"
              onClick={onSubmit}
              disabled={!formData.name.trim()}
            >
              {isEditing ? (
                'Salvar'
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Criar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
