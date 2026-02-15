
import { Order, Pizza, User, SlotTime, Modification } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './utils';

export interface HydratedOrder extends Order {
  user?: User;
  pizza?: Pizza;
  addMods: Modification[];
  removeMods: Modification[];
  dayDate?: string;
}

/**
 * Normalizza e ordina le varianti per creare una "Combo Key" univoca e leggibile.
 * Regole: Tutto in minuscolo, Aggiunte (+...) prima delle Rimozioni (senza...), ordine alfabetico interno.
 */
const getComboKey = (addMods: Modification[], removeMods: Modification[]): string => {
  if (addMods.length === 0 && removeMods.length === 0) return "STANDARD";

  const adds = addMods
    .map(m => m.name.toLowerCase().replace(/^\+?\s*/, '').trim())
    .sort()
    .map(name => `+ ${name}`);

  const rems = removeMods
    .map(m => m.name.toLowerCase().replace(/^-?\s*/, '').trim())
    .sort()
    .map(name => `senza ${name}`);

  return `(${[...adds, ...rems].join(', ')})`;
};

export const generateDayReportPDF = (
  date: string, 
  orders: HydratedOrder[], 
  slots: SlotTime[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  let isFirstPage = true;

  // Helper per stampare l'header di ogni pagina
  const printHeader = (slot: string, slotTotal: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text("IN TAVOLA – Report Pizze Staff", margin, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const headerRow2Y = 28;
    doc.text(`Data: ${formatDate(date)}`, margin, headerRow2Y);
    doc.text(`Slot: ${slot}`, pageWidth / 2, headerRow2Y, { align: 'center' });
    doc.text(`Totale slot: ${slotTotal}`, pageWidth - margin, headerRow2Y, { align: 'right' });

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 32, pageWidth - margin, 32);
    return 42; // yPos iniziale dopo l'header
  };

  // Iterazione per Slot Orario
  slots.forEach((currentSlot) => {
    const slotOrders = orders.filter(o => o.slotTime === currentSlot);
    if (slotOrders.length === 0) return;

    // Ogni slot inizia SEMPRE su una nuova pagina
    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    let yPos = printHeader(currentSlot, slotOrders.length);

    // --- SEZIONE A: RIEPILOGO PRODUZIONE ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("SEZIONE A — RIEPILOGO PRODUZIONE", margin, yPos);
    yPos += 8;

    const pizzaCounts = new Map<string, number>();
    slotOrders.forEach(o => {
      const pName = o.pizza?.name || 'Sconosciuta';
      pizzaCounts.set(pName, (pizzaCounts.get(pName) || 0) + 1);
    });

    const summaryData = Array.from(pizzaCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty]) => [name, qty.toString()]);

    autoTable(doc, {
      startY: yPos,
      head: [['Pizza', 'Quantità']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 12 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', cellWidth: 30 } },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // --- SEZIONE B: VARIANTI SEMPLIFICATE (COMBO) ---
    if (yPos > pageHeight - 40) { doc.addPage(); yPos = printHeader(currentSlot, slotOrders.length); }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SEZIONE B — VARIANTI PER PIZZA", margin, yPos);
    yPos += 10;

    // Raggruppamento: PizzaName -> Map<ComboKey, Count>
    const comboGroups = new Map<string, Map<string, number>>();
    
    slotOrders.forEach(o => {
      const pName = o.pizza?.name || 'Sconosciuta';
      const combo = getComboKey(o.addMods, o.removeMods);
      
      if (!comboGroups.has(pName)) comboGroups.set(pName, new Map());
      const pMap = comboGroups.get(pName)!;
      pMap.set(combo, (pMap.get(combo) || 0) + 1);
    });

    comboGroups.forEach((combos, pName) => {
      const totalForThisPizza = Array.from(combos.values()).reduce((a, b) => a + b, 0);
      
      if (yPos > pageHeight - 30) { doc.addPage(); yPos = printHeader(currentSlot, slotOrders.length); }
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 122, 255);
      doc.text(`${pName.toUpperCase()} (Totale ${totalForThisPizza})`, margin, yPos);
      yPos += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);

      // Ordina le combo mettendo STANDARD per prima
      const sortedCombos = Array.from(combos.entries()).sort((a, b) => {
        if (a[0] === "STANDARD") return -1;
        if (b[0] === "STANDARD") return 1;
        return a[0].localeCompare(b[0]);
      });

      sortedCombos.forEach(([comboText, count]) => {
        if (yPos > pageHeight - 15) { doc.addPage(); yPos = printHeader(currentSlot, slotOrders.length); }
        doc.text(`- ${count} ${comboText}`, margin + 5, yPos);
        yPos += 5;
      });
      yPos += 5;
    });

    yPos += 5;

    // --- SEZIONE C: ELENCO NOMI ---
    if (yPos > pageHeight - 30) { doc.addPage(); yPos = printHeader(currentSlot, slotOrders.length); }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("SEZIONE C — ELENCO DISTRIBUZIONE", margin, yPos);
    yPos += 10;

    const namesList = slotOrders
      .sort((a, b) => {
        const nameA = `${a.user?.firstName} ${a.user?.lastName}`.toLowerCase();
        const nameB = `${b.user?.firstName} ${b.user?.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);

    namesList.forEach(o => {
      if (yPos > pageHeight - 15) { doc.addPage(); yPos = printHeader(currentSlot, slotOrders.length); }
      
      const combo = getComboKey(o.addMods, o.removeMods);
      const comboDisplay = combo === "STANDARD" ? "" : ` ${combo}`;
      const line = `${o.user?.firstName} ${o.user?.lastName} – ${o.pizza?.name || '???'}${comboDisplay}`;
      
      doc.text(line, margin, yPos);
      yPos += 6;
    });
  });

  doc.save(`Report_Cucina_${date}.pdf`);
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
      ...o.removeMods.map(m => `-${m.name}`)
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
      ...o.removeMods.map(m => `-${m.name}`)
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
