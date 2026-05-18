import { useState } from "react";
import { useLoginAttempts, useLoginAttemptStats } from "@/hooks/useLoginAttempts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, ShieldAlert, ShieldCheck, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageSEO } from "@/components/seo/PageSEO";

export default function AdminLoginAttemptsPage() {
  const [page, setPage] = useState(1);
  const [emailFilter, setEmailFilter] = useState("");
  const [successFilter, setSuccessFilter] = useState<boolean | null>(null);

  const { data, isLoading } = useLoginAttempts({
    page,
    pageSize: 30,
    emailFilter: emailFilter || undefined,
    successFilter,
  });

  const { data: stats } = useLoginAttemptStats();

  return (
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
      <PageSEO title="Tentativas de Login" description="Monitore tentativas de login e atividades suspeitas." path="/admin/login-attempts" noIndex />
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Tentativas de Login</h1>
        <p className="text-muted-foreground">Monitoramento de acessos e tentativas de autenticação</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats?.total24h || 0}</p>
                <p className="text-sm text-muted-foreground">Total 24h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats?.failed24h || 0}</p>
                <p className="text-sm text-muted-foreground">Falhas 24h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats?.failRate24h || 0}%</p>
                <p className="text-sm text-muted-foreground">Taxa de Falha</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats?.total7d || 0}</p>
                <p className="text-sm text-muted-foreground">Total 7 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por email..."
                value={emailFilter}
                onChange={(e) => { setEmailFilter(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select
              value={successFilter === null ? "all" : successFilter ? "success" : "failed"}
              onValueChange={(v) => {
                setSuccessFilter(v === "all" ? null : v === "success");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Tentativas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : data?.attempts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma tentativa encontrada
                  </TableCell>
                </TableRow>
              ) : (
                data?.attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(attempt.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{attempt.email}</TableCell>
                    <TableCell>
                      <Badge variant={attempt.success ? "default" : "destructive"}>
                        {attempt.success ? "Sucesso" : "Falha"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{attempt.ip_address}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {attempt.failure_reason || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Página {page} de {data.totalPages} ({data.totalCount} registros)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
  );
}
