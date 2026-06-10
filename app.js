/* app.js — Lògica de la interfície i connexió de tot. */
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const TITOLS = { reserves: 'Reserves', calendari: 'Calendari', guanys: 'Guanys', plantilles: 'Plantilles', ajustos: 'Ajustos' };

  let filtreEstat = 'totes';
  let calData = new Date();      // mes mostrat al calendari
  let calSeleccio = null;        // dia seleccionat (ISO)
  let guanyAny = new Date().getFullYear();  // any mostrat a Guanys

  /* ---------- Utilitats ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.hidden = true; }, 2200);
  }

  function avuiISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

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

  // Import total d'una reserva (lloguer + extres), amb compatibilitat amb el camp antic "preu"
  function importReserva(r) {
    const lloguer = (r.preuLloguer !== undefined && r.preuLloguer !== '') ? num(r.preuLloguer) : num(r.preu);
    return lloguer + num(r.preuExtres);
  }

  function taxaComissio() {
    const c = num(Store.getSettings().comissio);
    return c > 0 ? c : 10;
  }

  function dataCurta(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso + 'T00:00:00');
      return new Intl.DateTimeFormat('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
    } catch (e) { return iso; }
  }

  function classeEstat(r) {
    if (r.estat === 'cancellada') return 'cancellada';
    if (r.data && r.data < avuiISO()) return 'passada';
    return r.estat || 'pendent';
  }

  /* ---------- Navegació de vistes ---------- */
  function mostraVista(nom) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + nom));
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === nom));
    $('#topbar-title').textContent = TITOLS[nom] || '';
    $('#btn-nova').style.visibility = (nom === 'reserves') ? 'visible' : 'hidden';
    if (nom === 'calendari') renderCalendari();
    if (nom === 'guanys') renderGuanys();
    if (nom === 'plantilles') renderPlantilles();
    if (nom === 'ajustos') carregaAjustos();
  }

  $$('.tab').forEach(t => t.addEventListener('click', () => mostraVista(t.dataset.view)));

  /* ---------- Reserves: llista ---------- */
  function reservesFiltrades() {
    let llista = Store.getReserves();
    const q = $('#cerca').value.trim().toLowerCase();
    if (q) {
      llista = llista.filter(r =>
        (r.client || '').toLowerCase().includes(q) ||
        (r.telefon || '').toLowerCase().includes(q));
    }
    const avui = avuiISO();
    if (filtreEstat === 'pendent') llista = llista.filter(r => r.estat === 'pendent' && classeEstat(r) !== 'passada');
    else if (filtreEstat === 'confirmada') llista = llista.filter(r => r.estat === 'confirmada' && classeEstat(r) !== 'passada');
    else if (filtreEstat === 'passada') llista = llista.filter(r => r.data && r.data < avui);
    // Ordena: properes primer
    llista.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    return llista;
  }

  function renderReserves() {
    const cont = $('#llista-reserves');
    const llista = reservesFiltrades();
    cont.innerHTML = '';
    $('#buit-reserves').hidden = llista.length > 0;

    llista.forEach(r => cont.appendChild(crearTargeta(r, dataCurta(r.data))));
  }

  // Construeix una targeta de reserva (reutilitzada a la llista i al calendari)
  function crearTargeta(r, dataLabel) {
    const card = document.createElement('div');
    card.className = 'targeta ' + classeEstat(r);

    const info = [];
    if (r.durada) info.push(r.durada);
    if (r.hora) info.push('🕐 ' + r.hora);
    if (r.persones) info.push('👥 ' + r.persones);
    if (r.telefon) info.push('📞 ' + r.telefon);
    if (r.patro) info.push((r.patroOk ? '✅ ' : '⏳ ') + r.patro);
    if (r.plataforma) info.push(r.plataforma);

    const cateringTxt = r.catering ? '🍽️ Menjar a bord' : 'Sense menjar a bord';

    card.innerHTML = `
      <div class="t-cap">
        <span class="t-nom">${esc(r.client || 'Sense nom')}</span>
        <span class="t-data">${esc(dataLabel)}</span>
      </div>
      <div class="t-info">${info.map(i => `<span>${esc(i)}</span>`).join('')}</div>
      <span class="t-badge ${r.catering ? 'cat-si' : 'cat-no'}">${cateringTxt}</span>
      <div class="t-accions">
        <button data-act="edita">✏️ Editar</button>
        <button class="pdf" data-act="pdf">📄 PDF</button>
        <button class="wa" data-act="wa">Enviar PDF</button>
      </div>`;

    card.querySelector('[data-act="edita"]').onclick = () => obreReserva(r.id);
    card.querySelector('[data-act="pdf"]').onclick = () => descarregaPDF(r);
    card.querySelector('[data-act="wa"]').onclick = () => comparteixWhatsApp(r);
    return card;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  $('#cerca').addEventListener('input', renderReserves);
  $$('#filtres-estat .chip').forEach(c => c.addEventListener('click', () => {
    $$('#filtres-estat .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    filtreEstat = c.dataset.estat;
    renderReserves();
  }));

  /* ---------- Reserves: formulari ---------- */
  const modal = $('#modal-reserva');

  function obreReserva(id) {
    const r = id ? Store.getReserva(id) : null;
    $('#reserva-titol').textContent = r ? 'Editar reserva' : 'Nova reserva';
    $('#r-id').value = r ? r.id : '';
    $('#r-nom').value = r ? (r.client || '') : '';
    $('#r-tel').value = r ? (r.telefon || '') : '';
    $('#r-plataforma').value = r ? (r.plataforma || 'ClickAndBoat') : 'ClickAndBoat';
    $('#r-data').value = r ? (r.data || '') : (calSeleccio || '');
    $('#r-hora').value = r ? (r.hora || '') : '';
    $('#r-durada').value = r ? (r.durada || 'Mig dia (matí)') : 'Mig dia (matí)';
    $('#r-persones').value = r ? (r.persones || '') : '';
    $('#r-patro').value = r ? (r.patro || '') : (Store.getSettings().patro || '');
    $('#r-patro-ok').checked = r ? !!r.patroOk : false;
    $('#r-cat').checked = r ? !!r.catering : false;
    cateringItems().forEach(it => { $('#' + it.camp).value = r ? (r[it.clau] || '') : ''; });
    $('#r-cat-extra').value = r ? (r.cateringExtra || '') : '';
    $('#r-cat-extra-preu').value = r ? (r.cateringExtraPreu || '') : '';
    $('#r-cat-hora').value = r ? (r.cateringHora || '') : '';
    $('#r-cat-aler').value = r ? (r.cateringAler || '') : '';
    $('#r-estat').value = r ? (r.estat || 'pendent') : 'pendent';
    $('#r-preu-lloguer').value = r ? (r.preuLloguer !== undefined ? r.preuLloguer : (r.preu || '')) : '';
    $('#r-preu-extres').value = r ? (r.preuExtres || '') : '';
    $('#r-notes').value = r ? (r.notes || '') : '';
    $('#cat-detalls').hidden = !$('#r-cat').checked;
    $('#reserva-elimina').hidden = !r;
    actualitzaPreuCatering(false);
    actualitzaGuanyHint();
    actualitzaAvisBloqueig();
    modal.hidden = false;
  }

  function actualitzaGuanyHint() {
    const total = num($('#r-preu-lloguer').value) + num($('#r-preu-extres').value);
    const taxa = taxaComissio();
    $('#r-guany-hint').textContent = total > 0
      ? `El teu ${taxa}% de ${eur(total)} = ${eur(total * taxa / 100)}`
      : '';
  }

  function tancaReserva() { modal.hidden = true; }

  $('#btn-nova').addEventListener('click', () => obreReserva(null));
  $('#reserva-cancel').addEventListener('click', tancaReserva);
  $('#r-cat').addEventListener('change', e => { $('#cat-detalls').hidden = !e.target.checked; });
  $('#r-preu-lloguer').addEventListener('input', actualitzaGuanyHint);
  $('#r-preu-extres').addEventListener('input', actualitzaGuanyHint);

  // Genera les files de la carta dins del formulari des de CATERING_CARTA
  function renderCateringCarta() {
    $('#cat-grups').innerHTML = CATERING_CARTA.map(g => {
      const files = g.items.map(it => `
        <div class="cat-fila">
          <span>${esc(it.nom)} <em>${it.preu} €/${g.unitat[0]}</em></span>
          <input type="number" id="${it.camp}" min="0" inputmode="numeric" placeholder="0">
        </div>`).join('');
      // Després de les paelles, la fila Extra (descripció lliure + preu manual)
      const extra = g.extra ? `
        <div class="cat-fila cat-extra">
          <input type="text" id="r-cat-extra" placeholder="Extra (si algú no vol paella, ex: menú nens)">
          <input type="number" id="r-cat-extra-preu" min="0" step="any" inputmode="decimal" placeholder="€">
        </div>` : '';
      return `<p class="cat-seccio">${g.grup}</p>${files}${extra}`;
    }).join('');
  }
  renderCateringCarta();

  // omplePreu=true: recalcula i escriu el camp d'extres (en editar quantitats).
  // omplePreu=false: només mostra el desglossament sense tocar el preu (en obrir).
  function actualitzaPreuCatering(omplePreu = true) {
    const linies = [];
    let total = 0;
    cateringItems().forEach(it => {
      const qty = parseInt($('#' + it.camp).value) || 0;
      if (qty) { total += qty * it.preu; linies.push(`${qty}× ${it.nom.split(' (')[0]}`); }
    });
    const extraPreu = num($('#r-cat-extra-preu').value);
    const extraTxt = $('#r-cat-extra').value.trim();
    if (extraPreu > 0 || extraTxt) {
      total += extraPreu;
      linies.push('Extra' + (extraTxt ? ` (${extraTxt})` : ''));
    }

    if (omplePreu) {
      // El catering omple sempre el camp d'extres (també a 0 si es buida tot)
      $('#r-preu-extres').value = total > 0 ? String(Math.round(total * 100) / 100) : '';
      actualitzaGuanyHint();
    }
    $('#r-cat-total').textContent = total > 0
      ? `${linies.join(' · ')} = ${eur(total)}`
      : '';
  }
  // Delegació: qualsevol input dins dels grups de la carta recalcula el preu
  $('#cat-grups').addEventListener('input', () => actualitzaPreuCatering());

  $('#reserva-desa').addEventListener('click', () => {
    const nom = $('#r-nom').value.trim();
    const data = $('#r-data').value;
    if (!nom) { toast('Posa el nom del client'); return; }
    if (!data) { toast('Posa la data'); return; }

    const id = $('#r-id').value;
    const existent = id ? Store.getReserva(id) : null;
    const cateringQty = {};
    cateringItems().forEach(it => { cateringQty[it.clau] = parseInt($('#' + it.camp).value) || 0; });
    const r = Object.assign({}, existent, cateringQty, {
      id: id || undefined,
      client: nom,
      telefon: $('#r-tel').value.trim(),
      plataforma: $('#r-plataforma').value,
      data: data,
      hora: $('#r-hora').value,
      durada: $('#r-durada').value,
      persones: $('#r-persones').value,
      patro: $('#r-patro').value.trim(),
      patroOk: $('#r-patro-ok').checked,
      catering: $('#r-cat').checked,
      cateringExtra: $('#r-cat-extra').value.trim(),
      cateringExtraPreu: $('#r-cat-extra-preu').value.trim(),
      cateringHora: $('#r-cat-hora').value,
      cateringAler: $('#r-cat-aler').value.trim(),
      estat: $('#r-estat').value,
      preuLloguer: $('#r-preu-lloguer').value.trim(),
      preuExtres: $('#r-preu-extres').value.trim(),
      notes: $('#r-notes').value.trim()
    });
    Store.saveReserva(r);
    tancaReserva();
    renderReserves();
    toast('Reserva desada ✅');
  });

  // El botó "Desa la reserva" gran de baix fa el mateix que la "Desa" de dalt
  $('#btn-desa-baix').addEventListener('click', () => $('#reserva-desa').click());
  // El botó "Sortir sense desar" tanca el formulari (igual que "Cancel·la" de dalt)
  $('#btn-sortir-baix').addEventListener('click', tancaReserva);

  // Mostra avís si la data triada està bloquejada
  function actualitzaAvisBloqueig() {
    const iso = $('#r-data').value;
    const av = $('#r-avis-bloqueig');
    const b = iso ? Store.getBloqueig(iso) : null;
    if (b) {
      av.textContent = '🚫 Atenció: aquest dia està bloquejat' + (b.motiu ? ' (' + b.motiu + ')' : '');
      av.hidden = false;
    } else {
      av.hidden = true;
    }
  }
  $('#r-data').addEventListener('change', actualitzaAvisBloqueig);

  $('#reserva-elimina').addEventListener('click', () => {
    const id = $('#r-id').value;
    if (!id) return;
    if (confirm('Segur que vols eliminar aquesta reserva?')) {
      Store.deleteReserva(id);
      tancaReserva();
      renderReserves();
      toast('Reserva eliminada');
    }
  });

  /* ---------- PDF i WhatsApp ---------- */
  function descarregaPDF(r) {
    const { blob, filename } = PdfServei.generar(r, Store.getSettings());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function comparteixWhatsApp(r) {
    const settings = Store.getSettings();
    const { blob, filename } = PdfServei.generar(r, settings);
    const file = new File([blob], filename, { type: 'application/pdf' });

    // Mòbil modern: compartir el PDF directament i triar WhatsApp + contacte
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Full de servei',
          text: resumText(r, settings)
        });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // l'usuari ha cancel·lat
      }
    }
    // Alternativa: descarrega el PDF perquè l'enviïs tu a mà per WhatsApp
    descarregaPDF(r);
    toast('PDF descarregat. Ja el pots enviar per WhatsApp 📲');
  }

  function resumText(r, settings) {
    const L = [];
    L.push('*' + (settings.barco || 'Hotel Barcarola') + ' — Full de servei*');
    L.push('📅 ' + (r.data ? dataCurta(r.data) : '—') + (r.hora ? '  🕐 ' + r.hora : ''));
    if (r.durada) L.push('⏱️ ' + r.durada);
    L.push('👤 ' + (r.client || '') + (r.telefon ? '  📞 ' + r.telefon : ''));
    if (r.persones) L.push('👥 ' + r.persones + ' persones');
    if (r.patro) L.push('⚓ Patró: ' + r.patro + (r.patroOk ? ' (confirmat)' : ''));
    if (r.catering) {
      L.push('🍽️ MENJAR A BORD');
      CATERING_CARTA.forEach(g => {
        g.items.forEach(it => {
          const qty = r[it.clau] || 0;
          if (qty) L.push('   ' + it.nom + ' × ' + qty + ' ' + (qty === 1 ? g.unitat[0] : g.unitat[1]));
        });
      });
      if (r.cateringExtra || num(r.cateringExtraPreu) > 0) {
        L.push('   Extra: ' + (r.cateringExtra || '—') + (num(r.cateringExtraPreu) > 0 ? ' (' + eur(num(r.cateringExtraPreu)) + ')' : ''));
      }
      if (r.cateringHora) L.push('   Hora menjar: ' + r.cateringHora);
      if (r.cateringAler) L.push('   ⚠️ ' + r.cateringAler);
    } else {
      L.push('🍽️ Sense menjar a bord');
    }
    if (r.notes) L.push('📝 ' + r.notes);
    return L.join('\n');
  }

  /* ---------- Calendari ---------- */
  function renderCalendari() {
    const any = calData.getFullYear();
    const mes = calData.getMonth();
    $('#cal-titol').textContent = capFirst(new Intl.DateTimeFormat('ca-ES', { month: 'long', year: 'numeric' }).format(calData));

    // dia de la setmana del dia 1 (0=dilluns)
    const primer = new Date(any, mes, 1);
    let inici = (primer.getDay() + 6) % 7;
    const diesMes = new Date(any, mes + 1, 0).getDate();

    // index reserves per dia
    const perDia = {};
    Store.getReserves().forEach(r => {
      if (!r.data) return;
      (perDia[r.data] = perDia[r.data] || []).push(r);
    });

    // index dies bloquejats
    const blocPerDia = {};
    Store.getBloquejats().forEach(b => { blocPerDia[b.data] = b; });

    const graella = $('#cal-graella');
    graella.innerHTML = '';
    for (let i = 0; i < inici; i++) {
      const buit = document.createElement('div');
      buit.className = 'cal-cel buida';
      graella.appendChild(buit);
    }
    for (let d = 1; d <= diesMes; d++) {
      const iso = any + '-' + String(mes + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const cel = document.createElement('div');
      cel.className = 'cal-cel';
      if (iso === avuiISO()) cel.classList.add('avui');
      if (iso === calSeleccio) cel.classList.add('seleccionada');
      const res = perDia[iso];
      let punts = '';
      if (res && res.length) {
        cel.classList.add('te-reserva');
        punts = '<div class="cal-punts">' +
          res.slice(0, 3).map(r => `<span class="cal-punt ${r.estat === 'pendent' ? 'pendent' : ''}"></span>`).join('') +
          '</div>';
      }
      if (blocPerDia[iso]) cel.classList.add('bloquejat');
      cel.innerHTML = d + punts;
      cel.onclick = () => { calSeleccio = iso; renderCalendari(); mostraDiaCal(iso); };
      graella.appendChild(cel);
    }
    if (calSeleccio) mostraDiaCal(calSeleccio); else $('#cal-dia').innerHTML = '';
  }

  function mostraDiaCal(iso) {
    const cont = $('#cal-dia');
    cont.innerHTML = '';
    const res = Store.getReserves().filter(r => r.data === iso)
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    const bloq = Store.getBloqueig(iso);
    const titol = capFirst(new Intl.DateTimeFormat('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso + 'T00:00:00')));

    const h = document.createElement('h3');
    h.textContent = titol;
    cont.appendChild(h);

    if (bloq) {
      const av = document.createElement('div');
      av.className = 'dia-bloquejat';
      av.innerHTML = '🚫 <b>Dia bloquejat</b>' + (bloq.motiu ? ' · ' + esc(bloq.motiu) : '');
      cont.appendChild(av);
    }

    if (!res.length) {
      const p = document.createElement('p');
      p.className = 'ajuda';
      p.textContent = bloq ? 'Cap reserva aquest dia.' : 'Cap reserva aquest dia.';
      cont.appendChild(p);
    } else {
      const llista = document.createElement('div');
      llista.className = 'llista';
      res.forEach(r => llista.appendChild(crearTargeta(r, r.hora || '')));
      cont.appendChild(llista);
    }

    const btn = document.createElement('button');
    btn.className = 'btn-secundari ample';
    btn.textContent = '+ Nova reserva aquest dia';
    btn.onclick = () => obreReserva(null);
    cont.appendChild(btn);

    const btnBloq = document.createElement('button');
    btnBloq.className = bloq ? 'btn-perill ample' : 'btn-secundari ample';
    btnBloq.textContent = bloq ? '🔓 Desbloquejar dia' : '🚫 Bloquejar dia';
    btnBloq.onclick = () => {
      if (bloq) {
        if (confirm('Vols desbloquejar aquest dia?')) {
          Store.deleteBloqueig(iso);
          toast('Dia desbloquejat');
          renderCalendari();
          renderReserves();
        }
      } else {
        const motiu = prompt('Motiu del bloqueig (opcional):', '');
        if (motiu === null) return;
        Store.saveBloqueig(iso, motiu);
        toast('Dia bloquejat 🚫');
        renderCalendari();
        renderReserves();
      }
    };
    cont.appendChild(btnBloq);
  }

  $('#cal-prev').addEventListener('click', () => { calData.setMonth(calData.getMonth() - 1); renderCalendari(); });
  $('#cal-next').addEventListener('click', () => { calData.setMonth(calData.getMonth() + 1); renderCalendari(); });

  /* ---------- Guanys (mes per mes) ---------- */
  function renderGuanys() {
    $('#guany-any').textContent = String(guanyAny);
    const taxa = taxaComissio();
    const cont = $('#guany-mesos');
    cont.innerHTML = '';

    // Reserves de l'any, no cancel·lades i amb import
    const reserves = Store.getReserves().filter(r =>
      r.estat !== 'cancellada' && r.data && r.data.slice(0, 4) === String(guanyAny) && importReserva(r) > 0);
    $('#guany-buit').hidden = reserves.length > 0;

    // Agrupar per mes
    const perMes = {};
    reserves.forEach(r => {
      const mes = parseInt(r.data.slice(5, 7), 10) - 1;
      (perMes[mes] = perMes[mes] || []).push(r);
    });

    let totalFactConf = 0, totalComConf = 0;
    let totalFactPend = 0, totalComPend = 0;

    Object.keys(perMes).map(Number).sort((a, b) => a - b).forEach(mes => {
      const llista = perMes[mes].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
      let factConfMes = 0, factPendMes = 0;
      llista.forEach(r => {
        if (r.estat === 'pendent') factPendMes += importReserva(r);
        else factConfMes += importReserva(r);
      });
      const comConfMes = factConfMes * taxa / 100;
      const comPendMes = factPendMes * taxa / 100;
      totalFactConf += factConfMes; totalComConf += comConfMes;
      totalFactPend += factPendMes; totalComPend += comPendMes;

      const nomMes = capFirst(new Intl.DateTimeFormat('ca-ES', { month: 'long' }).format(new Date(guanyAny, mes, 1)));
      const files = llista.map(r => {
        const imp = importReserva(r);
        const pend = r.estat === 'pendent';
        return `<div class="mes-fila ${pend ? 'pendent' : ''}">
          <span class="mf-nom">${esc(r.client || 'Sense nom')} · ${dataCurta(r.data)}${pend ? ' <span class="mf-chip">pendent</span>' : ''}</span>
          <span class="mf-dret">${eur(imp)} → <b>${eur(imp * taxa / 100)}</b></span>
        </div>`;
      }).join('');

      const facturatTxt = factPendMes > 0
        ? `Facturat ${eur(factConfMes)}${factPendMes > 0 ? ' <span class="mes-pend">+ ' + eur(factPendMes) + ' pendents</span>' : ''} · ${llista.length} ${llista.length === 1 ? 'reserva' : 'reserves'}`
        : `Facturat ${eur(factConfMes)} · ${llista.length} ${llista.length === 1 ? 'reserva' : 'reserves'}`;

      const comissioTxt = factPendMes > 0
        ? `<div class="mes-comissio">${eur(comConfMes)}</div><div class="mes-comissio-pend">+ ${eur(comPendMes)} pendents</div>`
        : `<div class="mes-comissio">${eur(comConfMes)}</div>`;

      const card = document.createElement('div');
      card.className = 'mes-card';
      card.innerHTML = `
        <div class="mes-cap">
          <div>
            <div class="mes-nom">${esc(nomMes)}</div>
            <div class="mes-facturat">${facturatTxt}</div>
          </div>
          <div class="mes-comissio-cont">${comissioTxt}</div>
        </div>
        <div class="mes-llista">${files}</div>`;
      cont.appendChild(card);
    });

    const subPend = totalComPend > 0
      ? `<div class="gr-pend">+ ${eur(totalComPend)} pendents de confirmar</div>`
      : '';
    $('#guany-resum').innerHTML = `
      <div class="gr-etq">El teu ${taxa}% confirmat de ${guanyAny}</div>
      <div class="gr-total">${eur(totalComConf)}</div>
      <div class="gr-sub">de ${eur(totalFactConf)} facturats</div>
      ${subPend}`;
  }

  $('#guany-prev').addEventListener('click', () => { guanyAny--; renderGuanys(); });
  $('#guany-next').addEventListener('click', () => { guanyAny++; renderGuanys(); });

  /* ---------- Plantilles ---------- */
  function renderPlantilles() {
    const cont = $('#llista-plantilles');
    cont.innerHTML = '';
    Store.getPlantilles().forEach(p => {
      const el = document.createElement('div');
      el.className = 'plantilla';
      el.innerHTML = `
        <h4>${esc(p.titol)}</h4>
        <p>${esc(p.text)}</p>
        <div class="plantilla-accions">
          <button data-act="copia">📋 Copiar</button>
          <button data-act="edita">✏️ Editar</button>
        </div>`;
      el.querySelector('[data-act="copia"]').onclick = (ev) => { ev.stopPropagation(); copia(p.text); };
      el.querySelector('[data-act="edita"]').onclick = (ev) => { ev.stopPropagation(); editaPlantilla(p); };
      el.addEventListener('click', () => copia(p.text));
      cont.appendChild(el);
    });
  }

  async function copia(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copiat ✅ Ja el pots enganxar');
    } catch (e) {
      // Alternativa antiga
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copiat ✅'); } catch (_) { toast('No s\'ha pogut copiar'); }
      ta.remove();
    }
  }

  function editaPlantilla(p) {
    const titol = prompt('Títol de la plantilla:', p ? p.titol : '');
    if (titol === null) return;
    const text = prompt('Text:', p ? p.text : '');
    if (text === null) return;
    Store.savePlantilla(Object.assign({}, p, { titol: titol.trim() || 'Sense títol', text }));
    renderPlantilles();
    toast('Plantilla desada');
  }

  $('#btn-nova-plantilla').addEventListener('click', () => editaPlantilla(null));

  /* ---------- Ajustos ---------- */
  function carregaAjustos() {
    const s = Store.getSettings();
    $('#aj-barco').value = s.barco || '';
    $('#aj-restaurant').value = s.restaurant || '';
    $('#aj-patro').value = s.patro || '';
    $('#aj-comissio').value = s.comissio != null ? s.comissio : 10;
    $('#aj-tel-cuina').value = s.telCuina || '';
    $('#aj-tel-patro').value = s.telPatro || '';
  }

  $('#btn-desa-ajustos').addEventListener('click', () => {
    Store.saveSettings({
      barco: $('#aj-barco').value.trim(),
      restaurant: $('#aj-restaurant').value.trim(),
      patro: $('#aj-patro').value.trim(),
      comissio: num($('#aj-comissio').value) || 10,
      telCuina: $('#aj-tel-cuina').value.trim(),
      telPatro: $('#aj-tel-patro').value.trim()
    });
    toast('Ajustos desats ✅');
  });

  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([Store.exportar()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'copia-gestio-barco-' + avuiISO() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Còpia descarregada');
  });

  $('#file-import').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!confirm('Això substituirà les dades actuals per les de la còpia. Continuar?')) return;
        Store.importar(reader.result);
        carregaAjustos();
        renderReserves();
        toast('Còpia restaurada ✅');
      } catch (err) {
        toast('Fitxer no vàlid');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  });

  /* ---------- Inici ---------- */
  renderReserves();
  mostraVista('reserves');
})();
