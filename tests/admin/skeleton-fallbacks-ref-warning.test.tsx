/**
 * Regressão: nenhum skeleton fallback (SkeletonLoaders) deve disparar o
 * warning "Function components cannot be given refs" — nem renderizado
 * diretamente, nem como `fallback` de <Suspense>, nem via getFallback().
 *
 * Cobertura:
 *  - render direto de cada skeleton exportado;
 *  - render como fallback de <Suspense> com filho que suspende (Promise pendente);
 *  - render via helper getFallback() para várias rotas representativas.
 */
import { describe, it, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as React from "react";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { installReactWarningGuard } from "../helpers/react-warning-guard";
import {
  CatalogSkeleton,
  ProductDetailSkeleton,
  QuotesSkeleton,
  AdminSkeleton,
  DashboardSkeleton,
  ToolsSkeleton,
  ProfileSkeleton,
  GenericSkeleton,
  getFallback,
} from "@/components/layout/SkeletonLoaders";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// SkeletonMonitor (envolvido por makeSkeleton) chama useAuth() para decidir
// se mostra o overlay de debug do tempo de skeleton. Em testes de renderização
// isolada, não temos AuthProvider — mockamos com um stub mínimo.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ userRole: null, user: null, isLoading: false }),
}));


afterEach(() => cleanup());

const SKELETONS = [
  ["CatalogSkeleton", CatalogSkeleton],
  ["ProductDetailSkeleton", ProductDetailSkeleton],
  ["QuotesSkeleton", QuotesSkeleton],
  ["AdminSkeleton", AdminSkeleton],
  ["DashboardSkeleton", DashboardSkeleton],
  ["ToolsSkeleton", ToolsSkeleton],
  ["ProfileSkeleton", ProfileSkeleton],
  ["GenericSkeleton", GenericSkeleton],
] as const;

const ROUTES = [
  "/",
  "/produtos",
  "/produto/abc-123",
  "/orcamentos",
  "/admin/usuarios",
  "/dashboard",
  "/pedidos",
  "/montar-kit",
  "/perfil",
  "/qualquer-coisa",
];

/** Componente que suspende indefinidamente — força o fallback do <Suspense>. */
function SuspendForever(): never {
  throw new Promise(() => {
    /* never resolves */
  });
}

describe("SkeletonLoaders — nenhum ref warning", () => {
  it.each(SKELETONS)("render direto: %s", (_name, Cmp) => {
    const guard = installReactWarningGuard();
    try {
      render(<Cmp />);
      guard.expectNoRefWarning(`render direto de ${_name}`);
    } finally {
      guard.dispose();
    }
  });

  it.each(SKELETONS)("como fallback de <Suspense>: %s", (_name, Cmp) => {
    const guard = installReactWarningGuard();
    try {
      render(
        <Suspense fallback={<Cmp />}>
          <SuspendForever />
        </Suspense>,
      );
      guard.expectNoRefWarning(`<Suspense fallback={<${_name} />}>`);
    } finally {
      guard.dispose();
    }
  });

  it.each(ROUTES)("getFallback('%s') não dispara warning", (path) => {
    const guard = installReactWarningGuard();
    try {
      render(
        <Suspense fallback={getFallback(path)}>
          <SuspendForever />
        </Suspense>,
      );
      guard.expectNoRefWarning(`getFallback('${path}')`);
    } finally {
      guard.dispose();
    }
  });
});

// =====================================================================
// Cenários adicionais — gatilhos históricos do warning de ref:
//   1. Skeleton como child de Radix `*Trigger asChild` (Tooltip, Popover,
//      Dialog, AlertDialog, DropdownMenu). Radix injeta ref via Slot —
//      um function component sem forwardRef quebra; um forwardRef passa.
//   2. Skeleton dentro de `motion.div` / `AnimatePresence` (framer-motion
//      também injeta ref interna).
//   3. Skeleton como fallback de Suspense ANINHADO sob um Trigger asChild
//      e dentro de motion — combinação que apareceu em produção.
// =====================================================================

/** Renderiza com providers necessários (TooltipProvider). */
function renderWithProviders(ui: React.ReactNode) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

