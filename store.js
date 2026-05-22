/* store.js — Capa de dades local (localStorage). Res surt del dispositiu. */
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
      text: 'Una cosa que agrada molt: podem portar dinar a bord des del nostre restaurant 🍽️ T\'ho portem amb una llanxa durant la sortida.\n\nVols que t\'enviï el menú? Em dius quants menús i si hi ha alguna al·lèrgia.'
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
      barco: '',
      restaurant: '',
      patro: '',
      telCuina: '',
      telPatro: ''
    },
    reserves: [],
    plantilles: PLANTILLES_DEFECTE
  };

  function llegir() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFECTE);
      const dades = JSON.parse(raw);
      // Completar camps que puguin faltar
      return {
        settings: Object.assign({}, DEFECTE.settings, dades.settings),
        reserves: Array.isArray(dades.reserves) ? dades.reserves : [],
        plantilles: Array.isArray(dades.plantilles) && dades.plantilles.length
          ? dades.plantilles : structuredClone(PLANTILLES_DEFECTE)
      };
    } catch (e) {
      console.error('Error llegint dades', e);
      return structuredClone(DEFECTE);
    }
  }

  function escriure(dades) {
    localStorage.setItem(KEY, JSON.stringify(dades));
  }

  let dades = llegir();

  return {
    // --- Ajustos ---
    getSettings() { return Object.assign({}, dades.settings); },
    saveSettings(s) { dades.settings = Object.assign({}, dades.settings, s); escriure(dades); },

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

    // --- Còpia de seguretat ---
    exportar() { return JSON.stringify(dades, null, 2); },
    importar(json) {
      const nou = JSON.parse(json);
      dades = {
        settings: Object.assign({}, DEFECTE.settings, nou.settings),
        reserves: Array.isArray(nou.reserves) ? nou.reserves : [],
        plantilles: Array.isArray(nou.plantilles) ? nou.plantilles : structuredClone(PLANTILLES_DEFECTE)
      };
      escriure(dades);
    }
  };
})();
