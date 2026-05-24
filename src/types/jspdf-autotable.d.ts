/**
 * Type declarations for jspdf-autotable plugin.
 * Eliminates doc.lastAutoTable pattern.
 */
import "jspdf";

declare module "jspdf" {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}
