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

  // Text de persones amb desglossament d'adults/nens si n'hi ha
  function persones(r) {
    const a = parseInt(r.adults) || 0;
    const n = parseInt(r.nens) || 0;
    const total = r.persones || (a + n) || '';
    if (a || n) {
      const parts = [];
      if (a) parts.push(a + (a === 1 ? ' adult' : ' adults'));
      if (n) parts.push(n + (n === 1 ? ' nen' : ' nens'));
      return total + ' (' + parts.join(', ') + ')';
    }
    return total === '' ? '' : String(total);
  }

  // Converteix un text de preu ("1.200", "160,50", "1200 €") en número
  function num(v) {
    if (v === null || v === undefined) return 0;
    const s = String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function eur(n) {
    return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0);
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

    // Límit inferior d'escriptura (deixa lloc per al peu a 287).
    const BOTTOM = 278;
    // Si no caben "h" mm més, passa a una pàgina nova i reinicia y a dalt.
    function salt(h) {
      if (y + h > BOTTOM) { doc.addPage(); y = 20; return true; }
      return false;
    }

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
      // Manté divisòria + títol + 1a fila juntes (no deixa títol orfe al peu).
      salt(24);
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
          const txt = doc.splitTextToSize(String(val), W - (marge + 45) - marge);
          salt(7 * txt.length);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...negre);
          doc.text(etq + ':', marge, y);
          doc.setFont('helvetica', 'normal');
          doc.text(txt, marge + 45, y);
          y += 7 * txt.length;
        } else {
          const txt = doc.splitTextToSize(String(val), W - 2 * marge);
          salt(7 * txt.length);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...negre);
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
      ['Persones', persones(r)]
    ]);

    // --- Patró ---
    seccio('Patró', [
      ['Patró', r.patro],
      ['Confirmat', r.patroOk ? 'Sí' : 'Pendent']
    ]);

    // --- Catering (molt destacat) ---
    salt(26); // títol + caixa SÍ/NO juntes
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
      // A cuina només els interessa QUÈ és l'extra i per a quantes persones,
      // no el preu (el total surt a la secció PREU).
      if (r.cateringExtra) {
        const q = String(r.cateringExtraQty || '').trim();
        items.push(`Extra: ${r.cateringExtra}${q ? `  —  ${q} ${q === '1' ? 'persona' : 'persones'}` : ''}`);
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      items.forEach(it => {
        const txt = doc.splitTextToSize('•  ' + it, W - 2 * marge);
        salt(7 * txt.length);
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
        const txt = doc.splitTextToSize(String(val), W - (marge + 45) - marge);
        salt(7 * txt.length);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...negre);
        doc.text(etq + ':', marge, y);
        doc.setFont('helvetica', 'normal');
        doc.text(txt, marge + 45, y);
        y += 7 * txt.length;
      });
    }

    // --- Preu (total destacat) ---
    const lloguer = (r.preuLloguer !== undefined && r.preuLloguer !== '') ? num(r.preuLloguer) : num(r.preu);
    const extres = num(r.preuExtres);
    const totalPreu = lloguer + extres;
    if (totalPreu > 0) {
      salt(48); // tota la secció de preu junta (títol + files + caixa total)
      y += 4;
      doc.setDrawColor(...blau);
      doc.line(marge, y, W - marge, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...blau);
      doc.text('PREU', marge, y);
      y += 8;

      doc.setFontSize(12);
      [['Lloguer', lloguer], ['Extres', extres]].forEach(([etq, val]) => {
        if (!val) return;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...negre);
        doc.text(etq, marge, y);
        doc.text(eur(val), W - marge, y, { align: 'right' });
        y += 7;
      });

      // Caixa de total destacada
      y += 1;
      doc.setFillColor(231, 246, 238);
      doc.roundedRect(marge, y - 5, W - 2 * marge, 11, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(31, 158, 107);
      doc.text('TOTAL', marge + 4, y + 2);
      doc.text(eur(totalPreu), W - marge - 4, y + 2, { align: 'right' });
      y += 14;
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
