import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { dbInvoke } from '@/lib/db/postgrest';
import { toTitleCase } from '@/lib/textUtils';

import { logger } from '@/lib/logger';
const HIDDEN_CATEGORIES = ['GRAVAÇÃO | MOCHILA', 'GRAVACAO | MOCHILA'];

export interface CategoryTreeItem {
  id: string;
  bitrix_id?: string;
  name: string;
  level: number;
  parent_id: string | null;
  tree_structure?: string;
  sort_path?: string;
  icon?: string;
}

export interface CategoryNode extends CategoryTreeItem {
  children: CategoryNode[];
  productCount?: number;
  isExpanded?: boolean;
}

export interface CategoryOption {
  value: string;
  label: string;
  level: number;
  parent_id: string | null;
  indent: string;
}

interface CategoryIcon {
  category_name: string;
  icon: string;
}

export function useCategoriesTree() {
  const [categories, setCategories] = useState<CategoryTreeItem[]>([]);
  const [categoryIcons, setCategoryIcons] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategoryIcons = useCallback(async () => {
    try {
      const { data, error: iconsError } = await supabase
        .from('category_icons')
        .select('category_name, icon')
        .eq('is_active', true);
      if (iconsError) throw iconsError;
      const iconMap = new Map<string, string>();
      ((data as CategoryIcon[]) || []).forEach((item) => {
        iconMap.set(item.category_name.toUpperCase(), item.icon);
      });
      setCategoryIcons(iconMap);
    } catch (err) {
      logger.error('Erro ao buscar ícones de categorias:', err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // FIX-CATALOG-06 (2026-06-01): was calling supabase.functions.invoke('external-db-bridge')
      // directly — bridge is permanently OFF (kill-switch enabled=false, rollout=100).
      // Replaced with dbInvoke() which routes directly to PostgREST (REST native).
      const result = await dbInvoke<CategoryTreeItem>({
        table: 'categories_tree_visual',
        operation: 'select',
        select: '*',
        orderBy: { column: 'sort_path', ascending: true },
        limit: 500,
      });
      const formattedCategories = (result.records || [])
        .filter((cat: CategoryTreeItem) => !HIDDEN_CATEGORIES.includes(cat.name.toUpperCase()))
        .map((cat: CategoryTreeItem) => ({ ...cat, name: toTitleCase(cat.name) }));
      setCategories(formattedCategories);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      logger.error('Erro ao buscar árvore de categorias:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchCategoryIcons();
  }, [fetchCategories, fetchCategoryIcons]);

  const tree = useMemo((): CategoryNode[] => {
    if (categories.length === 0) return [];
    const nodeMap = new Map<string, CategoryNode>();
    const roots: CategoryNode[] = [];
    categories.forEach((cat) => {
      const isRoot = cat.level === 1 || !cat.parent_id;
      const normalizedName = cat.name.toUpperCase();
      const icon = isRoot ? categoryIcons.get(normalizedName) : undefined;
      nodeMap.set(cat.id, { ...cat, icon, children: [], isExpanded: false });
    });
    categories.forEach((cat) => {
      const node = nodeMap.get(cat.id);
      if (!node) return;
      if (cat.parent_id) {
        const parentNode = nodeMap.get(cat.parent_id);
        if (parentNode) {
          if (!parentNode.children.find((c) => c.id === node.id)) parentNode.children.push(node);
        } else roots.push(node);
      } else roots.push(node);
    });
    const sortChildren = (nodes: CategoryNode[]) => {
      nodes.sort((a, b) => {
        if (a.sort_path && b.sort_path) {
          const aPath = Array.isArray(a.sort_path) ? a.sort_path.join('-') : String(a.sort_path);
          const bPath = Array.isArray(b.sort_path) ? b.sort_path.join('-') : String(b.sort_path);
          return aPath.localeCompare(bPath);
        }
        return a.name.localeCompare(b.name);
      });
      nodes.forEach((node) => {
        if (node.children.length > 0) sortChildren(node.children);
      });
    };
    sortChildren(roots);
    return roots;
  }, [categories, categoryIcons]);

  const categoriesByLevel = useMemo(() => {
    const byLevel: Record<number, CategoryTreeItem[]> = {};
    categories.forEach((cat) => {
      if (!byLevel[cat.level]) byLevel[cat.level] = [];
      byLevel[cat.level].push(cat);
    });
    return byLevel;
  }, [categories]);

  const selectOptions = useMemo((): CategoryOption[] => {
    return categories.map((cat) => ({
      value: cat.id,
      label: cat.name,
      level: cat.level,
      parent_id: cat.parent_id,
      indent: '─'.repeat(cat.level - 1),
    }));
  }, [categories]);

  const getChildren = useCallback(
    (parentId: string): CategoryTreeItem[] => {
      return categories.filter((cat) => cat.parent_id === parentId);
    },
    [categories],
  );

  const getPath = useCallback(
    (categoryId: string): CategoryTreeItem[] => {
      const path: CategoryTreeItem[] = [];
      let current = categories.find((cat) => cat.id === categoryId);
      while (current) {
        path.unshift(current);
        if (current.parent_id) {
          current = categories.find((cat) => cat.id === current?.parent_id);
        } else {
          current = undefined;
        }
      }
      return path;
    },
    [categories],
  );

  const searchCategories = useCallback(
    (query: string): CategoryTreeItem[] => {
      if (!query.trim()) return [];
      const lowerQuery = query.toLowerCase();
      return categories.filter((cat) => cat.name.toLowerCase().includes(lowerQuery));
    },
    [categories],
  );

  const stats = useMemo(
    () => ({
      total: categories.length,
      levels: Object.keys(categoriesByLevel).length,
      roots: tree.length,
    }),
    [categories, categoriesByLevel, tree],
  );

  return {
    categories,
    tree,
    categoriesByLevel,
    selectOptions,
    stats,
    isLoading,
    error,
    fetchCategories,
    getChildren,
    getPath,
    searchCategories,
  };
}

export function useCategorySelection(initialCategoryId?: string) {
  const { categories, getPath } = useCategoriesTree();
  const [selectedId, setSelectedId] = useState<string | null>(initialCategoryId || null);
  const selectedCategory = useMemo(() => {
    if (!selectedId) return null;
    return categories.find((cat) => cat.id === selectedId) || null;
  }, [categories, selectedId]);
  const breadcrumb = useMemo(() => {
    if (!selectedId) return [];
    return getPath(selectedId);
  }, [selectedId, getPath]);
  return { selectedId, setSelectedId, selectedCategory, breadcrumb };
}
