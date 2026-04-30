
import { Order, Pizza, User, SlotTime, Modification, PizzaFlag } from '../types';
import { GlobalSettings } from './db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './utils';

export interface HydratedOrder extends Order {
  user?: User;
  pizza?: Pizza;
  addMods: Modification[];
  removeMods: Modification[];
  flags: PizzaFlag[];
  dayDate?: string;
}

/**
 * Normalizza e ordina le varianti per creare una "Combo Key" univoca e leggibile.
 * Regole: Tutto in minuscolo, Aggiunte (+...) prima delle Rimozioni (senza...), ordine alfabetico interno.
 */
const getComboKey = (addMods: Modification[], removeMods: Modification[], flags: PizzaFlag[]): string => {
  if (addMods.length === 0 && removeMods.length === 0 && flags.length === 0) return "STANDARD";

  const adds = addMods
    .map(m => m.name.toLowerCase().replace(/^\+?\s*/, '').trim())
    .sort()
    .map(name => `+ ${name}`);

  const rems = removeMods
    .map(m => m.name.toLowerCase().replace(/^-?\s*/, '').trim())
    .sort()
    .map(name => `senza ${name}`);

  const flagTexts = flags
    .map(f => f.name.toLowerCase().trim())
    .sort()
    .map(name => `[${name}]`);

  return `(${[...adds, ...rems, ...flagTexts].join(', ')})`;
};

export const generateDayReportPDF = (
  date: string, 
  orders: HydratedOrder[], 
  slots: SlotTime[],
  settings?: GlobalSettings
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  
  const pdfTitle = settings?.pdf_title || "IN TAVOLA - PIZZA STAFF";
  const showSummary = settings?.pdf_show_summary !== false;
  const showList = settings?.pdf_show_list !== false;

  // --- CALCOLO DIMENSIONI ADATTIVE ---
  // Più ordini ci sono, più piccolo diventa il carattere per risparmiare spazio
  const getAdaptiveStyles = (count: number) => {
    if (count <= 35) return { fontSize: 11, lineSpacing: 7, summaryFontSize: 11, padding: 3 };
    if (count <= 60) return { fontSize: 9.5, lineSpacing: 5.5, summaryFontSize: 10, padding: 2.5 };
    if (count <= 85) return { fontSize: 8.5, lineSpacing: 4.5, summaryFontSize: 9, padding: 2 };
    return { fontSize: 7.5, lineSpacing: 3.8, summaryFontSize: 8, padding: 1.5 };
  };

  let isFirstPage = true;

  slots.forEach((currentSlot) => {
    const slotOrders = orders.filter(o => o.slotTime === currentSlot);
    if (slotOrders.length === 0) return;

    const styles = getAdaptiveStyles(slotOrders.length);

    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    // --- INTESTAZIONE (Stile schizzo) ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text(pdfTitle.toUpperCase(), margin, 20);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`DATA: ${formatDate(date)}`, margin, 30);
    doc.text(`ORARIO: ${currentSlot}`, pageWidth - margin, 30, { align: 'right' });

    doc.setLineWidth(0.5);
    doc.line(margin, 34, pageWidth - margin, 34);

    let yPos = 45;

    // --- SEZIONE: DOTALE PIZZE (Tabella) ---
    if (showSummary) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(styles.fontSize + 3);
      doc.text(`- TOTALE PIZZE: ${slotOrders.length}`, margin, yPos);
      yPos += 8;

      // Raggruppamento per nome pizza + combo varianti
      const pizzaGroups = new Map<string, number>();
      slotOrders.forEach(o => {
        const pName = o.pizza?.name || 'Sconosciuta';
        const combo = getComboKey(o.addMods, o.removeMods, o.flags);
        const fullName = combo === "STANDARD" ? pName : `${pName} ${combo}`;
        pizzaGroups.set(fullName, (pizzaGroups.get(fullName) || 0) + 1);
      });

      const summaryData = Array.from(pizzaGroups.entries())
        .sort((a, b) => b[1] - a[1]) // Ordina per quantità
        .map(([name, qty]) => [qty.toString(), name.toUpperCase()]);

      autoTable(doc, {
        startY: yPos,
        head: [['QUANTITÀ', 'PIZZA']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
        styles: { fontSize: styles.summaryFontSize, cellPadding: styles.padding, textColor: [0, 0, 0] },
        columnStyles: { 
          0: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
          1: { fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.1,
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // --- SEZIONE: ELENCO ---
    if (showList) {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(styles.fontSize + 3);
      doc.text("- ELENCO", margin, yPos);
      yPos += 10;

      const namesList = slotOrders.sort((a, b) => {
        const nameA = `${a.user?.firstName} ${a.user?.lastName}`.toLowerCase();
        const nameB = `${b.user?.firstName} ${b.user?.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(styles.fontSize);
      
      namesList.forEach(o => {
        if (yPos > pageHeight - 15) {
          doc.addPage();
          yPos = 20;
        }
        
        const combo = getComboKey(o.addMods, o.removeMods, o.flags);
        const comboDisplay = combo === "STANDARD" ? "" : ` ${combo}`;
        const name = `${o.user?.firstName} ${o.user?.lastName}`.padEnd(30, '.');
        const line = `${name} ${o.pizza?.name || '???'}${comboDisplay}`;
        
        doc.text(line, margin, yPos);
        yPos += styles.lineSpacing;
      });
    }
  });

  doc.save(`Report_InTavola_${date}.pdf`);
};

export const generateFullHistoryPDF = (orders: HydratedOrder[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  doc.setFontSize(22);
  doc.setTextColor(0, 122, 255);
  doc.text("IN TAVOLA - Storico Completo Ordini", 14, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Totale Ordini Estratti: ${orders.length}`, 14, 28);
  doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, pageWidth - 14, 28, { align: 'right' });

  const tableBody = orders.map(o => {
    const mods = [
      ...o.addMods.map(m => `+${m.name}`),
      ...o.removeMods.map(m => `-${m.name}`),
      ...(o.flags || []).map(f => `[${f.name}]`)
    ].join(", ");

    return [
      o.dayDate ? formatDate(o.dayDate) : '—',
      `${o.user?.firstName} ${o.user?.lastName}`,
      o.pizza?.name || '—',
      mods || '—',
      o.slotTime
    ];
  });

  autoTable(doc, {
    startY: 35,
    head: [['Data', 'Dipendente', 'Pizza', 'Variazioni', 'Ora']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [0, 122, 255] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 40 },
      2: { cellWidth: 35 }
    }
  });

  doc.save(`Storico_Completo_InTavola_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateHistoryCSV = (orders: HydratedOrder[]) => {
  const headers = ['Data', 'Dipendente', 'Pizza', 'Variazioni', 'Orario'];
  
  const rows = orders.map(o => {
    const mods = [
      ...o.addMods.map(m => `+${m.name}`),
      ...o.removeMods.map(m => `-${m.name}`),
      ...(o.flags || []).map(f => `[${f.name}]`)
    ].join(" | ");

    return [
      o.dayDate || '',
      `${o.user?.firstName} ${o.user?.lastName}`,
      o.pizza?.name || '',
      mods,
      o.slotTime
    ].map(field => `"${field.replace(/"/g, '""')}"`).join(",");
  });

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Storico_InTavola_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
