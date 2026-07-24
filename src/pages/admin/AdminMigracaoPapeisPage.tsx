import { PageSEO } from '@/components/seo/PageSEO';
import { Users, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RoleMigrationPanel } from '@/components/admin/security/role-migration/RoleMigrationPanel';

export default function AdminMigracaoPapeisPage() {
  return (
    <>
      <PageSEO
        title="Migração de papéis"
        description="Execute trocas de papéis em lote com auditoria por usuário e por evento."
        path="/admin/seguranca/migracao-papeis"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-3 py-3 pb-24 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1
                data-testid="page-title-migracao-papeis"
                className="font-display text-3xl font-bold tracking-tight"
              >
                Migração de papéis
              </h1>
              <p className="text-muted-foreground">
                Execução em lotes com dry-run e auditoria por usuário e por evento
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/seguranca">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar a Segurança
            </Link>
          </Button>
        </div>

        <RoleMigrationPanel />
      </div>
    </>
  );
}
