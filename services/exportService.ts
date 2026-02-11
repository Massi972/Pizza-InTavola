
import { Order, Pizza, User, SlotTime } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToCSV = (date: string, data: any[]) => {
  const header = ['Orario', 'Dipendente', 'Pizza', 'Note'];
  const rows = data.map(o => [o.slotTime, `${o.user.firstName} ${o.user.lastName}`, o.pizza.name, o.note]);
  
  const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `ordini_${date}.csv`);
  link.click();
};

export const exportToXLSX = (date: string, orders: any[]) => {
  const workbook = XLSX.utils.book_new();
  const worksheetData = orders.map(o => ({
    Orario: o.slotTime,
    Dipendente: `${o.user.firstName} ${o.user.lastName}`,
    Pizza: o.pizza.name,
    Note: o.note
  }));

  const ws = XLSX.utils.json_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(workbook, ws, "Ordini");
  XLSX.writeFile(workbook, `ordini_${date}.xlsx`);
};

export const exportToPDF = (date: string, ordersBySlot: Record<SlotTime, any[]>, totalByPizza: Record<string, number>) => {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("Riepilogo Ordini Pizza", 14, 22);
  doc.setFontSize(12);
  doc.text(`Data: ${date}`, 14, 30);

  let yPos = 40;

  (['17:30', '18:00', '19:00'] as SlotTime[]).forEach(slot => {
    const slotOrders = ordersBySlot[slot] || [];
    if (slotOrders.length > 0) {
      doc.setFontSize(14);
      doc.text(`Slot Orario: ${slot}`, 14, yPos);
      yPos += 5;

      const body = slotOrders.map(o => [
        `${o.user.firstName} ${o.user.lastName}`,
        o.pizza.name,
        o.note || '-'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Dipendente', 'Pizza', 'Note']],
        body: body,
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
      if (yPos > 260) { doc.addPage(); yPos = 20; }
    }
  });

  // Summary by Pizza
  doc.setFontSize(14);
  doc.text("Totali per Pizza", 14, yPos);
  yPos += 5;
  const pizzaTotalsBody = Object.entries(totalByPizza).map(([name, qty]) => [name, qty]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['Pizza', 'Quantità']],
    body: pizzaTotalsBody,
  });

  doc.save(`ordini_${date}.pdf`);
};
