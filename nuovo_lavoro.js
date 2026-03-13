// ✅ SOSTITUITO CON CLIENT CENTRALIZZATO
const supabaseClient = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

// ✅ CONTROLLO CLIENT INIZIALE
if (!supabaseClient) {
    console.error('Client Supabase non disponibile');
    alert('Errore di connessione al database');
}

// === Stato globale / contesto ===
const impiantoCorrente = JSON.parse(localStorage.getItem('selected_plant')); // {id, impianto, codice, nome, indirizzo, ...}
// ✅ SOSTITUITO con authGetUtente()
const utenteCorrente = typeof authGetUtente === 'function' ? authGetUtente() : null;
const tecnicoLoggato = utenteCorrente ? utenteCorrente.nome_completo : null;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: determinazione impianto (UNA SOLA FONTE DI VERITÀ)
// ─────────────────────────────────────────────────────────────────────────────
function getImpiantoBaseFromContext() {
  const urlParams = new URLSearchParams(window.location.search);
  const idDalLink = urlParams.get('id');

  // Ordine di preferenza: ?id=  → impiantoCorrente.id → impiantoCorrente.impianto → impiantoCorrente.codice → impiantoCorrente.nome
  if (idDalLink && idDalLink.trim() !== '') return idDalLink.trim().toUpperCase();

  if (impiantoCorrente) {
    if (impiantoCorrente.id)       return String(impiantoCorrente.id).trim().toUpperCase();
    if (impiantoCorrente.impianto) return String(impiantoCorrente.impianto).trim().toUpperCase();
    if (impiantoCorrente.codice)   return String(impiantoCorrente.codice).trim().toUpperCase();
    if (impiantoCorrente.nome)     return String(impiantoCorrente.nome).trim().toUpperCase();
  }
  return 'N/D';
}

// Per codici 13/10 si usa SEMPRE la commessa; altrimenti il codice base calcolato sopra.
function deriveImpiantoForDB(codiceSelezionato) {
  if (codiceSelezionato === '13' || codiceSelezionato === '10') {
    const comm = (document.getElementById('input-commessa').value || '').trim().toUpperCase();
    return comm;
  }
  return getImpiantoBaseFromContext();
}

