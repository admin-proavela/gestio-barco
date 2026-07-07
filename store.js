/* store.js — Capa de dades local (localStorage). Res surt del dispositiu. */

/* Carta de catering — compartida entre app.js i pdf.js.
   Cada ítem: 'clau' (camp guardat a la reserva), 'camp' (id de l'input al
   formulari), 'nom' i 'preu'. 'unitat' = [singular, plural] per als textos. */
const CATERING_CARTA = [
  {
    grup: 'Paelles / arrossos', unitat: ['ració', 'racions'], extra: true,
    items: [
      { clau: 'cateringD1', camp: 'r-cat-d1', nom: 'Paella de verdures', preu: 37 },
      { clau: 'cateringD2', camp: 'r-cat-d2', nom: 'Paella de marisc', preu: 47 },
      { clau: 'cateringD3', camp: 'r-cat-d3', nom: 'Paella mixta (carn i marisc)', preu: 50 },
      { clau: 'cateringD4', camp: 'r-cat-d4', nom: 'Arròs cremós amb marisc i bogavant', preu: 52 },
    ],
  },
  {
    grup: '🥤 Begudes', unitat: ['persona', 'persones'],
    items: [
      { clau: 'cateringBegA', camp: 'r-cat-bega', nom: 'Amb alcohol (refrescos, vi i cervesa)', preu: 25 },
      { clau: 'cateringBegS', camp: 'r-cat-begs', nom: 'Sense alcohol (només refrescos)', preu: 15 },
    ],
  },
  {
    grup: '🫒 Pica-pica', unitat: ['persona', 'persones'],
    items: [
      { clau: 'cateringPPb', camp: 'r-cat-ppb', nom: 'Bàsic (patates, olives, fuet)', preu: 10 },
      { clau: 'cateringPPc', camp: 'r-cat-ppc', nom: 'Complet (+ amanida de pasta, entrepans i macedònia)', preu: 25 },
    ],
  },
  {
    grup: '🍽️ Packs', unitat: ['persona', 'persones'],
    items: [
      { clau: 'cateringPackC', camp: 'r-cat-packc', nom: 'Pack complet (menjar + begudes amb alcohol)', preu: 45 },
      { clau: 'cateringPackS', camp: 'r-cat-packs', nom: 'Pack complet (menjar + begudes sense alcohol)', preu: 40 },
    ],
  },
];

// Recorre tots els ítems de la carta (útil per desar/llegir/sumar)
function cateringItems() {
  return CATERING_CARTA.flatMap(g => g.items);
}

