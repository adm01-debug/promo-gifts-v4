import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Cloud,
  CloudOff,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageSEO } from '@/components/seo/PageSEO';
import { untypedFrom } from '@/lib/supabase-untyped';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';
import { getProxiedImageUrl } from '@/utils/imageProxy';

type CfSyncStatus = 'failed' | 'pending' | 'skipped' | 'syncing' | 'verified';

interface CfImage {
  id: string;
  product_id: string;
  url_cdn?: string | null;
  cf_image_id?: string | null;
  cf_sync_status?: CfSyncStatus | null;
  alt_text?: string | null;
  is_primary?: boolean | null;
  display_order?: number | null;
}

interface CfStats {
  total: number;
  verified: number;
  pending: number;
  syncing: number;
  failed: number;
  skipped: number;
  noStatus: number;
}

const STATUS_CONFIG: Record<
  CfSyncStatus | 'none',
  { icon: React.ElementType; label: string; badgeClass: string; cardClass: string }
> = {
  verified: {
    icon: Cloud,
    label: 'Sincronizado',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    cardClass: 'border-emerald-200 dark:border-emerald-800',
  },
  syncing: {
    icon: Loader2,
    label: 'Sincronizando',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    cardClass: 'border-blue-200 dark:border-blue-800',
  },
  pending: {
    icon: Cloud,
    label: 'Pendente',
    badgeClass: 'bg-muted text-muted-foreground',
    cardClass: 'border-border',
  },
  failed: {
    icon: CloudOff,
    label: 'Falhou',
    badgeClass: 'bg-destructive/10 text-destructive',
    cardClass: 'border-destructive/30',
  },
  skipped: {
    icon: AlertCircle,
    label: 'Ignorado',
    badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    cardClass: 'border-yellow-200 dark:border-yellow-800',
  },
  none: {
    icon: Cloud,
    label: 'Sem status',
    badgeClass: 'bg-muted text-muted-foreground',
    cardClass: 'border-border',
  },
};

function StatusBadge({ status }: { status?: CfSyncStatus | null }) {
  const key = status ?? 'none';
  const cfg = STATUS_CONFIG[key];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        cfg.badgeClass,
      )}
    >
      <Icon className={cn('h-3 w-3', key === 'syncing' && 'animate-spin')} />
      {cfg.label}
    </span>
  );
}

async function fetchCfImages(): Promise<CfImage[]> {
  const { data, error } = await untypedFrom('product_images')
    .select(
      'id, product_id, url_cdn, cf_image_id, cf_sync_status, alt_text, is_primary, display_order',
    )
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as CfImage[];
}

function computeStats(images: CfImage[]): CfStats {
  const stats: CfStats = {
    total: images.length,
    verified: 0,
    pending: 0,
    syncing: 0,
    failed: 0,
    skipped: 0,
    noStatus: 0,
  };
  for (const img of images) {
    switch (img.cf_sync_status) {
      case 'verified':
        stats.verified++;
        break;
      case 'pending':
        stats.pending++;
        break;
      case 'syncing':
        stats.syncing++;
        break;
      case 'failed':
        stats.failed++;
        break;
      case 'skipped':
        stats.skipped++;
        break;
      default:
        stats.noStatus++;
    }
  }
  return stats;
}

const PAGE_SIZE = 100;

