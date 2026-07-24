/**
 * SuppliersManager — Orchestrator component.
 * Logic extracted to useSuppliersManager hook.
 * UI split into SupplierListHeader, SupplierTable, SupplierFormDialog.
 *
 * BUG-04 FIX: AlertDialog for delete confirmation (replaced native confirm())
 */
import { useSuppliersManager } from './useSuppliersManager';
import { SupplierListHeader } from './SupplierListHeader';
import { SupplierTable } from './SupplierTable';
import { SupplierFormDialog } from './SupplierFormDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export function SuppliersManager() {
  const m = useSuppliersManager();

  return (
    <div className="space-y-4">
      <SupplierListHeader
        search={m.search}
        setSearch={m.setSearch}
        filterType={m.filterType}
        setFilterType={m.setFilterType}
        filterStatus={m.filterStatus}
        setFilterStatus={m.setFilterStatus}
        loading={m.loading}
        totalCount={m.suppliers.length}
        filteredCount={m.filtered.length}
        showFilteredBadge={!!(m.search || m.filterType !== 'all' || m.filterStatus !== 'all')}
        onRefresh={m.fetchSuppliers}
        onNew={m.handleNew}
      />
      <SupplierTable
        suppliers={m.filtered}
        loading={m.loading}
        search={m.search}
        deleting={m.deleting}
        onEdit={m.handleEdit}
        onDelete={m.handleDelete}
      />
      <SupplierFormDialog
        editingSupplier={m.editingSupplier}
        setEditingSupplier={m.setEditingSupplier}
        isNew={m.isNew}
        saving={m.saving}
        cnpjError={m.cnpjError}
        uploadingLogo={m.uploadingLogo}
        fetchingCnpj={m.fetchingCnpj}
        contacts={m.contacts}
        formaPagamento={m.formaPagamento}
        setFormaPagamento={m.setFormaPagamento}
        pixKeys={m.pixKeys}
        foneFixo1={m.foneFixo1}
        setFoneFixo1={m.setFoneFixo1}
        foneFixo2={m.foneFixo2}
        setFoneFixo2={m.setFoneFixo2}
        inscricaoEstadual={m.inscricaoEstadual}
        setInscricaoEstadual={m.setInscricaoEstadual}
        regimeTributario={m.regimeTributario}
        setRegimeTributario={m.setRegimeTributario}
        estadoFaturamento={m.estadoFaturamento}
        setEstadoFaturamento={m.setEstadoFaturamento}
        transportadoraPadrao={m.transportadoraPadrao}
        setTransportadoraPadrao={m.setTransportadoraPadrao}
        transportadoraId={m.transportadoraId}
        setTransportadoraId={m.setTransportadoraId}
        carrierSearch={m.carrierSearch}
        setCarrierSearch={m.setCarrierSearch}
        carrierResults={m.carrierResults}
        searchingCarriers={m.searchingCarriers}
        showCarrierDropdown={m.showCarrierDropdown}
        setShowCarrierDropdown={m.setShowCarrierDropdown}
        searchCarriers={m.searchCarriers}
        carrierSearchTimeout={m.carrierSearchTimeout}
        logoInputRef={m.logoInputRef}
        updateField={m.updateField}
        handleSave={m.handleSave}
        handleLogoUpload={m.handleLogoUpload}
        handleCnpjLookup={m.handleCnpjLookup}
        handleCepLookup={m.handleCepLookup}
        updateContact={m.updateContact}
        addContact={m.addContact}
        removeContact={m.removeContact}
        updatePixKey={m.updatePixKey}
        addPixKey={m.addPixKey}
        removePixKey={m.removePixKey}
      />

      {/* BUG-04 FIX: state-driven confirm instead of native confirm() */}
      <ConfirmDialog
        open={!!m.deleteConfirmSupplier}
        onOpenChange={(open) => {
          if (!open) m.cancelDelete();
        }}
        variant="destructive"
        title="Excluir fornecedor?"
        description={`Deseja realmente excluir o fornecedor "${m.deleteConfirmSupplier?.name ?? ''}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={m.confirmDelete}
        onCancel={m.cancelDelete}
        testId="admin-confirm-delete-dialog"
      />
    </div>
  );
}
