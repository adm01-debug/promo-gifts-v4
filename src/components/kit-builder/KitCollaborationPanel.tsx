/**
 * KitCollaborationPanel — convidar colaboradores + thread de comentários geral.
 */
import { useState } from 'react';
import { Users, Send, MessageSquare, X, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useKitCollaborators, useKitComments } from '@/hooks/kit-builder';
import { cn } from '@/lib/utils';

interface Props {
  kitId: string | undefined;
}

export function KitCollaborationPanel({ kitId }: Props) {
  const { collaborators, invite, remove } = useKitCollaborators(kitId);
  const { comments, postComment, resolveComment } = useKitComments(kitId);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'edit' | 'view'>('view');
  const [body, setBody] = useState('');

  if (!kitId) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Salve o kit para colaborar com sua equipe.
        </CardContent>
      </Card>
    );
  }

  const handleInvite = async () => {
    if (!email.trim()) return;
    try {
      await invite({ email: email.trim(), permission });
      setEmail('');
    } catch {
      /* toast handled */
    }
  };

  const handlePost = async () => {
    if (!body.trim()) return;
    await postComment({ body: body.trim() });
    setBody('');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-primary" /> Colaboração
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Convite */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Convidar colaborador</p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="email@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9"
            />
            <Select value={permission} onValueChange={(v) => setPermission(v as 'edit' | 'view')}>
              <SelectTrigger className="h-9 w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Ver</SelectItem>
                <SelectItem value="edit">Editar</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleInvite} disabled={!email.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {collaborators.length > 0 && (
            <ul className="space-y-1">
              {collaborators.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-xs"
                >
                  <span>{c.invited_email || c.user_id.slice(0, 8)}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      {c.permission}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => remove(c.id)}
                      aria-label="Remover colaborador"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Comentários */}
        <div className="space-y-2">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <MessageSquare className="h-3 w-3" /> Comentários ({comments.length})
          </p>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Deixe um comentário…"
            className="min-h-[60px] text-sm"
          />
          <Button size="sm" onClick={handlePost} disabled={!body.trim()} className="w-full">
            Comentar
          </Button>
          <ul className="max-h-[280px] space-y-2 overflow-y-auto">
            {comments.map((c) => (
              <li
                key={c.id}
                className={cn(
                  'space-y-1 rounded bg-muted/30 p-2 text-xs',
                  c.resolved && 'opacity-60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-muted-foreground">{c.author_id.slice(0, 8)}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {!c.resolved && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => resolveComment(c.id)}
                        aria-label="Marcar como resolvido"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <p>{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