const Store = (function () {
  const KEY = 'gestio-barco-v1';

  const PLANTILLES_DEFECTE = [
    {
      id: 'p-benvinguda',
      titol: 'Benvinguda',
      text: 'Hola! Moltes gràcies pel teu interès en la nostra sortida en barco 🚤\n\nPer confirmar disponibilitat, em pots dir el dia que voldríeu i quantes persones sereu?'
    },
    {
      id: 'p-catering',
      titol: 'Oferir catering / dinar a bord',
      text: 'Oferim catering a bord perquè no t\'hagis de preocupar de res durant la sortida 🍽️ T\'ho portem des del nostre restaurant amb una llanxa.\n\n🥘 Paelles i arrossos (per ració):\n• Paella de verdures — 37 €\n• Paella de marisc — 47 €\n• Paella mixta (carn i marisc) — 50 €\n• Arròs cremós amb marisc i bogavant — 52 €\n\n🥤 Begudes (a bord, lliure):\n• Amb alcohol (refrescos, vi i cervesa) — 25 €/persona\n• Sense alcohol (només refrescos) — 15 €/persona\n\n🫒 Pica-pica:\n• Bàsic (patates, olives, fuet) — 10 €/persona\n• Complet (+ amanida de pasta, entrepans i macedònia) — 25 €/persona\n\n🍽️ Packs:\n• Pack complet (menjar + begudes amb alcohol) — 45 €/persona\n• Pack complet (menjar + begudes sense alcohol) — 40 €/persona\n\nDigues-me què voleu i per quantes persones, i si hi ha alguna al·lèrgia 😊'
    },
    {
      id: 'p-confirmacio',
      titol: 'Confirmació de reserva',
      text: 'Perfecte, queda confirmat ✅\n\n📅 Dia: \n🕐 Hora i durada: \n👥 Persones: \n📍 Punt de trobada: \n\nQualsevol cosa em dius. Ens veiem!'
    },
    {
      id: 'p-trobada',
      titol: 'Punt de trobada',
      text: 'Ens trobem al port [NOM DEL PORT], al pantalà [X]. Vine uns 15 minuts abans per fer la sortida amb temps.\n\nT\'envio la ubicació exacta per aquí.'
    },
    {
      id: 'p-meteo',
      titol: 'Avís meteorologia',
      text: 'Hola! Estem mirant la previsió del temps pel dia de la sortida. Si hi hagués mal temps, et proposaríem canviar a un altre dia sense cap problema. T\'aniré informant 🌤️'
    }
  ];

  const DEFECTE = {
    settings: {
      barco: 'Hotel Barcarola',
      restaurant: '',
      patro: '',
      telCuina: '',
      telPatro: '',
      comissio: 10,
      // Dades de l'emissor per a les factures de comissió al propietari
      factNom: 'Proavela',
      factNif: '',
      factAdreca: '',
      factIva: 21
    },
    barcos: [],
    reserves: [],
    plantilles: PLANTILLES_DEFECTE,
    bloquejats: []
  };

  function llegir() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFECTE);
      const dades = JSON.parse(raw);
      // Completar camps que puguin faltar
      const res = {
        settings: Object.assign({}, DEFECTE.settings, dades.settings),
        barcos: Array.isArray(dades.barcos) ? dades.barcos : [],
        reserves: Array.isArray(dades.reserves) ? dades.reserves : [],
        plantilles: Array.isArray(dades.plantilles) && dades.plantilles.length
          ? dades.plantilles : structuredClone(PLANTILLES_DEFECTE),
        bloquejats: Array.isArray(dades.bloquejats) ? dades.bloquejats : []
      };
      migrar(res);
      return res;
    } catch (e) {
      console.error('Error llegint dades', e);
      return structuredClone(DEFECTE);
    }
  }

  /* Migració: dades antigues d'un sol barco → llista de barcos.
     Crea el primer barco a partir dels ajustos i hi assigna les reserves. */
  function migrar(d) {
    let canvis = false;
    if (!d.barcos.length) {
      d.barcos.push({
        id: 'b-1',
        nom: (d.settings.barco || 'El meu barco'),
        propietari: '',
        nifProp: '',
        comissio: (typeof d.settings.comissio === 'number' && d.settings.comissio > 0) ? d.settings.comissio : 10
      });
      canvis = true;
    }
    const primerId = d.barcos[0].id;
    d.reserves.forEach(r => {
      if (!r.barcoId) { r.barcoId = primerId; canvis = true; }
    });
    if (canvis) escriure(d);
  }

  function escriure(dades) {
    localStorage.setItem(KEY, JSON.stringify(dades));
  }

  let dades = llegir();

  return {
    // --- Ajustos ---
    getSettings() { return Object.assign({}, dades.settings); },
    saveSettings(s) { dades.settings = Object.assign({}, dades.settings, s); escriure(dades); },

    // --- Barcos ---
    getBarcos() { return dades.barcos.slice(); },
    getBarco(id) { return dades.barcos.find(b => b.id === id) || null; },
    saveBarco(b) {
      if (b.id) {
        const i = dades.barcos.findIndex(x => x.id === b.id);
        if (i >= 0) dades.barcos[i] = b; else dades.barcos.push(b);
      } else {
        b.id = 'b-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        dades.barcos.push(b);
      }
      escriure(dades);
      return b;
    },
    deleteBarco(id) {
      if (dades.barcos.length <= 1) return false; // sempre ha de quedar un barco
      if (dades.reserves.some(r => r.barcoId === id)) return false; // té reserves
      dades.barcos = dades.barcos.filter(b => b.id !== id);
      escriure(dades);
      return true;
    },

    // --- Reserves ---
    getReserves() { return dades.reserves.slice(); },
    getReserva(id) { return dades.reserves.find(r => r.id === id) || null; },
    saveReserva(r) {
      if (r.id) {
        const i = dades.reserves.findIndex(x => x.id === r.id);
        if (i >= 0) dades.reserves[i] = r; else dades.reserves.push(r);
      } else {
        r.id = 'r-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        r.creada = new Date().toISOString();
        dades.reserves.push(r);
      }
      escriure(dades);
      return r;
    },
    deleteReserva(id) {
      dades.reserves = dades.reserves.filter(r => r.id !== id);
      escriure(dades);
    },

    // --- Plantilles ---
    getPlantilles() { return dades.plantilles.slice(); },
    savePlantilla(p) {
      if (p.id) {
        const i = dades.plantilles.findIndex(x => x.id === p.id);
        if (i >= 0) dades.plantilles[i] = p; else dades.plantilles.push(p);
      } else {
        p.id = 'p-' + Date.now();
        dades.plantilles.push(p);
      }
      escriure(dades);
      return p;
    },
    deletePlantilla(id) {
      dades.plantilles = dades.plantilles.filter(p => p.id !== id);
      escriure(dades);
    },

    // --- Dies bloquejats ---
    getBloquejats() { return dades.bloquejats.slice(); },
    getBloqueig(iso) { return dades.bloquejats.find(b => b.data === iso) || null; },
    saveBloqueig(iso, motiu) {
      const i = dades.bloquejats.findIndex(b => b.data === iso);
      const reg = { data: iso, motiu: (motiu || '').trim() };
      if (i >= 0) dades.bloquejats[i] = reg; else dades.bloquejats.push(reg);
      escriure(dades);
      return reg;
    },
    deleteBloqueig(iso) {
      dades.bloquejats = dades.bloquejats.filter(b => b.data !== iso);
      escriure(dades);
    },

    // --- Còpia de seguretat ---
    exportar() { return JSON.stringify(dades, null, 2); },
    importar(json) {
      const nou = JSON.parse(json);
      dades = {
        settings: Object.assign({}, DEFECTE.settings, nou.settings),
        barcos: Array.isArray(nou.barcos) ? nou.barcos : [],
        reserves: Array.isArray(nou.reserves) ? nou.reserves : [],
        plantilles: Array.isArray(nou.plantilles) ? nou.plantilles : structuredClone(PLANTILLES_DEFECTE),
        bloquejats: Array.isArray(nou.bloquejats) ? nou.bloquejats : []
      };
      migrar(dades);
      escriure(dades);
    }
  };
})();
