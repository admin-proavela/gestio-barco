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
  function generar(r, settings, barco) {
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
    doc.text(((barco && barco.nom) || settings.barco || 'Barco').toUpperCase(), marge, 15);
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

/* PdfFactura — Factura mensual de comissió al propietari (marca Proavela). */
const PdfFactura = (function () {

  function num(v) {
    if (v === null || v === undefined) return 0;
    const s = String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function eur(n) {
    return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
  }

  function dataCurta(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso + 'T00:00:00');
      return new Intl.DateTimeFormat('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    } catch (e) { return iso; }
  }

  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  }

  /* opts: { barco, mes (0-11), any, reserves[], settings, taxa, importReserva } */
  function generar(opts) {
    const { barco, mes, any, reserves, settings, taxa, importReserva } = opts;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    const marge = 18;
    let y = 0;

    // Paleta Proavela
    const fondal = [28, 47, 62];      // #1C2F3E
    const posidonia = [42, 95, 95];   // #2A5F5F
    const arena = [212, 197, 160];    // #D4C5A0
    const gris = [107, 119, 133];
    const negre = [29, 39, 51];

    const nomMes = new Intl.DateTimeFormat('ca-ES', { month: 'long' }).format(new Date(any, mes, 1));
    const nomMesCap = nomMes.charAt(0).toUpperCase() + nomMes.slice(1);
    const mm = String(mes + 1).padStart(2, '0');
    const numFactura = any + '-' + mm + '-' + slug(barco.nom).slice(0, 12).toUpperCase();
    const ivaPct = num(settings.factIva) > 0 ? num(settings.factIva) : 21;

    // --- Capçalera fondal ---
    doc.setFillColor(...fondal);
    doc.rect(0, 0, W, 40, 'F');
    doc.setFillColor(...arena);
    doc.rect(0, 40, W, 1.4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.text((settings.factNom || 'Proavela').toUpperCase(), marge, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Factura de comissió — ' + nomMesCap + ' ' + any, marge, 28);
    doc.setFontSize(10);
    doc.text('Núm. ' + numFactura, W - marge, 18, { align: 'right' });
    doc.text('Data: ' + new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()), W - marge, 25, { align: 'right' });

    y = 54;

    // --- Emissor i destinatari ---
    doc.setFontSize(9);
    doc.setTextColor(...posidonia);
    doc.setFont('helvetica', 'bold');
    doc.text('EMISSOR', marge, y);
    doc.text('FACTURAT A', W / 2 + 4, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...negre);
    const emissor = [settings.factNom || 'Proavela', settings.factNif ? 'NIF: ' + settings.factNif : null, settings.factAdreca || null].filter(Boolean);
    const destinatari = [barco.propietari || '—', barco.nifProp ? 'NIF: ' + barco.nifProp : null, 'Barco: ' + barco.nom].filter(Boolean);
    const maxLin = Math.max(emissor.length, destinatari.length);
    for (let i = 0; i < maxLin; i++) {
      if (emissor[i]) doc.text(emissor[i], marge, y);
      if (destinatari[i]) doc.text(destinatari[i], W / 2 + 4, y);
      y += 5.5;
    }
    y += 6;

    // --- Taula de reserves ---
    // Capçalera de taula
    doc.setFillColor(...posidonia);
    doc.rect(marge, y - 5, W - 2 * marge, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const colData = marge + 3;
    const colClient = marge + 30;
    const colImport = W - marge - 42;
    const colCom = W - marge - 3;
    doc.text('DATA', colData, y);
    doc.text('CLIENT', colClient, y);
    doc.text('IMPORT', colImport, y, { align: 'right' });
    doc.text('COMISSIÓ ' + taxa + '%', colCom, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let totalImport = 0, totalCom = 0;
    let fila = 0;
    reserves.forEach(r => {
      if (y > 250) { doc.addPage(); y = 24; }
      const imp = importReserva(r);
      const com = imp * taxa / 100;
      totalImport += imp; totalCom += com;
      if (fila % 2 === 1) {
        doc.setFillColor(246, 244, 238); // arena molt clar
        doc.rect(marge, y - 4.5, W - 2 * marge, 7, 'F');
      }
      doc.setTextColor(...negre);
      doc.text(dataCurta(r.data), colData, y);
      const clientTxt = doc.splitTextToSize(r.client || 'Sense nom', colImport - colClient - 14);
      doc.text(clientTxt[0] + (clientTxt.length > 1 ? '…' : ''), colClient, y);
      doc.text(eur(imp), colImport, y, { align: 'right' });
      doc.text(eur(com), colCom, y, { align: 'right' });
      y += 7;
      fila++;
    });

    // Línia de tancament
    doc.setDrawColor(...posidonia);
    doc.setLineWidth(0.4);
    doc.line(marge, y - 2, W - marge, y - 2);
    y += 4;

    // --- Totals ---
    const iva = totalCom * ivaPct / 100;
    const total = totalCom + iva;
    const totX = W - marge - 3;
    const etqX = W / 2 - 6;

    doc.setFontSize(10);
    doc.setTextColor(...gris);
    doc.text('Ingressos del mes (' + reserves.length + (reserves.length === 1 ? ' reserva)' : ' reserves)'), etqX, y, { align: 'left' });
    doc.setTextColor(...negre);
    doc.text(eur(totalImport), totX, y, { align: 'right' });
    y += 7;
    doc.setTextColor(...gris);
    doc.text('Base imposable (comissió ' + taxa + '%)', etqX, y);
    doc.setTextColor(...negre);
    doc.text(eur(totalCom), totX, y, { align: 'right' });
    y += 7;
    doc.setTextColor(...gris);
    doc.text('IVA ' + ivaPct + '%', etqX, y);
    doc.setTextColor(...negre);
    doc.text(eur(iva), totX, y, { align: 'right' });
    y += 5;

    // Caixa total
    doc.setFillColor(...fondal);
    doc.roundedRect(etqX - 4, y - 3, W - marge - etqX + 4, 11, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL', etqX, y + 4);
    doc.text(eur(total), totX, y + 4, { align: 'right' });
    y += 20;

    // --- Nota ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gris);
    const nota = doc.splitTextToSize(
      'Comissió del ' + taxa + '% sobre els ingressos de lloguer i extres de ' + nomMes + ' de ' + any +
      ' del barco ' + barco.nom + '. Només s\'hi inclouen les reserves confirmades.', W - 2 * marge);
    doc.text(nota, marge, y);

    // --- Peu ---
    doc.setFillColor(...arena);
    doc.rect(0, 288, W, 1, 'F');
    doc.setFontSize(8.5);
    doc.setTextColor(...gris);
    doc.text((settings.factNom || 'Proavela') + (settings.factNif ? ' · ' + settings.factNif : '') + ' · Generat amb Gestió Barco', marge, 294);

    const filename = 'factura_' + any + '-' + mm + '_' + slug(barco.nom) + '.pdf';
    return { doc, blob: doc.output('blob'), filename };
  }

  return { generar };
})();
