/* app.js — Lògica de la interfície i connexió de tot. */
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const TITOLS = { reserves: 'Reserves', calendari: 'Calendari', plantilles: 'Plantilles', ajustos: 'Ajustos' };

  let filtreEstat = 'totes';
  let calData = new Date();      // mes mostrat al calendari
  let calSeleccio = null;        // dia seleccionat (ISO)

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

    const cateringTxt = r.catering
      ? '🍽️ ' + (r.cateringMenu ? esc(r.cateringMenu) : 'Catering')
      : 'Sense catering';

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
    $('#r-cat-menu').value = r ? (r.cateringMenu || '') : '';
    $('#r-cat-num').value = r ? (r.cateringNum || '') : '';
    $('#r-cat-hora').value = r ? (r.cateringHora || '') : '';
    $('#r-cat-aler').value = r ? (r.cateringAler || '') : '';
    $('#r-estat').value = r ? (r.estat || 'pendent') : 'pendent';
    $('#r-preu').value = r ? (r.preu || '') : '';
    $('#r-notes').value = r ? (r.notes || '') : '';
    $('#cat-detalls').hidden = !$('#r-cat').checked;
    $('#reserva-elimina').hidden = !r;
    modal.hidden = false;
  }

  function tancaReserva() { modal.hidden = true; }

  $('#btn-nova').addEventListener('click', () => obreReserva(null));
  $('#reserva-cancel').addEventListener('click', tancaReserva);
  $('#r-cat').addEventListener('change', e => { $('#cat-detalls').hidden = !e.target.checked; });

  $('#reserva-desa').addEventListener('click', () => {
    const nom = $('#r-nom').value.trim();
    const data = $('#r-data').value;
    if (!nom) { toast('Posa el nom del client'); return; }
    if (!data) { toast('Posa la data'); return; }

    const id = $('#r-id').value;
    const existent = id ? Store.getReserva(id) : null;
    const r = Object.assign({}, existent, {
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
      cateringMenu: $('#r-cat-menu').value.trim(),
      cateringNum: $('#r-cat-num').value,
      cateringHora: $('#r-cat-hora').value,
      cateringAler: $('#r-cat-aler').value.trim(),
      estat: $('#r-estat').value,
      preu: $('#r-preu').value.trim(),
      notes: $('#r-notes').value.trim()
    });
    Store.saveReserva(r);
    tancaReserva();
    renderReserves();
    toast('Reserva desada ✅');
  });

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
    L.push('*' + (settings.barco || 'Sortida') + ' — Full de servei*');
    L.push('📅 ' + (r.data ? dataCurta(r.data) : '—') + (r.hora ? '  🕐 ' + r.hora : ''));
    if (r.durada) L.push('⏱️ ' + r.durada);
    L.push('👤 ' + (r.client || '') + (r.telefon ? '  📞 ' + r.telefon : ''));
    if (r.persones) L.push('👥 ' + r.persones + ' persones');
    if (r.patro) L.push('⚓ Patró: ' + r.patro + (r.patroOk ? ' (confirmat)' : ''));
    if (r.catering) {
      L.push('🍽️ CATERING: SÍ' + (r.cateringNum ? ' (' + r.cateringNum + ' menús)' : ''));
      if (r.cateringMenu) L.push('   Menú: ' + r.cateringMenu);
      if (r.cateringHora) L.push('   Hora menjar: ' + r.cateringHora);
      if (r.cateringAler) L.push('   ⚠️ ' + r.cateringAler);
    } else {
      L.push('🍽️ Catering: NO');
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
    const titol = capFirst(new Intl.DateTimeFormat('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso + 'T00:00:00')));

    const h = document.createElement('h3');
    h.textContent = titol;
    cont.appendChild(h);

    if (!res.length) {
      const p = document.createElement('p');
      p.className = 'ajuda';
      p.textContent = 'Cap reserva aquest dia.';
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
  }

  $('#cal-prev').addEventListener('click', () => { calData.setMonth(calData.getMonth() - 1); renderCalendari(); });
  $('#cal-next').addEventListener('click', () => { calData.setMonth(calData.getMonth() + 1); renderCalendari(); });

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
    $('#aj-tel-cuina').value = s.telCuina || '';
    $('#aj-tel-patro').value = s.telPatro || '';
  }

  $('#btn-desa-ajustos').addEventListener('click', () => {
    Store.saveSettings({
      barco: $('#aj-barco').value.trim(),
      restaurant: $('#aj-restaurant').value.trim(),
      patro: $('#aj-patro').value.trim(),
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
