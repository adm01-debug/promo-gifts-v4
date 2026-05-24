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
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Customizar regras do produto?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá copiar todas as regras do grupo para este produto, permitindo que
                        você as modifique individualmente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={copyGroupRulesToProduct}>
                        Copiar e Customizar
                      </AlertDialogAction>
                    </AlertDialogFooter>
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
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Voltar a usar regras do grupo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá descartar as regras customizadas deste produto. Esta ação não pode
                        ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          toggleGroupRules({ id: productMembership.id, use_group_rules: true })
                        }
                      >
                        Usar Regras do Grupo
                      </AlertDialogAction>
                    </AlertDialogFooter>
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
