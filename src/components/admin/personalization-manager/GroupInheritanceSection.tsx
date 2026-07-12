import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Copy, Link, Unlink, Loader2 } from 'lucide-react';
import type { ProductGroupMember } from './types';

interface GroupInheritanceSectionProps {
  productMembership: ProductGroupMember;
  isUsingGroupRules: boolean;
  isCopying: boolean;
  copyGroupRulesToProduct: () => void;
  toggleGroupRules: (params: { id: string; use_group_rules: boolean }) => void;
}

export function GroupInheritanceSection({
  productMembership,
  isUsingGroupRules,
  isCopying,
  copyGroupRulesToProduct,
  toggleGroupRules,
}: GroupInheritanceSectionProps) {
  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                {isUsingGroupRules ? (
                  <Link className="h-5 w-5 text-primary" />
                ) : (
                  <Unlink className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  Grupo: {productMembership.product_group?.group_name}
                </CardTitle>
                <CardDescription>
                  {isUsingGroupRules
                    ? 'Este produto herda as regras do grupo'
                    : 'Este produto usa regras customizadas'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isUsingGroupRules ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={isCopying}>
                      {isCopying ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      Customizar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="!max-w-[400px] w-[92vw] gap-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-0 shadow-xl backdrop-blur-xl" data-testid="group-inheritance-section-dialog">
                    <div aria-hidden="true" className="h-[3px] w-full bg-gradient-to-r from-transparent via-primary to-transparent" />
                    <div className="px-4 pb-1.5 pt-4">
                      <AlertDialogHeader>
                        <div className="flex items-start gap-3">
                          <div className="relative flex-shrink-0">
                            <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-xl blur-lg opacity-60 bg-primary/30" />
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/20">
                              <Copy className="h-[18px] w-[18px] text-primary" strokeWidth={2.2} />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                            <AlertDialogTitle className="text-sm font-semibold leading-tight tracking-tight text-foreground">
                              Customizar regras do produto?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                              Isso irá copiar todas as regras do grupo para este produto, permitindo que você as modifique individualmente.
                            </AlertDialogDescription>
                          </div>
                        </div>
                      </AlertDialogHeader>
                    </div>
                    <div className="mt-3 border-t border-border/50 bg-muted/20 px-4 py-2.5">
                      <AlertDialogFooter className="gap-1.5 sm:gap-1.5">
                        <AlertDialogCancel className="mt-0 h-[26px] min-h-[26px] rounded-md border-border/70 bg-transparent px-3 py-0 text-xs">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={copyGroupRulesToProduct} className="inline-flex h-[26px] min-h-[26px] items-center rounded-md px-3.5 text-xs font-semibold">
                          Copiar e Customizar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">
                      <Link className="mr-2 h-4 w-4" />
                      Voltar para Grupo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="!max-w-[400px] w-[92vw] gap-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-0 shadow-xl backdrop-blur-xl">
                    <div aria-hidden="true" className="h-[3px] w-full bg-gradient-to-r from-transparent via-warning to-transparent" />
                    <div className="px-4 pb-1.5 pt-4">
                      <AlertDialogHeader>
                        <div className="flex items-start gap-3">
                          <div className="relative flex-shrink-0">
                            <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-xl blur-lg opacity-60 bg-warning/30" />
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 ring-1 ring-inset ring-warning/20">
                              <Link className="h-[18px] w-[18px] text-warning" strokeWidth={2.2} />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                            <AlertDialogTitle className="text-sm font-semibold leading-tight tracking-tight text-foreground">
                              Voltar a usar regras do grupo?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                              Isso irá descartar as regras customizadas deste produto. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </div>
                        </div>
                      </AlertDialogHeader>
                    </div>
                    <div className="mt-3 border-t border-border/50 bg-muted/20 px-4 py-2.5">
                      <AlertDialogFooter className="gap-1.5 sm:gap-1.5">
                        <AlertDialogCancel className="mt-0 h-[26px] min-h-[26px] rounded-md border-border/70 bg-transparent px-3 py-0 text-xs">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            toggleGroupRules({ id: productMembership.id, use_group_rules: true })
                          }
                          className="inline-flex h-[26px] min-h-[26px] items-center rounded-md px-3.5 text-xs font-semibold"
                        >
                          Usar Regras do Grupo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {isUsingGroupRules && (
        <Card>
          <CardContent className="py-12 text-center">
            <Link className="mx-auto mb-4 h-12 w-12 text-primary opacity-50" />
            <h3 className="mb-2 font-display text-lg font-medium">Usando regras do grupo</h3>
            <p className="mb-4 text-muted-foreground">
              Este produto está herdando as configurações do grupo{' '}
              <strong>{productMembership.product_group?.group_name}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Clique em "Customizar" acima para criar regras específicas para este produto.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