export default function AdminCloudflareImagesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CfSyncStatus | 'all' | 'none'>('all');
  const [page, setPage] = useState(0);

  const {
    data: images = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<CfImage[]>({
    queryKey: ['admin-cf-images'],
    queryFn: fetchCfImages,
    staleTime: 2 * 60 * 1000,
  });

  const stats = useMemo(() => computeStats(images), [images]);

  const filtered = useMemo(
    () =>
      images.filter((img) => {
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'none' ? !img.cf_sync_status : img.cf_sync_status === statusFilter);
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          img.product_id.toLowerCase().includes(q) ||
          (img.cf_image_id ?? '').toLowerCase().includes(q) ||
          (img.url_cdn ?? '').toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
      }),
    [images, statusFilter, search],
  );

  const statCards = [
    { label: 'Total', value: stats.total, icon: ImageIcon, className: 'text-foreground' },
    { label: 'Sincronizados', value: stats.verified, icon: Cloud, className: 'text-emerald-600' },
    {
      label: 'Pendentes',
      value: stats.pending + stats.noStatus,
      icon: Cloud,
      className: 'text-muted-foreground',
    },
    { label: 'Sincronizando', value: stats.syncing, icon: Loader2, className: 'text-blue-500' },
    { label: 'Com Falha', value: stats.failed, icon: CloudOff, className: 'text-destructive' },
    { label: 'Ignorados', value: stats.skipped, icon: AlertCircle, className: 'text-yellow-500' },
  ];

  return (
    <>
      <PageSEO
        title="Cloudflare Images"
        description="Status de sincronização de imagens com Cloudflare Images."
        path="/admin/cloudflare-images"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-3 py-3 pb-24 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
              <Cloud className="h-6 w-6" />
              Cloudflare Images
            </h1>
            <p className="text-sm text-muted-foreground">
              Status de sincronização das imagens de produtos
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map(({ label, value, icon: Icon, className }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <Icon className={cn('h-4 w-4', className)} />
                </div>
                <p className="mt-1 text-2xl font-bold">{value.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress bar */}
        {stats.total > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Progresso de sincronização</span>
                <span>{Math.round((stats.verified / stats.total) * 100)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(stats.verified / stats.total) * 100}%` }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="text-emerald-600">{stats.verified} ok</span>
                {stats.failed > 0 && (
                  <span className="text-destructive">{stats.failed} falhas</span>
                )}
                {stats.syncing > 0 && (
                  <span className="text-blue-500">{stats.syncing} em progresso</span>
                )}
                {stats.skipped > 0 && (
                  <span className="text-yellow-600">{stats.skipped} ignorados</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por produto, CF ID, URL..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as typeof statusFilter);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="verified">Sincronizados</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="syncing">Sincronizando</SelectItem>
              <SelectItem value="failed">Com falha</SelectItem>
              <SelectItem value="skipped">Ignorados</SelectItem>
              <SelectItem value="none">Sem status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Imagens{' '}
              <Badge variant="secondary" className="ml-1">
                {filtered.length.toLocaleString('pt-BR')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Imagem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>CF Image ID</TableHead>
                    <TableHead>URL CDN</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Ordem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Carregando imagens...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        Nenhuma imagem encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((img) => (
                      <TableRow key={img.id}>
                        <TableCell>
                          {img.url_cdn ? (
                            <div className="h-10 w-10 overflow-hidden rounded-md border border-border/50 bg-muted/30">
                              <OptimizedImage
                                src={getCdnUrl(img.url_cdn, 'thumbnail')}
                                urlOriginal={getProxiedImageUrl(img.url_original) ?? null}
                                alt={img.alt_text ?? ''}
                                className="object-contain"
                                containerClassName="h-full w-full"
                              />
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/20">
                              <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={img.cf_sync_status} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{img.product_id}</TableCell>
                        <TableCell className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">
                          {img.cf_image_id ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          {img.url_cdn ? (
                            <a
                              href={img.url_cdn}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-xs text-primary hover:underline"
                            >
                              {img.url_cdn}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {img.is_primary && (
                            <Badge variant="outline" className="text-[10px]">
                              Principal
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {img.display_order ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t px-4 py-2">
                <p className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de{' '}
                  {filtered.length.toLocaleString('pt-BR')} resultados
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Anterior
                  </Button>
                  <span className="px-2 text-xs text-muted-foreground">
                    {page + 1} / {Math.ceil(filtered.length / PAGE_SIZE)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(Math.ceil(filtered.length / PAGE_SIZE) - 1, p + 1))
                    }
                    disabled={(page + 1) * PAGE_SIZE >= filtered.length}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    Próxima
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
