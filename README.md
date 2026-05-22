# Gestió Barco 🚤

App per gestionar les reserves del barco: clients, catering, calendari del patró
i generar el **full de servei en PDF** per enviar a la cuina i al patró per WhatsApp.

- ✅ **Gratis** i sense quotes
- ✅ **Dades 100% al teu dispositiu** (no surt res a internet)
- ✅ Funciona al **mòbil** com una app

---

## Què fa

| Pestanya | Per a què |
|----------|-----------|
| **Reserves** | Apunta cada reserva: client, telèfon, plataforma, dia, durada, persones, patró i catering. Botons per generar el **PDF** i **enviar-lo per WhatsApp**. |
| **Calendari** | Veus d'un cop d'ull quins dies tens reserves (i si el patró està lliure). |
| **Guanys** | La teva comissió **mes per mes** (per facturar): suma del lloguer + extres de cada mes i el teu % a sobre. Total de l'any a dalt. Les cancel·lades no compten. |
| **Plantilles** | Respostes ràpides per copiar i enganxar a ClickAndBoat / Samboat / WhatsApp (benvinguda, oferir catering, confirmació…). |
| **Ajustos** | Nom del barco, restaurant, patró per defecte, **% de comissió** i **còpia de seguretat** de les dades. |

> A cada reserva poses el **preu del lloguer** i els **extres / catering** per separat; l'app calcula el teu % sobre el total (lloguer + extres).

---

## Com posar-la al mòbil (gratis)

Les dades sempre es guarden al teu telèfon. L'única cosa que cal és obrir l'app
des d'una adreça web. La manera més fàcil i gratuïta:

### Opció A — Netlify Drop (recomanada, sense compte)
1. Al ordinador, ves a **https://app.netlify.com/drop**
2. Arrossega la carpeta `Barcos` sencera a la pàgina.
3. Et donarà una adreça (ex: `https://algun-nom.netlify.app`).
4. Obre aquesta adreça al **mòbil**.
5. Menú del navegador → **"Afegeix a la pantalla d'inici"**. Ja la tens com una app.

> És gratuït. La web només serveix els fitxers; les teves reserves continuen
> guardant-se només al teu mòbil.

### Opció B — Provar-la a l'ordinador
A la carpeta del projecte, executa:
```
python3 -m http.server 8000
```
i obre **http://localhost:8000** al navegador.

---

## Còpia de seguretat (important!)

Com que les dades viuen al mòbil, si esborres les dades del navegador o canvies de
telèfon, es perden. Per això:

- A **Ajustos → Descarregar còpia** es baixa un fitxer amb totes les dades.
- Fes-ho de tant en tant i guarda el fitxer (correu, núvol…).
- Per recuperar-les: **Ajustos → Restaurar còpia**.

---

## Notes tècniques

- App estàtica (HTML/CSS/JS), sense servidor ni base de dades.
- Dades a `localStorage` del navegador.
- PDF generat en local amb [jsPDF](https://github.com/parallax/jsPDF) (`vendor/`).
- Compartir per WhatsApp fa servir la funció "Compartir" del mòbil (cal obrir l'app
  des d'una adreça `https://`, com la de Netlify, perquè funcioni del tot).
