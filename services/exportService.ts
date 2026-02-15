
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
 * Normalizza il testo della variazione per la stampa (es. -MOZZARELLA -> senza mozzarella)
 */
const normalizeModText = (mod: Modification): string => {
  const name = mod.name.toLowerCase().trim();
  if (mod.type === 'REMOVE') {
    // Rimuove eventuali trattini iniziali se presenti nel nome salvato
    const cleanName = name.startsWith('-') ? name.substring(1).trim() : name;
    return `senza ${cleanName}`;
  } else {
    const cleanName = name.startsWith('+') ? name.substring(1).trim() : name;
    return `+ ${cleanName}`;
  }
};

export const generateDayReportPDF = (
  date: string, 
  orders: HydratedOrder[], 
  slots: SlotTime[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;
  let yPos = 20;

  // --- HEADER ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(0, 122, 255);
  doc.text("IN TAVOLA – Report Pizze Staff", margin, yPos);
  
  yPos += 10;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Data: ${formatDate(date)}`, margin, yPos);
  doc.text(`Totale Pizze: ${orders.length}`, pageWidth - margin, yPos, { align: 'right' });

  yPos += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // --- LOGICA DI RAGGRUPPAMENTO ---
  slots.forEach((slot, slotIndex) => {
    const slotOrders = orders.filter(o => o.slotTime === slot);
    if (slotOrders.length === 0) return;

    // Controllo spazio pagina per nuovo blocco slot
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    // --- TITOLO SLOT ---
    const emoji = slot === '17:30' ? '5:30' : slot === '18:00' ? '6:00' : '7:00';
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(`${slot} – Totale ${slotOrders.length} pizze`, margin, yPos);
    yPos += 8;

    // --- SEZIONE 1: RIEPILOGO PRODUZIONE ---
    const pizzaSummary = new Map<string, number>();
    slotOrders.forEach(o => {
      const pName = o.pizza?.name || 'Sconosciuta';
      pizzaSummary.set(pName, (pizzaSummary.get(pName) || 0) + 1);
    });

    const summaryTableBody = Array.from(pizzaSummary.entries())
      .sort((a, b) => b[1] - a[1]) // Ordina per quantità decrescente
      .map(([name, count]) => [name, count.toString()]);

    autoTable(doc, {
      startY: yPos,
      head: [['Pizza', 'Quantità']],
      body: summaryTableBody,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 
        0: { cellWidth: 'auto', fontStyle: 'bold' }, 
        1: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } 
      },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // --- SEZIONE 2: MODIFICHE AGGREGATE ---
    // Raggruppa per tipo pizza
    const modsByPizza = new Map<string, Map<string, number>>();
    
    slotOrders.forEach(o => {
      if (o.addMods.length === 0 && o.removeMods.length === 0) return;
      const pName = o.pizza?.name || 'Sconosciuta';
      
      if (!modsByPizza.has(pName)) modsByPizza.set(pName, new Map());
      const pMods = modsByPizza.get(pName)!;
      
      [...o.addMods, ...o.removeMods].forEach(m => {
        const text = normalizeModText(m);
        pMods.set(text, (pMods.get(text) || 0) + 1);
      });
    });

    if (modsByPizza.size > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("VARIAZIONI AGGREGATE", margin, yPos);
      yPos += 6;

      modsByPizza.forEach((modsMap, pName) => {
        if (yPos > 270) { doc.addPage(); yPos = 20; }
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 122, 255);
        doc.text(pName.toUpperCase(), margin + 2, yPos);
        yPos += 5;
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        
        Array.from(modsMap.entries()).forEach(([modText, count]) => {
          if (yPos > 275) { doc.addPage(); yPos = 20; }
          doc.text(`- ${count} ${modText}`, margin + 6, yPos);
          yPos += 5;
        });
        yPos += 2;
      });
      yPos += 4;
    }

    // --- SEZIONE 3: ELENCO NOMI ---
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("ELENCO DISTRIBUZIONE", margin, yPos);
    yPos += 6;

    const namesList = slotOrders
      .sort((a, b) => {
        const nameA = `${a.user?.firstName} ${a.user?.lastName}`.toLowerCase();
        const nameB = `${b.user?.firstName} ${b.user?.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      })
      .map(o => {
        const mods = [...o.addMods.map(m => `+${m.name}`), ...o.removeMods.map(m => `-${m.name}`)].join(", ");
        const staffName = `${o.user?.firstName} ${o.user?.lastName}`;
        const pizzaName = o.pizza?.name || 'Sconosciuta';
        return mods ? `${staffName} – ${pizzaName} (${mods})` : `${staffName} – ${pizzaName}`;
      });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    
    namesList.forEach(line => {
      if (yPos > 275) { doc.addPage(); yPos = 20; }
      doc.text(line, margin + 2, yPos);
      yPos += 5;
    });

    // Separatore tra slot
    yPos += 10;
    if (slotIndex < slots.length - 1) {
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 12;
    }
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
