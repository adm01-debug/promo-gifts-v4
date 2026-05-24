/**
 * CollectionDetailHeader — Header section for collection detail page.
 * Contains back button, collection info, CRM badge, share, export and action buttons.
 */
import { motion } from "framer-motion";
import { Monitor, Package, FileText, Clock, Users, Share2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExportCollectionButton } from "./ExportCollectionButton";
import type { Product } from "@/hooks/products";

interface CollectionInfo {
  name: string;
  description?: string;
  color: string;
  icon: string;
  clientName?: string | null;
}

interface CollectionDetailHeaderProps {
  collection: CollectionInfo;
  productCount: number;
  isLoading?: boolean;
  updatedAgo: string | null;
  products: Product[];
  variantMap?: Map<string, { color_name?: string | null; color_hex?: string | null; thumbnail?: string | null }>;
  notesMap?: Map<string, string | undefined>;
  onBack: () => void;
  onCreateQuote: () => void;
  onPresent: () => void;
  onShare?: () => void;
  showShare?: boolean;
}

export function CollectionDetailHeader({
  collection,
  productCount,
  isLoading,
  updatedAgo,
  products,
  variantMap,
  notesMap,
  onBack,
  onCreateQuote,
  onPresent,
  onShare,
  showShare,
}: CollectionDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center text-2xl shrink-0 border-[1.5px] border-primary/20"
          style={{ backgroundColor: `${collection.color}20` }}
        >
          {collection.icon}
        </motion.div>
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="text-muted-foreground mt-1">{collection.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              <Package className="h-3 w-3 mr-1" />
              {isLoading ? "Carregando..." : `${productCount} produtos`}
            </Badge>
            {collection.clientName && (
              <Badge variant="outline" className="border-primary/30 text-foreground">
                <Users className="h-3 w-3 mr-1 text-primary" />
                {collection.clientName}
              </Badge>
            )}
            {updatedAgo && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Atualizado {updatedAgo}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {productCount > 0 && (
            <>
              <Button
                className="gap-2 font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                onClick={onCreateQuote}
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Criar Orçamento</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <ExportCollectionButton
                products={products}
                variantMap={variantMap}
                notesMap={notesMap}
                collectionName={collection.name}
              />
              {showShare && onShare && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={onShare}>
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Compartilhar</span>
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onPresent}>
                <Monitor className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">Apresentar</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
