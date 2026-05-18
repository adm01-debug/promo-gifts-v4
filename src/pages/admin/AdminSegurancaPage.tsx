import { PageSEO } from "@/components/seo/PageSEO";
import { AccessSecurityManager } from "@/components/admin/AccessSecurityManager";
import { SecurityDashboard } from "@/components/security/SecurityDashboard";
import { ShieldCheck, Shield, Lock, UploadCloud } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecureUploadManager } from "@/components/admin/security/SecureUploadManager";

export default function AdminSegurancaPage() {
  return (
      <>
        <PageSEO title="Segurança" description="Central de segurança, monitoramento de acessos e restrições." path="/admin/seguranca" noIndex />
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">Segurança</h1>
              <p className="text-muted-foreground">Central de segurança e restrições de acesso</p>
            </div>
          </div>

          <Tabs defaultValue="central" className="space-y-6">
            <TabsList className="h-auto p-1 flex-wrap">
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

