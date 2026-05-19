import { useState } from "react";
import { motion } from "framer-motion";
import {
  Heart, Plus, MoreVertical, Pencil, Trash2, Share2, Archive, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FavoriteList } from "@/hooks/favoritesLists";
import { CreateListDialog } from "./CreateListDialog";
import { ShareListDialog } from "./ShareListDialog";
import { DeleteConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Props {
  lists: FavoriteList[];
  selectedListId: string | null;
  onSelectList: (id: string) => void;
  onCreateList: (input: { name: string; color: string; icon: string; description?: string }) => Promise<void>;
  onUpdateList: (id: string, patch: Partial<FavoriteList>) => Promise<void>;
  onDeleteList: (id: string) => Promise<void>;
  onShareList: (id: string, days: number) => Promise<FavoriteList>;
  onRevokeShare: (id: string) => Promise<void>;
  trashCount?: number;
  showTrash: boolean;
  onToggleTrash: (show: boolean) => void;
}

export function FavoriteListsSidebar({
  lists, selectedListId, onSelectList,
  onCreateList, onUpdateList, onDeleteList,
  onShareList, onRevokeShare,
  trashCount = 0, showTrash, onToggleTrash,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editList, setEditList] = useState<FavoriteList | null>(null);
  const [shareList, setShareList] = useState<FavoriteList | null>(null);
  const [deleteList, setDeleteList] = useState<FavoriteList | null>(null);

  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-2">
      <div className="flex items-center justify-between px-2 mb-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Minhas Listas
        </h2>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setCreateOpen(true)}
          aria-label="Nova lista"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1">
        {lists.map((list) => {
          const isActive = !showTrash && selectedListId === list.id;
          return (
            <motion.div
              key={list.id}
              whileHover={{ x: 2 }}
              className={cn(
                "group relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all",
                isActive
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted/50 border border-transparent"
              )}
              onClick={() => { onToggleTrash(false); onSelectList(list.id); }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${list.color}20`, color: list.color }}
              >
                <Heart className="h-4 w-4" fill="currentColor" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    isActive ? "text-foreground" : "text-foreground/80"
                  )}>
                    {list.name}
                  </p>
                  {list.is_default && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">padrão</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{list.item_count ?? 0} {list.item_count === 1 ? "item" : "itens"}</span>
                  {list.client_name && (
                    <span className="flex items-center gap-0.5 truncate">
                      <Users className="h-2.5 w-2.5" />
                      {list.client_name}
                    </span>
                  )}
                  {list.shared_token && (
                    <span className="flex items-center gap-0.5 text-primary">
                      <Share2 className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Opções da lista"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setEditList(list)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShareList(list)}>
                    <Share2 className="h-3.5 w-3.5 mr-2" /> Compartilhar
                  </DropdownMenuItem>
                  {!list.is_default && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onUpdateList(list.id, { is_archived: true })}
                      >
                        <Archive className="h-3.5 w-3.5 mr-2" /> Arquivar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteList(list)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir lista
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          );
        })}
      </div>

      {/* Lixeira */}
      <div className="pt-2 mt-2 border-t border-border/50">
        <button
          onClick={() => onToggleTrash(!showTrash)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors",
            showTrash
              ? "bg-muted text-foreground border border-border"
              : "text-muted-foreground hover:bg-muted/40"
          )}
        >
          <Trash2 className="h-4 w-4" />
          <span className="flex-1 text-left">Lixeira</span>
          {trashCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{trashCount}</Badge>
          )}
        </button>
        <p className="text-[10px] text-muted-foreground/70 px-2 mt-1">
          Itens removidos ficam aqui por 30 dias
        </p>
      </div>

      <CreateListDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={onCreateList}
      />
      {editList && (
        <CreateListDialog
          open={!!editList}
          onOpenChange={(o) => !o && setEditList(null)}
          existing={editList}
          onCreate={async (data) => {
            await onUpdateList(editList.id, data);
            setEditList(null);
          }}
        />
      )}
      {shareList && (
        <ShareListDialog
          open={!!shareList}
          onOpenChange={(o) => !o && setShareList(null)}
          list={shareList}
          onShare={onShareList}
          onRevoke={onRevokeShare}
        />
      )}
      <DeleteConfirmDialog
        open={!!deleteList}
        onOpenChange={(o) => !o && setDeleteList(null)}
        entityName="lista de favoritos"
        itemName={deleteList?.name}
        onConfirm={async () => {
          if (deleteList) {
            await onDeleteList(deleteList.id);
            setDeleteList(null);
          }
        }}
      />
    </aside>
  );
}
