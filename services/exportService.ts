
import { Order, Pizza, User, SlotTime, Modification } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './utils';

export interface HydratedOrder extends Order {
  user?: User;
  pizza?: Pizza;
  addMods: Modification[];
  removeMods: Modification[];
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

  // 1. Riepilogo Aggregato per Cucina (Cosa preparare in totale)
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("Riepilogo Preparazione (Totale)", 14, yPos);
  yPos += 5;

  // Raggruppiamo per "Configurazione" (Pizza + Modifiche specifiche)
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
    headStyles: { fillColor: [52, 199, 89], fontStyle: 'bold' }, // Verde per il riepilogo
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

  // Footer con timestamp di generazione
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generato il ${new Date().toLocaleString('it-IT')} - Pagina ${i} di ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  doc.save(`Report_Pizze_${date}.pdf`);
};
