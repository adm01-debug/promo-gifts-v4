import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X, Clock, Mail, Shield, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePasswordResetRequests, type PasswordResetRequest } from '@/hooks/auth';

export function PasswordResetApproval() {
  const { requests, isLoading, approveRequest, rejectRequest } = usePasswordResetRequests();
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);
  const processedRequests = useMemo(
    () => requests.filter((r) => r.status !== 'pending'),
    [requests],
  );

  const handleAction = async () => {
    if (!selectedRequest || !action) return;

    setIsProcessing(true);

    if (action === 'approve') {
      await approveRequest(selectedRequest.id, notes);
    } else {
      await rejectRequest(selectedRequest.id, notes);
    }

    setIsProcessing(false);
    setSelectedRequest(null);
    setAction(null);
    setNotes('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
            <Clock className="mr-1 h-3 w-3" /> Pendente
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
            <Check className="mr-1 h-3 w-3" /> Aprovado
          </Badge>
        );
      case 'rejected':
        return (
          <Badge
            variant="outline"
            className="border-destructive/30 bg-destructive/10 text-destructive"
          >
            <X className="mr-1 h-3 w-3" /> Rejeitado
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-primary" />
            <CardTitle>Solicitações Pendentes</CardTitle>
          </div>
          <CardDescription>Aprove ou rejeite solicitações de recuperação de senha</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Mail className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p>Nenhuma solicitação pendente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{request.email}</span>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Solicitado em{' '}
                      {format(new Date(request.requested_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => {
                        setSelectedRequest(request);
                        setAction('reject');
                      }}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Rejeitar
                    </Button>
                    <Button
                      size="sm"
                      variant="orange"
                      onClick={() => {
                        setSelectedRequest(request);
                        setAction('approve');
                      }}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Aprovar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico</CardTitle>
            <CardDescription>Solicitações já processadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {processedRequests.slice(0, 10).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{request.email}</span>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Processado em{' '}
                      {request.reviewed_at &&
                        format(new Date(request.reviewed_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                    </p>
                    {request.reviewer_notes && (
                      <p className="text-xs italic text-muted-foreground">
                        "{request.reviewer_notes}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={!!selectedRequest && !!action}
        onOpenChange={() => {
          setSelectedRequest(null);
          setAction(null);
          setNotes('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'Aprovar Solicitação' : 'Rejeitar Solicitação'}
            </DialogTitle>
            <DialogDescription>
              {action === 'approve'
                ? `Ao aprovar, um email de recuperação será enviado para ${selectedRequest?.email}`
                : `A solicitação de ${selectedRequest?.email} será rejeitada`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Observações (opcional)</label>
              <Textarea
                placeholder="Adicione uma observação..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setAction(null);
                setNotes('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant={action === 'approve' ? 'orange' : 'destructive'}
              onClick={handleAction}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : action === 'approve' ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Aprovar e Enviar Email
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Rejeitar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PasswordResetApproval;
