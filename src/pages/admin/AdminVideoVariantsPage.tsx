import { useState, useMemo } from 'react';
import { useVideoVariantLinks } from '@/hooks/products';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Video, Plus, Trash2, Search, Play } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageSEO } from '@/components/seo/PageSEO';

export default function AdminVideoVariantsPage() {
  const [productFilter, setProductFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLink, setNewLink] = useState({
    product_id: '',
    variant_id: '',
    variant_name: '',
    variant_color_hex: '',
    video_id: '',
    supplier_code: '',
  });

  const { data: links, isLoading, createLink, deleteLink } = useVideoVariantLinks();

  const filteredLinks = useMemo(
    () =>
      (links || []).filter(
        (l) =>
          !productFilter ||
          l.product_id.toLowerCase().includes(productFilter.toLowerCase()) ||
          (l.variant_name || '').toLowerCase().includes(productFilter.toLowerCase()),
      ),
    [links, productFilter],
  );

  const handleCreate = () => {
    createLink.mutate(
      {
        product_id: newLink.product_id,
        variant_id: newLink.variant_id,
        variant_name: newLink.variant_name || null,
        variant_color_hex: newLink.variant_color_hex || null,
        video_id: newLink.video_id,
        supplier_code: newLink.supplier_code || null,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setNewLink({
            product_id: '',
            variant_id: '',
            variant_name: '',
            variant_color_hex: '',
            video_id: '',
            supplier_code: '',
          });
        },
      },
    );
  };

  return (
    <>
      <PageSEO
        title="Vídeos por Variante"
        description="Gerencie vídeos associados a variantes de produtos."
        path="/admin/video-variantes"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1
              data-testid="page-title-video-variants"
              className="flex items-center gap-2 font-display text-2xl font-bold text-foreground"
            >
              <Video className="h-6 w-6" />
              Vídeos por Variante
            </h1>
            <p className="text-muted-foreground">
              Gerencie a associação de vídeos com variantes de produtos
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Novo Vínculo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Vincular Vídeo à Variante</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>ID do Produto *</Label>
                  <Input
                    value={newLink.product_id}
                    onChange={(e) => setNewLink({ ...newLink, product_id: e.target.value })}
                    placeholder="Ex: PROD-001"
                  />
                </div>
                <div>
                  <Label>ID da Variante *</Label>
                  <Input
                    value={newLink.variant_id}
                    onChange={(e) => setNewLink({ ...newLink, variant_id: e.target.value })}
                    placeholder="Ex: VAR-001"
                  />
                </div>
                <div>
                  <Label>Nome da Variante</Label>
                  <Input
                    value={newLink.variant_name}
                    onChange={(e) => setNewLink({ ...newLink, variant_name: e.target.value })}
                    placeholder="Ex: Azul Royal"
                  />
                </div>
                <div>
                  <Label>Cor (hex)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newLink.variant_color_hex}
                      onChange={(e) =>
                        setNewLink({ ...newLink, variant_color_hex: e.target.value })
                      }
                      placeholder="#0000FF"
                    />
                    {newLink.variant_color_hex && (
                      <div
                        className="h-10 w-10 shrink-0 rounded border"
                        style={{ backgroundColor: newLink.variant_color_hex }}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <Label>ID do Vídeo *</Label>
                  <Input
                    value={newLink.video_id}
                    onChange={(e) => setNewLink({ ...newLink, video_id: e.target.value })}
                    placeholder="URL ou ID do vídeo"
                  />
                </div>
                <div>
                  <Label>Código Fornecedor</Label>
                  <Input
                    value={newLink.supplier_code}
                    onChange={(e) => setNewLink({ ...newLink, supplier_code: e.target.value })}
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={
                    !newLink.product_id ||
                    !newLink.variant_id ||
                    !newLink.video_id ||
                    createLink.isPending
                  }
                  className="w-full"
                >
                  {createLink.isPending ? 'Criando...' : 'Criar Vínculo'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filtrar por produto ou variante..."
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vínculos ({filteredLinks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Vídeo</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredLinks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhum vínculo encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-mono text-sm">{link.product_id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{link.variant_name || link.variant_id}</p>
                          {link.variant_name && (
                            <p className="font-mono text-xs text-muted-foreground">
                              {link.variant_id}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {link.variant_color_hex ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="h-5 w-5 rounded-full border"
                              style={{ backgroundColor: link.variant_color_hex }}
                            />
                            <span className="font-mono text-xs">{link.variant_color_hex}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Play className="h-3 w-3" />
                          {link.video_id.substring(0, 20)}...
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{link.supplier_code || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(link.created_at), 'dd/MM/yy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir"
                          onClick={() => deleteLink.mutate(link.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
