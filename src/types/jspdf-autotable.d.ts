/**
 * Type declarations for jspdf-autotable plugin.
 * Eliminates doc.lastAutoTable pattern.
 */

declare module "jspdf" {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}
