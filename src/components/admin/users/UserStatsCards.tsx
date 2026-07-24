import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, Code2, ShieldCheck, Shield, KeyRound } from 'lucide-react';

interface UserStatsCardsProps {
  total: number;
  devCount: number;
  supervisorCount: number;
  agenteCount: number;
  pendingCount: number;
}

export function UserStatsCards({
  total,
  devCount,
  supervisorCount,
  agenteCount,
  pendingCount,
}: UserStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total de usuários</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{total}</div>
        </CardContent>
      </Card>
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Devs</CardTitle>
          <Code2 className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{devCount}</div>
        </CardContent>
      </Card>
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Supervisores</CardTitle>
          <ShieldCheck className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{supervisorCount}</div>
        </CardContent>
      </Card>
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Agentes</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{agenteCount}</div>
        </CardContent>
      </Card>
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Reset pendentes</CardTitle>
          <KeyRound className="h-4 w-4 text-warning" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-warning">{pendingCount}</div>
        </CardContent>
      </Card>
    </div>
  );
}
