import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Send, Reply, Pencil, Trash2, CornerDownRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQuoteComments, type QuoteComment } from '@/hooks/quotes';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface QuoteCommentsSectionProps {
  quoteId: string;
}

export function QuoteCommentsSection({ quoteId }: QuoteCommentsSectionProps) {
  const { comments, isLoading, addComment, updateComment, deleteComment } =
    useQuoteComments(quoteId);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    await addComment(newComment.trim());
    setNewComment('');
    setIsSubmitting(false);
  };

  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
          Comentários
          {totalCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {totalCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            placeholder="Escreva um comentário..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none border-border bg-input focus:border-primary"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Ctrl+Enter para enviar</p>
          <Button
            onClick={handleSubmit}
            disabled={!newComment.trim() || isSubmitting}
            size="sm"
            className="gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && comments.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">Nenhum comentário ainda</p>
            <p className="text-xs">Seja o primeiro a comentar neste orçamento</p>
          </div>
        )}

        {comments.length > 0 && <Separator />}

        {/* Comment threads */}
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              onReply={addComment}
              onEdit={updateComment}
              onDelete={deleteComment}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CommentThread({
  comment,
  onReply,
  onEdit,
  onDelete,
}: {
  comment: QuoteComment;
  onReply: (content: string, parentId?: string) => Promise<void>;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <CommentItem comment={comment} onReply={onReply} onEdit={onEdit} onDelete={onDelete} />
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-8 space-y-2 border-l-2 border-border/50 pl-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  onReply,
  onEdit,
  onDelete,
  isReply = false,
}: {
  comment: QuoteComment;
  onReply: (content: string, parentId?: string) => Promise<void>;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isReply?: boolean;
}) {
  const { user } = useAuth();
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [editContent, setEditContent] = useState(comment.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAuthor = user?.id === comment.user_id;

  const initials = (comment.author_name || 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    setIsSubmitting(true);
    const parentId = comment.id; // always reply to top-level
    await onReply(replyContent.trim(), parentId);
    setReplyContent('');
    setIsReplying(false);
    setIsSubmitting(false);
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    setIsSubmitting(true);
    await onEdit(comment.id, editContent.trim());
    setIsEditing(false);
    setIsSubmitting(false);
  };

  return (
    <div
      className={cn(
        'group rounded-lg p-3 transition-colors hover:bg-muted/30',
        isReply && 'bg-muted/10',
      )}
    >
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={comment.author_avatar || undefined} />
          <AvatarFallback className="bg-primary/10 text-xs text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{comment.author_name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
            </span>
            {comment.is_internal && (
              <span className="text-xs italic text-muted-foreground">(interno)</span>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] resize-none bg-input text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleEdit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-line text-sm text-foreground/90">{comment.content}</p>
          )}

          {!isEditing && (
            <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {!isReply && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setIsReplying(!isReplying)}
                >
                  <Reply className="h-3 w-3" /> Responder
                </Button>
              )}
              {isAuthor && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => {
                      setIsEditing(true);
                      setEditContent(comment.content);
                    }}
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => onDelete(comment.id)}
                  >
                    <Trash2 className="h-3 w-3" /> Excluir
                  </Button>
                </>
              )}
            </div>
          )}

          {isReplying && (
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2">
                <CornerDownRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <Textarea
                  placeholder="Escreva uma resposta..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="min-h-[60px] resize-none bg-input text-sm"
                  autoFocus
                />
              </div>
              <div className="ml-6 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsReplying(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={!replyContent.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  <span className="ml-1">Responder</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
