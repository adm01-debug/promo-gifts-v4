import { PageSEO } from '@/components/seo/PageSEO';
import { AccessSecurityManager } from '@/components/admin/AccessSecurityManager';
import { SecurityDashboard } from '@/components/security/SecurityDashboard';
import { ShieldCheck, Shield, Lock, UploadCloud } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SecureUploadManager } from '@/components/admin/security/SecureUploadManager';

export default function AdminSegurancaPage() {
  return (
    <>
      <PageSEO
        title="Segurança"
        description="Central de segurança, monitoramento de acessos e restrições."
        path="/admin/seguranca"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1
              data-testid="page-title-seguranca"
              className="font-display text-3xl font-bold tracking-tight"
            >
              Segurança
            </h1>
            <p className="text-muted-foreground">Central de segurança e restrições de acesso</p>
          </div>
        </div>

        <Tabs defaultValue="central" className="space-y-6">
          <TabsList className="h-auto flex-wrap p-1">
            <TabsTrigger value="central" className="gap-2 px-4 py-2.5">
              <Shield className="h-4 w-4" />
              Central de Segurança
            </TabsTrigger>
            <TabsTrigger value="restricoes" className="gap-2 px-4 py-2.5">
              <Lock className="h-4 w-4" />
              Restrições de Acesso
            </TabsTrigger>
            <TabsTrigger value="uploads" className="gap-2 px-4 py-2.5">
              <UploadCloud className="h-4 w-4" />
              Gestão de Uploads (Dev)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="central">
            <SecurityDashboard />
          </TabsContent>

          <TabsContent value="restricoes">
            <AccessSecurityManager />
          </TabsContent>

          <TabsContent value="uploads">
            <SecureUploadManager />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
