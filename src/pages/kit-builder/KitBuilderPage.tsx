import { lazy, Suspense } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { useKitBuilderPageState } from '@/hooks/kit-builder';
import { Card, CardContent } from '@/components/ui/card';
import { WizardSteps, BoxSelector, ItemSelector, KitSummary } from '@/components/kit-builder';
import { KitBuilderHeader } from '@/components/kit-builder/KitBuilderHeader';
import { KitHeroPricingCard } from '@/components/kit-builder/KitHeroPricingCard';

const KitIsometricPreview = lazy(() =>
  import('@/components/kit-builder/KitIsometricPreview').then((m) => ({
    default: m.KitIsometricPreview,
  })),
);

export default function KitBuilderPage() {
  const { state, actions, meta } = useKitBuilderPageState();

  return (
    <div
      className="relative min-h-screen"
      style={{
        background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, hsl(var(--primary) / 0.08), transparent),
            radial-gradient(ellipse 60% 40% at 100% 100%, hsl(var(--primary) / 0.04), transparent),
            hsl(var(--background))
          `,
      }}
    >
      <PageSEO
        title="Kit Maker"
        description="Monte kits personalizados."
        path="/kit-builder"
        noIndex
      />

      <KitBuilderHeader
        kitName={state.kitState.name}
        onKitNameChange={actions.setKitName}
        isValid={state.kitState.isValid}
        isSaving={meta.isSaving}
        isAutoSaving={meta.isAutoSaving}
        lastSavedAt={meta.lastSavedAt}
        hasContent={!!state.kitState.box || state.kitState.items.length > 0}
        isExistingKit={!!(state.currentKitId || state.autoSavedKitId)}
        canUndo={actions.canUndo}
        canRedo={actions.canRedo}
        identity={state.kitState.identity}
        onIdentityChange={actions.setIdentity}
        onSave={actions.handleSaveKit}
        onUndo={actions.undo}
        onRedo={actions.redo}
        onReset={actions.resetKit}
        kitState={state.kitState}
        onAIApply={() => {}}
      />

      <div className="border-b bg-card/40 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[1920px] px-3 py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8">
          <WizardSteps
            currentStep={state.wizardState.currentStep}
            completedSteps={state.wizardState.completedSteps}
            onStepClick={actions.goToStep}
            kitState={state.kitState}
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1920px] animate-fade-in px-3 py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
              <CardContent className="p-6">
                {state.wizardState.currentStep === 'box' && (
                  <BoxSelector
                    selectedBox={state.kitState.box}
                    onSelect={actions.selectBox}
                    onClear={actions.clearBox}
                    boxes={state.availableBoxes}
                    isLoading={state.isLoadingBoxes}
                    filters={state.boxFilters}
                    onFiltersChange={state.setBoxFilters}
                  />
                )}
                {state.wizardState.currentStep === 'items' && (
                  <ItemSelector
                    selectedItems={state.kitState.items}
                    onAddItem={actions.addItem}
                    onRemoveItem={actions.removeItem}
                    onUpdateQuantity={actions.updateItemQuantity}
                    onUpdateVariant={actions.updateItemVariant}
                    items={state.availableItems}
                    isLoading={state.isLoadingItems}
                    filters={state.itemFilters}
                    onFiltersChange={state.setItemFilters}
                    boxSelected={!!state.kitState.box}
                  />
                )}
                {state.wizardState.currentStep === 'summary' && (
                  <KitSummary
                    kitState={state.kitState}
                    kitQuantity={state.kitQuantity}
                    kitName={state.kitState.name}
                    onKitNameChange={actions.setKitName}
                    onKitQuantityChange={actions.setKitQuantity}
                    onExportPDF={() => {}}
                    onAddToQuote={() => {
                      void actions.handleAddToQuote(state.kitState, state.kitQuantity);
                    }}
                    isAddingToQuote={meta.isCreatingQuote}
                    currentKitId={state.currentKitId}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-1">
            <KitHeroPricingCard
              unitPrice={meta.pricing.unitPrice}
              total={meta.pricing.total}
              kitQuantity={state.kitQuantity}
              isValid={state.kitState.isValid}
              hasContent={!!state.kitState.box || state.kitState.items.length > 0}
            />
            <Suspense
              fallback={<div className="aspect-square animate-pulse rounded-2xl bg-muted" />}
            >
              <KitIsometricPreview kitState={state.kitState} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