describe("SkeletonLoaders — sob Radix `asChild` (Tooltip/Popover/Dialog/AlertDialog/DropdownMenu)", () => {
  it.each(SKELETONS)("TooltipTrigger asChild com %s", (_name, Cmp) => {
    const guard = installReactWarningGuard();
    try {
      renderWithProviders(
        <Tooltip>
          <TooltipTrigger asChild>
            <Cmp />
          </TooltipTrigger>
          <TooltipContent>info</TooltipContent>
        </Tooltip>,
      );
      guard.expectNoRefWarning(`TooltipTrigger asChild > ${_name}`);
    } finally {
      guard.dispose();
    }
  });

  it.each(SKELETONS)("PopoverTrigger asChild com %s", (_name, Cmp) => {
    const guard = installReactWarningGuard();
    try {
      render(
        <Popover>
          <PopoverTrigger asChild>
            <Cmp />
          </PopoverTrigger>
          <PopoverContent>conteúdo</PopoverContent>
        </Popover>,
      );
      guard.expectNoRefWarning(`PopoverTrigger asChild > ${_name}`);
    } finally {
      guard.dispose();
    }
  });

  it.each(SKELETONS)("DialogTrigger asChild com %s", (_name, Cmp) => {
    const guard = installReactWarningGuard();
    try {
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Cmp />
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>t</DialogTitle>
          </DialogContent>
        </Dialog>,
      );
      guard.expectNoRefWarning(`DialogTrigger asChild > ${_name}`);
    } finally {
      guard.dispose();
    }
  });

  it.each(SKELETONS)("AlertDialogTrigger asChild com %s", (_name, Cmp) => {
    const guard = installReactWarningGuard();
    try {
      render(
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Cmp />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>t</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>,
      );
      guard.expectNoRefWarning(`AlertDialogTrigger asChild > ${_name}`);
    } finally {
      guard.dispose();
    }
  });

  it.each(SKELETONS)("DropdownMenuTrigger asChild com %s", (_name, Cmp) => {
    const guard = installReactWarningGuard();
    try {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Cmp />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>x</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
      guard.expectNoRefWarning(`DropdownMenuTrigger asChild > ${_name}`);
    } finally {
      guard.dispose();
    }
  });
});

describe("SkeletonLoaders — dentro de framer-motion (motion.div / AnimatePresence)", () => {
  it.each(SKELETONS)("motion.div > %s (filho direto)", (_name, Cmp) => {
    const guard = installReactWarningGuard();
    try {
      render(
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Cmp />
        </motion.div>,
      );
      guard.expectNoRefWarning(`motion.div > ${_name}`);
    } finally {
      guard.dispose();
    }
  });

  it.each(SKELETONS)("AnimatePresence > motion.div > %s", (_name, Cmp) => {
    const guard = installReactWarningGuard();
    try {
      render(
        <AnimatePresence mode="wait">
          <motion.div
            key="k"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Cmp />
          </motion.div>
        </AnimatePresence>,
      );
      guard.expectNoRefWarning(`AnimatePresence > motion.div > ${_name}`);
    } finally {
      guard.dispose();
    }
  });

  it.each(SKELETONS)(
    "motion.div como fallback de <Suspense> envolvendo %s",
    (_name, Cmp) => {
      const guard = installReactWarningGuard();
      try {
        render(
          <Suspense
            fallback={
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Cmp />
              </motion.div>
            }
          >
            <SuspendForever />
          </Suspense>,
        );
        guard.expectNoRefWarning(`Suspense<motion.div<${_name}>>`);
      } finally {
        guard.dispose();
      }
    },
  );
});

describe("SkeletonLoaders — combinação Radix asChild + motion + Suspense (cenário do preview real)", () => {
  it.each(SKELETONS)(
    "TooltipTrigger asChild > motion.div > Suspense fallback=%s",
    (_name, Cmp) => {
      const guard = installReactWarningGuard();
      try {
        renderWithProviders(
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                type="button"
                initial={{ scale: 0.98 }}
                animate={{ scale: 1 }}
              >
                <Suspense fallback={<Cmp />}>
                  <SuspendForever />
                </Suspense>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent>tip</TooltipContent>
          </Tooltip>,
        );
        guard.expectNoRefWarning(
          `Tooltip asChild > motion.button > Suspense<${_name}>`,
        );
      } finally {
        guard.dispose();
      }
    },
  );

  it.each(ROUTES)(
    "PopoverTrigger asChild > motion.div > getFallback('%s')",
    (path) => {
      const guard = installReactWarningGuard();
      try {
        render(
          <Popover>
            <PopoverTrigger asChild>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Suspense fallback={getFallback(path)}>
                  <SuspendForever />
                </Suspense>
              </motion.div>
            </PopoverTrigger>
            <PopoverContent>x</PopoverContent>
          </Popover>,
        );
        guard.expectNoRefWarning(
          `Popover asChild > motion.div > Suspense<getFallback('${path}')>`,
        );
      } finally {
        guard.dispose();
      }
    },
  );
});
