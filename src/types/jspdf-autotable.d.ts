/**
 * Type declarations for jspdf-autotable plugin.
 * Eliminates doc.lastAutoTable pattern.
 */
import 'jspdf';

declare module 'jspdf' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}