// ─────────────────────────────────────────────────────────────────────────────
// UI bootstrap
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode'); // "edit" | null
  const datiEdit = localStorage.getItem('edit_intervento');

  // Se NON sono in edit, pulisco eventuali residui
  if (mode !== 'edit') localStorage.removeItem('edit_intervento');

  // Data odierna di default
  const elData = document.getElementById('data-lavoro');
  if (elData && !elData.value) elData.valueAsDate = new Date();

  // Visualizzazione impianto
  const elDispImp = document.getElementById('display-impianto');
  const elInd = document.getElementById('display-indirizzo');

  // Modalità EDIT: precompilazione COMPLETA
  if (mode === 'edit' && datiEdit) {
    const intervento = JSON.parse(datiEdit);

    // IMPIANTO e INDIRIZZO dall'intervento originale
    if (elDispImp) elDispImp.innerText = intervento.impianto || 'N/D';
    if (elInd) elInd.innerText = intervento.indirizzo || '';

    // Seleziona card codice
    const cards = Array.from(document.querySelectorAll('.card-codice'));
    const cardTarget = cards.find(c => (c.getAttribute('onclick') || '').includes(`'${intervento.codice}'`));
    if (cardTarget) selectCodice(intervento.codice, cardTarget);

    // Data in formato yyyy-mm-dd
    const yyyy = String(intervento.anno);
    const mm   = String(intervento.mese).padStart(2, '0');
    const dd   = String(intervento.giorno).padStart(2, '0');
    document.getElementById('data-lavoro').value = `${yyyy}-${mm}-${dd}`;

    // Note / ore viaggio
    document.getElementById('note').value = intervento.note || '';
    document.getElementById('ore-viaggio').value = intervento.ore_viaggio ?? intervento.ore_via ?? 0;

    // Tipo
    const radioTipo = document.querySelector(`input[name="tipo"][value="${intervento.ch_rep}"]`);
    if (radioTipo) {
      radioTipo.checked = true;
      updateUI();
    }

    // Se 13/10 → mostra e precompila commessa con il valore in DB
    if (intervento.codice === '13' || intervento.codice === '10') {
      document.getElementById('display-impianto').style.display = 'none';
      document.getElementById('input-commessa').style.display = 'block';
      document.getElementById('input-commessa').value = (intervento.impianto || '').toString().toUpperCase().slice(0, 8);
    }

    // Orari / anteprima ore
    if (intervento.ch_rep === 'ORDINARIA') {
      document.getElementById('ore-ord-manual').value = intervento.ore_ord ?? 0;
    } else {
      document.getElementById('ora-inizio').value = intervento.inizio_int || '';
      document.getElementById('ora-fine').value   = intervento.fine_int   || '';

      // Calcolo anteprima
      const res = processHours(
        document.getElementById('ora-inizio').value,
        document.getElementById('ora-fine').value,
        intervento.ch_rep,
        new Date(document.getElementById('data-lavoro').value).getDay()
      );
      document.getElementById('res-ord').innerText  = res.ord.toFixed(2);
      document.getElementById('res-stra').innerText = res.stra.toFixed(2);
    }

    const btnSalva = document.querySelector('button[onclick="salvaIntervento()"]');
    if (btnSalva) btnSalva.innerText = 'AGGIORNA INTERVENTO';
    
  } else {
    // Modalità NORMALE: usa dati dalla cache
    const impiantoBase = getImpiantoBaseFromContext();
    if (elDispImp) elDispImp.innerText = impiantoBase;
    
    if (impiantoCorrente && impiantoCorrente.indirizzo && elInd) {
      elInd.innerText = impiantoCorrente.indirizzo;
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Selezione codice (fusione: UX + logica commessa/visibilità etichette)
// ─────────────────────────────────────────────────────────────────────────────
function selectCodice(val, element) {
  // estetica
  document.querySelectorAll('.card-codice').forEach(c => {
    c.classList.remove('active');
    c.style.borderColor = '#e2e8f0';
    c.style.background = 'white';
  });
  element.classList.add('active');
  element.style.borderColor = '#2563eb';
  element.style.background = '#eff6ff';

  // set hidden + mostra area di lavoro
  document.getElementById('select-codice').value = val;
  const area = document.getElementById('area-lavoro');
  if (area) area.style.display = 'block';

  // visibilità STRA e REPERIB. (come in _f)
  document.getElementById('label-stra').style.display = (['21', '22', '13', '10'].includes(val)) ? 'flex' : 'none';
  document.getElementById('label-rep').style.display  = (val === '22') ? 'flex' : 'none';

  // commessa per 13/10
  const isCommessa = (val === '13' || val === '10');
  document.getElementById('display-impianto').style.display = isCommessa ? 'none'  : 'block';
  document.getElementById('input-commessa').style.display    = isCommessa ? 'block' : 'none';
  if (isCommessa && impiantoCorrente && impiantoCorrente.id) {
    document.getElementById('input-commessa').value = String(impiantoCorrente.id).toUpperCase().substring(0, 8);
  }

  updateUI();
}

// ─────────────────────────────────────────────────────────────────────────────
// UI toggle + calcolo live
// ─────────────────────────────────────────────────────────────────────────────
function updateUI() {
  const tipo = document.querySelector('input[name="tipo"]:checked').value;
  document.getElementById('box-ore-dirette').style.display = (tipo === 'ORDINARIA') ? 'block' : 'none';
  document.getElementById('box-orari').style.display       = (tipo !== 'ORDINARIA') ? 'block' : 'none';
  if (tipo !== 'ORDINARIA') calcolaOre();
}

function validateTimeAndCalculate(input) {
  if (!input.value) return;
  let [h, m] = input.value.split(':').map(Number);
  // arrotondamento a 15'
  m = Math.round(m / 15) * 15;
  if (m === 60) { m = 0; h = (h + 1) % 24; }
  input.value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  calcolaOre();
}

function calcolaOre() {
  const inizio = document.getElementById('ora-inizio').value;
  const fine   = document.getElementById('ora-fine').value;
  const tipo   = document.querySelector('input[name="tipo"]:checked').value;
  const dataVal = document.getElementById('data-lavoro').value;
  if (!inizio || !fine || !dataVal) return;

  const res = processHours(inizio, fine, tipo, new Date(dataVal).getDay());
  document.getElementById('res-ord').innerText  = res.ord.toFixed(2);
  document.getElementById('res-stra').innerText = res.stra.toFixed(2);
}

// clamp numerico (fix encoding messaggio)
function checkLimiti(input, min, max) {
  let val = parseFloat(input.value);
  if (isNaN(val) || val < min) {
    input.value = min;
  } else if (val > max) {
    input.value = max;
    alert(`Il valore massimo consentito è ${max}`);
  }
}

async function salvaIntervento() {
  // ✅ AGGIUNTO CONTROLLO CLIENT
  if (!supabaseClient) {
    alert('Errore di connessione al database');
    return;
  }
  
  const codice = document.getElementById('select-codice').value;
  if (!codice) { alert('Seleziona un codice!'); return; }

  const tipo = document.querySelector('input[name="tipo"]:checked').value;
  const dataSelezionata = new Date(document.getElementById('data-lavoro').value);

  // Determina indirizzo corretto
  let indirizzoFinale = '';
  const mode = new URLSearchParams(window.location.search).get('mode');
  const datiEdit = mode === 'edit' ? JSON.parse(localStorage.getItem('edit_intervento') || '{}') : null;
  
  // ✅ FIX: Assegna l'indirizzo corretto
  if (mode === 'edit' && datiEdit && datiEdit.indirizzo) {
    // In modalità edit, usa l'indirizzo dell'intervento originale
    indirizzoFinale = datiEdit.indirizzo;
  } else if (impiantoCorrente && impiantoCorrente.indirizzo) {
    // In modalità nuovo, usa l'indirizzo dall'impianto corrente
    indirizzoFinale = impiantoCorrente.indirizzo;
  }

  // CALCOLO ORE
  let oreOrd = 0, oreStra = 0;
  let oraInizioIntervento = '08:00'; // default per campo "data" se ordinaria
  
  if (tipo === 'ORDINARIA') {
    oreOrd = parseFloat(document.getElementById('ore-ord-manual').value || '0') || 0;
  } else {
    // se presente anteprima, uso quella; altrimenti calcolo
    const anteOrd = parseFloat(document.getElementById('res-ord').innerText || '0') || 0;
    const anteStra = parseFloat(document.getElementById('res-stra').innerText || '0') || 0;
    
    if ((anteOrd + anteStra) === 0) {
      const res = processHours(
        document.getElementById('ora-inizio').value,
        document.getElementById('ora-fine').value,
        tipo,
        dataSelezionata.getDay()
      );
      oreOrd = res.ord; 
      oreStra = res.stra;
    } else {
      oreOrd = anteOrd; 
      oreStra = anteStra;
    }
    
    if (document.getElementById('ora-inizio').value) {
      oraInizioIntervento = document.getElementById('ora-inizio').value;
    }
  }

  if (oreOrd <= 0 && oreStra <= 0) {
    alert("ERRORE: Inserire almeno un'ora di lavoro.");
    return;
  }

  // CONTROLLO BLOCCAGGIO MESE (se in modifica)
  if (mode === 'edit' && datiEdit) {
    const meseIntervento = parseInt(datiEdit.mese);
    const annoIntervento = parseInt(datiEdit.anno);
    
    // Controlla se il mese è bloccato usando la stessa funzione del calendario
    if (typeof isMeseBloccato === 'function' && isMeseBloccato(meseIntervento, annoIntervento)) {
      alert("⚠️ Non puoi modificare interventi di mesi bloccati.\nIl mese è stato chiuso per la rendicontazione.");
      return;
    }
    
    // Controlla se è "ALTRO"
    if (datiEdit.ch_rep === 'ALTRO') {
      alert("⚠️ Le voci 'ALTRO' (permessi/ferie/malattia) non possono essere modificate.\n\nSe hai sbagliato, cancella questa voce e inseriscine una nuova.");
      return;
    }
  }

  // IMPIANTO (commessa per 13/10, altrimenti base)
  const impiantoDB = deriveImpiantoForDB(codice);
  if ((codice === '13' || codice === '10')) {
    if (!impiantoDB || impiantoDB.length !== 8) {
      alert('Inserisci una commessa valida di 8 caratteri.');
      return;
    }
  }

  const totaleOreLavoro = oreOrd + oreStra;

  const payload = {
    tecnico: tecnicoLoggato,
    giorno: dataSelezionata.getDate(),
    mese: dataSelezionata.getMonth() + 1,
    anno: dataSelezionata.getFullYear(),
    codice: codice,

    // campo impianto: coerente con la visualizzazione e con le regole commessa
    impianto: impiantoDB,

    // INDIRIZZO: ora valorizzato correttamente
    indirizzo: indirizzoFinale,
    
    ch_rep: tipo,
    inizio_int: (tipo !== 'ORDINARIA') ? document.getElementById('ora-inizio').value : null,
    fine_int:   (tipo !== 'ORDINARIA') ? document.getElementById('ora-fine').value   : null,
    ore_ord: oreOrd,
    ore_stra: oreStra,
    ore: totaleOreLavoro, // colonna extra
    ore_viaggio: parseFloat(document.getElementById('ore-viaggio').value || '0') || 0,
    note: document.getElementById('note').value,

    // colonne extra
    data: formatDataOra(dataSelezionata, oraInizioIntervento),
    settimana: getWeekNumber(dataSelezionata),
    "Data/ora creazione": formatDataOra(new Date())
  };

  try {
    let messaggio = '';
    
    if (mode === 'edit' && datiEdit) {
      const { error } = await supabaseClient
        .from('fogliolavoro')
        .update(payload)
        .eq('ID', datiEdit.ID);
      if (error) throw error;
      messaggio = 'Intervento aggiornato!';
    } else {
      const { error } = await supabaseClient.from('fogliolavoro').insert([payload]);
      if (error) throw error;
      messaggio = 'Intervento salvato con successo!';
    }
    
    alert(messaggio); // ✅ Mostra il messaggio di conferma
    localStorage.removeItem('edit_intervento');
    
    // ✅ Redirect dopo il salvataggio riuscito
    if (mode === 'edit') {
        const urlParams = new URLSearchParams(window.location.search);
        const from = urlParams.get('from');
        
        if (from === 'calendario') {
            window.location.href = 'calendario.html';
        } else {
            window.location.href = 'parco.html';
        }
    } else {
        window.location.href = 'parco.html';
    }
    
  } catch (err) {
    alert('Errore durante il salvataggio: ' + err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: data, settimana ISO, calcolo ore (logica avanzata + mezzanotte)
// ─────────────────────────────────────────────────────────────────────────────
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatDataOra(date, hours = null) {
  const gg = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const aaaa = date.getFullYear();
  const orario = hours || (String(date.getHours()).padStart(2, '0') + ":" + String(date.getMinutes()).padStart(2, '0'));
  return `${gg}/${mm}/${aaaa} ${orario}`;
}

function processHours(inizio, fine, tipo, dayOfWeek) {
  if (tipo === 'REPERIBILITA') return { ord: 0, stra: calculateTotalDiff(inizio, fine) };

  const total = calculateTotalDiff(inizio, fine); // in ore (con wrap a 24h)
  if (dayOfWeek === 0 || dayOfWeek === 6) return { ord: 0, stra: total };

  // Feriale con fasce: 8–12 e 13–17 ordinarie; 12–13 e fuori fascia straordinarie
  let [hIn, mIn] = inizio.split(':').map(Number);
  let [hFi, mFi] = fine.split(':').map(Number);
  let startMin = hIn * 60 + mIn;
  let endMin   = hFi * 60 + mFi;
  if (endMin < startMin) endMin += 1440; // attraversa mezzanotte

  let ord = 0, stra = 0;
  for (let m = startMin; m < endMin; m++) {
    const hh = (m / 60) % 24;

    // ordinarie: [8,12) e [13,17)
    const isOrd =
      (hh >= 8 && hh < 12) ||
      (hh >= 13 && hh < 17);

    if (isOrd) ord++;
    else       stra++;
  }
  return { ord: ord / 60, stra: stra / 60 };
}

function calculateTotalDiff(i, f) {
  let [h1, m1] = i.split(':').map(Number);
  let [h2, m2] = f.split(':').map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  return (diff < 0 ? diff + 1440 : diff) / 60;
}


// ─────────────────────────────────────────────────────────────────────────────
// Controllo giorno festivo e gestione UI
// ─────────────────────────────────────────────────────────────────────────────
function controllaGiornoFestivo() {
    const dataInput = document.getElementById('data-lavoro');
    if (!dataInput || !dataInput.value) return;
    
    const data = new Date(dataInput.value);
   const giornoSettimana = data.getDay();
const isWeekend = (giornoSettimana === 0 || giornoSettimana === 6);
const isFestivoFisso = isFestivoNazionale(data);
const isFestivoMobileCheck = isFestivoMobile(data);
const isGiornoFestivo = isWeekend || isFestivoFisso || isFestivoMobileCheck;
    
    const dataSection = document.getElementById('data-lavoro').closest('.section-card');
    
    if (isGiornoFestivo) {
        // Aggiungi stile festivo
        dataSection.style.border = '2px solid #ef4444';
        dataSection.style.backgroundColor = '#fef2f2';
        
        // Aggiungi nota "GIORNO FESTIVO"
        let notaFestivo = dataSection.querySelector('.nota-festivo');
        if (!notaFestivo) {
            notaFestivo = document.createElement('div');
            notaFestivo.className = 'nota-festivo';
            notaFestivo.style.cssText = `
                font-size: 0.7rem;
                font-weight: 700;
                color: #dc2626;
                margin-top: 8px;
                display: flex;
                align-items: center;
                gap: 4px;
            `;
            notaFestivo.innerHTML = `
                <span class="material-symbols-rounded" style="font-size: 16px;">warning</span>
                GIORNO FESTIVO - Solo ore straordinarie
            `;
            dataSection.appendChild(notaFestivo);
        }
        
        // Controlla se è selezionato "ORDINARIA" e forza cambio
        const radioOrdinarie = document.querySelector('input[value="ORDINARIA"], input[value="ORDINARIE"]');
        const radioStraordinarie = document.querySelector('input[value="STRAORDINARIO"], input[value="STRAORDINARIE"]');
        
        if (radioOrdinarie && radioOrdinarie.checked) {
            // Forza cambio a straordinarie
            if (radioStraordinarie) {
                radioStraordinarie.checked = true;
                updateUI();
                
                // Mostra messaggio
                const messaggioDiv = document.createElement('div');
                messaggioDiv.style.cssText = `
                    background: #fef3c7;
                    border: 1px solid #f59e0b;
                    border-radius: 8px;
                    padding: 10px;
                    margin-top: 10px;
                    font-size: 0.8rem;
                    color: #92400e;
                    font-weight: 600;
                `;
                messaggioDiv.textContent = '⚠️ Giorno festivo: selezionate automaticamente ore straordinarie';
                
                const boxOre = document.getElementById('box-ore-dirette');
                if (boxOre) {
                    boxOre.parentNode.insertBefore(messaggioDiv, boxOre.nextSibling);
                    setTimeout(() => messaggioDiv.remove(), 5000);
                }
            }
        }
        
        // Disabilita radio "Ordinarie" se esiste
        if (radioOrdinarie) {
            radioOrdinarie.disabled = true;
            radioOrdinarie.closest('.radio-btn').style.opacity = '0.5';
            radioOrdinarie.closest('.radio-btn').style.cursor = 'not-allowed';
        }
        
    } else {
        // Rimuovi stile festivo
        dataSection.style.border = '';
        dataSection.style.backgroundColor = '';
        
        // Rimuovi nota
        const notaFestivo = dataSection.querySelector('.nota-festivo');
        if (notaFestivo) notaFestivo.remove();
        
        // Riabilita radio "Ordinarie"
        const radioOrdinarie = document.querySelector('input[value="ORDINARIA"], input[value="ORDINARIE"]');
        if (radioOrdinarie) {
            radioOrdinarie.disabled = false;
            radioOrdinarie.closest('.radio-btn').style.opacity = '1';
            radioOrdinarie.closest('.radio-btn').style.cursor = 'pointer';
        }
    }
}

// Esegui controllo al cambio data
document.addEventListener('DOMContentLoaded', () => {
    const dataInput = document.getElementById('data-lavoro');
    if (dataInput) {
        dataInput.addEventListener('change', controllaGiornoFestivo);
        
        // Controlla anche all'inizio se c'è già una data
        setTimeout(() => controllaGiornoFestivo(), 100);
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// Controllo festività nazionali italiane (fisse)
// ─────────────────────────────────────────────────────────────────────────────
function isFestivoNazionale(data) {
    const giorno = data.getDate();
    const mese = data.getMonth() + 1; // 0-11 → 1-12
    
    // Festività fisse italiane
    const festivitaFisse = [
        '01-01', // Capodanno
        '01-06', // Epifania
        '04-25', // Liberazione
        '05-01', // Festa del Lavoro
        '06-02', // Festa della Repubblica
        '08-15', // Ferragosto
        '11-01', // Ognissanti
        '12-08', // Immacolata
        '12-25', // Natale
        '12-26'  // Santo Stefano
    ];
    
    // Formatta mese-giorno come stringa (es: "01-01")
    const dataStr = `${mese.toString().padStart(2, '0')}-${giorno.toString().padStart(2, '0')}`;
    
    return festivitaFisse.includes(dataStr);
}

// ─────────────────────────────────────────────────────────────────────────────
// Controllo Pasqua (mobile) - Formula di Gauss
// ─────────────────────────────────────────────────────────────────────────────
function getPasqua(anno) {
    const a = anno % 19;
    const b = Math.floor(anno / 100);
    const c = anno % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    
    const mesePasqua = Math.floor((h + l - 7 * m + 114) / 31); // 3 o 4
    const giornoPasqua = ((h + l - 7 * m + 114) % 31) + 1;
    
    return new Date(anno, mesePasqua - 1, giornoPasqua);
}

function isFestivoMobile(data) {
    const anno = data.getFullYear();
    const pasqua = getPasqua(anno);
    
    // Date relative a Pasqua
    const lunediAngelo = new Date(pasqua);
    lunediAngelo.setDate(pasqua.getDate() + 1);
    
    // Festività mobili italiane
    const festivitaMobili = [
        pasqua,                 // Pasqua
        lunediAngelo            // Lunedì dell'Angelo (Pasquetta)
    ];
    
    // Controlla se la data corrisponde a una festività mobile
    return festivitaMobili.some(festivo => 
        festivo.getDate() === data.getDate() &&
        festivo.getMonth() === data.getMonth() &&
        festivo.getFullYear() === data.getFullYear()
    );
}