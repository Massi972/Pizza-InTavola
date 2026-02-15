
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

export const generateDayReportPDF = (
  date: string, 
  orders: HydratedOrder[], 
  slots: SlotTime[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(0, 122, 255);
  doc.text("IN TAVOLA - Report Pizze Staff", 14, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data: ${formatDate(date)}`, 14, 28);
  doc.text(`Totale Pizze: ${orders.length}`, pageWidth - 14, 28, { align: 'right' });

  let yPos = 40;

  // 1. Riepilogo Aggregato per Cucina
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("Riepilogo Preparazione (Totale)", 14, yPos);
  yPos += 5;

  const configMap = new Map<string, { name: string, mods: string, count: number }>();
  
  orders.forEach(o => {
    const pizzaName = o.pizza?.name || 'Pizza Sconosciuta';
    const modStrings = [
      ...o.addMods.map(m => `+${m.name}`),
      ...o.removeMods.map(m => `-${m.name}`)
    ].sort().join(", ");
    
    const key = `${o.pizzaId}|${modStrings}`;
    const existing = configMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      configMap.set(key, { name: pizzaName, mods: modStrings || '—', count: 1 });
    }
  });

  const summaryBody = Array.from(configMap.values())
    .sort((a, b) => b.count - a.count)
    .map(item => [item.count.toString(), item.name, item.mods]);

  autoTable(doc, {
    startY: yPos,
    head: [['Q.tà', 'Pizza', 'Variazioni']],
    body: summaryBody,
    theme: 'grid',
    headStyles: { fillColor: [52, 199, 89], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold', halign: 'center' } }
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // 2. Dettaglio per Orario
  doc.setFontSize(16);
  doc.text("Dettaglio per Orario", 14, yPos);
  yPos += 5;

  slots.forEach(slot => {
    const slotOrders = orders.filter(o => o.slotTime === slot);
    if (slotOrders.length === 0) return;

    if (yPos > 240) { doc.addPage(); yPos = 20; }

    doc.setFontSize(13);
    doc.setTextColor(0, 122, 255);
    doc.text(`SLOT ORE ${slot} (${slotOrders.length} pizze)`, 14, yPos);
    yPos += 3;

    const body = slotOrders.map(o => {
      const mods = [
        ...o.addMods.map(m => `+${m.name}`),
        ...o.removeMods.map(m => `-${m.name}`)
      ].join(", ");

      return [
        `${o.user?.firstName} ${o.user?.lastName}`,
        o.pizza?.name || '—',
        mods || '—'
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Dipendente', 'Pizza', 'Variazioni']],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [0, 122, 255] },
      margin: { left: 14 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  });

  doc.save(`Report_Pizze_${date}.pdf`);
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
