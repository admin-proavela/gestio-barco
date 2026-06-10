/* pdf.js — Genera el "Full de servei" en PDF amb jsPDF (en local). */
const PdfServei = (function () {

  function dataLlarga(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso + 'T00:00:00');
      const t = new Intl.DateTimeFormat('ca-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).format(d);
      return t.charAt(0).toUpperCase() + t.slice(1);
    } catch (e) { return iso; }
  }

  function nomFitxer(r) {
    const data = r.data || 'sense-data';
    const nom = (r.client || 'client').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase();
    return `full-servei_${data}_${nom}.pdf`;
  }

  /* Crea el document jsPDF i retorna { doc, blob, filename } */
  function generar(r, settings) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    const marge = 16;
    let y = 0;

    const blau = [10, 110, 138];
    const gris = [107, 119, 133];
    const negre = [29, 39, 51];

    // --- Capçalera ---
    doc.setFillColor(...blau);
    doc.rect(0, 0, W, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text((settings.barco || 'Hotel Barcarola').toUpperCase(), marge, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('FULL DE SERVEI', marge, 25);
    // Estat a la dreta
    doc.setFontSize(10);
    const estatTxt = ({ pendent: 'PENDENT', confirmada: 'CONFIRMADA', cancellada: 'CANCEL·LADA' })[r.estat] || '';
    if (estatTxt) doc.text(estatTxt, W - marge, 25, { align: 'right' });

    y = 46;

    // --- Data destacada ---
    doc.setTextColor(...blau);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(dataLlarga(r.data), marge, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...gris);
    const horaDur = [r.hora ? 'Hora: ' + r.hora : null, r.durada ? 'Durada: ' + r.durada : null]
      .filter(Boolean).join('     ');
    if (horaDur) { doc.text(horaDur, marge, y); y += 8; } else { y += 2; }

    // Funció auxiliar per dibuixar una secció amb files etiqueta:valor
    function seccio(titol, files, opcions) {
      opcions = opcions || {};
      y += 4;
      // títol secció
      doc.setDrawColor(...blau);
      doc.setLineWidth(0.6);
      doc.line(marge, y, W - marge, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...blau);
      doc.text(titol.toUpperCase(), marge, y);
      y += 7;
      doc.setFontSize(12);
      files.forEach(([etq, val]) => {
        if (val === null || val === undefined || val === '') return;
        if (etq) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...negre);
          doc.text(etq + ':', marge, y);
          doc.setFont('helvetica', 'normal');
          const txt = doc.splitTextToSize(String(val), W - (marge + 45) - marge);
          doc.text(txt, marge + 45, y);
          y += 7 * txt.length;
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...negre);
          const txt = doc.splitTextToSize(String(val), W - 2 * marge);
          doc.text(txt, marge, y);
          y += 7 * txt.length;
        }
      });
    }

    // --- Client ---
    seccio('Client', [
      ['Nom', r.client],
      ['Telèfon', r.telefon],
      ['Plataforma', r.plataforma],
      ['Persones', r.persones]
    ]);

    // --- Patró ---
    seccio('Patró', [
      ['Patró', r.patro],
      ['Confirmat', r.patroOk ? 'Sí' : 'Pendent']
    ]);

    // --- Catering (molt destacat) ---
    y += 4;
    doc.setDrawColor(...blau);
    doc.line(marge, y, W - marge, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...blau);
    doc.text('CATERING', marge, y);
    y += 8;

    // Caixa SÍ/NO
    if (r.catering) {
      doc.setFillColor(231, 246, 238);
      doc.setTextColor(31, 158, 107);
      doc.roundedRect(marge, y - 5, 55, 9, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('SÍ — MENJAR A BORD', marge + 4, y + 1);
      y += 12;
      doc.setTextColor(...negre);

      // Ítems escollits, cadascun en una línia completa (els noms llargs s'ajusten sols)
      const items = [];
      CATERING_CARTA.forEach(g => {
        g.items.forEach(it => {
          const qty = r[it.clau] || 0;
          if (qty) items.push(`${it.nom}  —  ${qty} ${qty === 1 ? g.unitat[0] : g.unitat[1]}`);
        });
      });
      const extraPreu = parseFloat(String(r.cateringExtraPreu).replace(',', '.')) || 0;
      if (r.cateringExtra || extraPreu > 0) {
        items.push(`Extra: ${r.cateringExtra || '—'}${extraPreu > 0 ? '  —  ' + extraPreu + ' €' : ''}`);
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      items.forEach(it => {
        const txt = doc.splitTextToSize('•  ' + it, W - 2 * marge);
        doc.text(txt, marge, y);
        y += 7 * txt.length;
      });

      // Detalls breus amb etiqueta:valor
      seccioInterna([
        ['Hora menjar', r.cateringHora],
        ['Al·lèrgies/notes', r.cateringAler]
      ]);
    } else {
      doc.setFillColor(242, 244, 246);
      doc.setTextColor(107, 119, 133);
      doc.roundedRect(marge, y - 5, 45, 9, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Sense menjar a bord', marge + 4, y + 1);
      y += 12;
    }

    function seccioInterna(files) {
      doc.setFontSize(12);
      files.forEach(([etq, val]) => {
        if (val === null || val === undefined || val === '') return;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...negre);
        doc.text(etq + ':', marge, y);
        doc.setFont('helvetica', 'normal');
        const txt = doc.splitTextToSize(String(val), W - (marge + 45) - marge);
        doc.text(txt, marge + 45, y);
        y += 7 * txt.length;
      });
    }

    // --- Notes ---
    if (r.notes) {
      seccio('Notes', [['', r.notes]]);
    }

    // --- Peu ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gris);
    const peu = [settings.restaurant ? 'Restaurant: ' + settings.restaurant : null,
                 'Generat el ' + new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())]
                .filter(Boolean).join('  ·  ');
    doc.text(peu, marge, 287);

    const blob = doc.output('blob');
    return { doc, blob, filename: nomFitxer(r) };
  }

  return { generar, nomFitxer };
})();
