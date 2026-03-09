// ✅ SOSTITUITO CON CLIENT CENTRALIZZATO
const supabaseClient = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

// ✅ CONTROLLO CLIENT INIZIALE
if (!supabaseClient) {
    console.error('Client Supabase non disponibile');
    mostraNotifica('Connessione al database non disponibile', 'errore');
}

// ✅ SOSTITUITO con authGetUtente()
const utenteCorrente = typeof authGetUtente === 'function' ? authGetUtente() : null;
const tecnicoLoggato = utenteCorrente ? utenteCorrente.nome_completo : null;

let datiMontaggio = null;      // Dati del montaggio dalla tabella 'montaggi'
let codMontaggio = null;       // cod_montaggio (es: "007" o "001")
let interventoEditID = null;   // ID per la modalità edit

// Funzione per mostrare notifiche (compatibile con le altre pagine)
function mostraNotifica(messaggio, tipo = 'info') {
    // Rimuovi notifica esistente
    const notificaEsistente = document.querySelector('.notifica');
    if (notificaEsistente) notificaEsistente.remove();
    
    // Crea nuova notifica
    const notifica = document.createElement('div');
    notifica.className = `notifica ${tipo}`;
    
    let icona = 'info';
    if (tipo === 'successo') icona = 'check_circle';
    if (tipo === 'errore') icona = 'error';
    
    notifica.innerHTML = `
        <span class="material-symbols-rounded" style="font-size: 14px;">${icona}</span>
        <span>${messaggio}</span>
    `;
    
    document.body.appendChild(notifica);
    
    setTimeout(() => {
        if (notifica.parentNode) {
            notifica.style.opacity = '0';
            notifica.style.transform = 'translateX(-50%) translateY(-5px)';
            notifica.style.transition = 'all 0.15s ease';
            
            setTimeout(() => {
                if (notifica.parentNode) notifica.remove();
            }, 150);
        }
    }, 1500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Caricamento iniziale
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // ✅ CONTROLLO CLIENT
        if (!supabaseClient) {
            mostraNotifica('Errore di connessione al database', 'errore');
            return;
        }
        
        // Ottieni ID impianto dall'URL (es: ?id=Q2K10001)
        const urlParams = new URLSearchParams(window.location.search);
        const impiantoId = urlParams.get('id');
        
        if (!impiantoId) {
            mostraNotifica('Nessun impianto specificato', 'errore');
            setTimeout(() => {
                window.location.href = 'montaggi.html';
            }, 1500);
            return;
        }

        // 1. CARICA DATI MONTAGGIO
        const { data: montaggioData, error: montError } = await supabaseClient
            .from('montaggi')
            .select('*')
            .eq('impianto', impiantoId)
            .single();
        
        if (montError) throw new Error(`Errore caricamento montaggio: ${montError.message}`);
        
        datiMontaggio = montaggioData;
        codMontaggio = datiMontaggio.cod_montaggio;

        // 2. POPOLA INTERFACCIA
        // Codice montaggio
        document.getElementById('display-codice-montaggio').textContent = codMontaggio || 'N/D';
        
        // Impianto e indirizzo
        document.getElementById('display-impianto').textContent = datiMontaggio.impianto || 'N/D';
        document.getElementById('display-indirizzo').textContent = datiMontaggio.Indirizzo || 'Indirizzo non disponibile';
        document.getElementById('display-cliente').textContent = datiMontaggio.cliente || 'Cliente non specificato';
        
        // 3. CONTROLLO MODALITÀ EDIT
        const mode = urlParams.get('mode');
        const datiEdit = localStorage.getItem('edit_intervento');
        
        if (mode === 'edit' && datiEdit) {
            const intervento = JSON.parse(datiEdit);
            console.log('Modalità EDIT montaggio:', intervento);
            
            // Precompila i campi con i dati dell'intervento
            precompilaModifica(intervento);
            
            // Cambia testo pulsante
            const btnSalva = document.querySelector('button[onclick="salvaIntervento()"]');
            if (btnSalva) {
                btnSalva.innerText = 'AGGIORNA MONTAGGIO';
            }
            
            // Salva ID per l'aggiornamento
            interventoEditID = intervento.ID;
        } else {
            // Modalità NORMALE: data odierna di default
            const elData = document.getElementById('data-lavoro');
            if (elData && !elData.value) {
                elData.valueAsDate = new Date();
            }
        }

        // 4. CONTROLLO GIORNO FESTIVO
        const elData = document.getElementById('data-lavoro');
        if (elData) {
            elData.addEventListener('change', controllaGiornoFestivo);
            setTimeout(() => controllaGiornoFestivo(), 200);
        }

    } catch (error) {
        console.error('Errore inizializzazione:', error);
        mostraNotifica(`Errore: ${error.message}`, 'errore');
        setTimeout(() => {
            window.location.href = 'montaggi.html';
        }, 1500);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Funzione per precompilare i campi in modalità edit
// ─────────────────────────────────────────────────────────────────────────────
function precompilaModifica(intervento) {
    console.log('Precompilazione montaggio:', intervento);
    
    // Data lavoro
    const yyyy = String(intervento.anno);
    const mm = String(intervento.mese).padStart(2, '0');
    const dd = String(intervento.giorno).padStart(2, '0');
    const dataInput = document.getElementById('data-lavoro');
    if (dataInput) {
        dataInput.value = `${yyyy}-${mm}-${dd}`;
    }
    
    // Tipo ore - Determina se sono straordinarie o ordinarie
    const radioOrdinarie = document.querySelector('input[value="ORDINARIE"]');
    const radioStraordinarie = document.querySelector('input[value="STRAORDINARIE"]');
    
    if (intervento.ore_stra > 0 || (intervento.inizio_int && intervento.fine_int)) {
        // Ha ore straordinarie o orari specifici → Straordinarie
        if (radioStraordinarie) {
            radioStraordinarie.checked = true;
            updateUI();
            
            // Imposta orari se disponibili
            if (intervento.inizio_int && intervento.fine_int) {
                document.getElementById('ora-inizio').value = intervento.inizio_int.substring(0, 5);
                document.getElementById('ora-fine').value = intervento.fine_int.substring(0, 5);
                calcolaOre();
            }
        }
    } else {
        // Solo ore ordinarie
        if (radioOrdinarie) {
            radioOrdinarie.checked = true;
            updateUI();
            document.getElementById('ore-ord-manual').value = intervento.ore_ord || 0;
        }
    }
    
    // Ore viaggio
    document.getElementById('ore-viaggio').value = intervento.ore_viaggio || 0;
    
    // Note
    document.getElementById('note').value = intervento.note || '';
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
    
    const dataSection = dataInput.closest('.section-card');
    if (!dataSection) return;
    
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
        
        // Controlla se è selezionato "ORDINARIE" e forza cambio
        const radioOrdinarie = document.querySelector('input[value="ORDINARIE"]');
        const radioStraordinarie = document.querySelector('input[value="STRAORDINARIE"]');
        
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
        
        // Disabilita radio "Ordinarie"
        if (radioOrdinarie) {
            radioOrdinarie.disabled = true;
            const radioBtn = radioOrdinarie.closest('.radio-btn');
            if (radioBtn) {
                radioBtn.style.opacity = '0.5';
                radioBtn.style.cursor = 'not-allowed';
            }
        }
        
    } else {
        // Rimuovi stile festivo
        dataSection.style.border = '';
        dataSection.style.backgroundColor = '';
        
        // Rimuovi nota
        const notaFestivo = dataSection.querySelector('.nota-festivo');
        if (notaFestivo) notaFestivo.remove();
        
        // Riabilita radio "Ordinarie"
        const radioOrdinarie = document.querySelector('input[value="ORDINARIE"]');
        if (radioOrdinarie) {
            radioOrdinarie.disabled = false;
            const radioBtn = radioOrdinarie.closest('.radio-btn');
            if (radioBtn) {
                radioBtn.style.opacity = '1';
                radioBtn.style.cursor = 'pointer';
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI toggle (Ordinarie vs Straordinarie)
// ─────────────────────────────────────────────────────────────────────────────
function updateUI() {
    const tipoOre = document.querySelector('input[name="tipo-ore"]:checked').value;
    
    document.getElementById('box-ore-dirette').style.display = 
        (tipoOre === 'ORDINARIE') ? 'block' : 'none';
    
    document.getElementById('box-orari').style.display = 
        (tipoOre === 'STRAORDINARIE') ? 'block' : 'none';
    
    // Se straordinarie, calcola ore
    if (tipoOre === 'STRAORDINARIE') {
        calcolaOre();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validazione e calcolo orari (stesso sistema di nuovo_lavoro.js)
// ─────────────────────────────────────────────────────────────────────────────
function validateTimeAndCalculate(input) {
    if (!input.value) return;
    
    let [h, m] = input.value.split(':').map(Number);
    
    // Arrotondamento a 15' (stesso sistema)
    m = Math.round(m / 15) * 15;
    if (m === 60) { 
        m = 0; 
        h = (h + 1) % 24; 
    }
    
    input.value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    calcolaOre();
}

function calcolaOre() {
    const inizio = document.getElementById('ora-inizio').value;
    const fine = document.getElementById('ora-fine').value;
    const dataVal = document.getElementById('data-lavoro').value;
    
    if (!inizio || !fine || !dataVal) return;

    // Usa la stessa funzione di calcolo di nuovo_lavoro.js
    const res = processHoursMontaggio(inizio, fine, new Date(dataVal).getDay());
    
    document.getElementById('res-ord').textContent = res.ord.toFixed(2);
    document.getElementById('res-stra').textContent = res.stra.toFixed(2);
}

function checkLimiti(input, min, max) {
    let val = parseFloat(input.value);
    
    if (isNaN(val) || val < min) {
        input.value = min;
    } else if (val > max) {
        input.value = max;
        mostraNotifica(`Il valore massimo consentito è ${max}`, 'errore');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcolo ore per montaggi (adattato da nuovo_lavoro.js)
// ─────────────────────────────────────────────────────────────────────────────
function processHoursMontaggio(inizio, fine, dayOfWeek) {
    const total = calculateTotalDiff(inizio, fine); // in ore
    
    // Weekend: tutto straordinario
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return { ord: 0, stra: total };
    }

    // Feriale: fasce come in nuovo_lavoro.js
    let [hIn, mIn] = inizio.split(':').map(Number);
    let [hFi, mFi] = fine.split(':').map(Number);
    let startMin = hIn * 60 + mIn;
    let endMin = hFi * 60 + mFi;
    
    if (endMin < startMin) endMin += 1440; // attraversa mezzanotte

    let ord = 0, stra = 0;
    for (let m = startMin; m < endMin; m++) {
        const hh = (m / 60) % 24;

        // Fasce ordinarie: [8,12) e [13,17) - STESSO SISTEMA
        const isOrd = (hh >= 8 && hh < 12) || (hh >= 13 && hh < 17);

        if (isOrd) ord++;
        else stra++;
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
// Salvataggio/aggiornamento intervento montaggio
// ─────────────────────────────────────────────────────────────────────────────
async function salvaIntervento() {
    try {
        // ✅ CONTROLLO CLIENT
        if (!supabaseClient) {
            mostraNotifica('Errore di connessione al database', 'errore');
            return;
        }
        
        // Validazione dati base
        if (!datiMontaggio || !codMontaggio) {
            mostraNotifica('Dati montaggio non disponibili', 'errore');
            return;
        }

        if (!tecnicoLoggato) {
            mostraNotifica('Tecnico non identificato', 'errore');
            return;
        }

        const dataSelezionata = new Date(document.getElementById('data-lavoro').value);
        const tipoOre = document.querySelector('input[name="tipo-ore"]:checked').value;
        
        // CALCOLO ORE
        let oreOrd = 0, oreStra = 0;
        let oraInizioIntervento = '08:00'; // default

        if (tipoOre === 'ORDINARIE') {
            // Ore ordinarie dirette
            oreOrd = parseFloat(document.getElementById('ore-ord-manual').value || '0') || 0;
            
            if (oreOrd <= 0) {
                mostraNotifica("Inserire almeno un'ora di lavoro", 'errore');
                return;
            }
        } else {
            // Ore da orari (straordinarie)
            const inizio = document.getElementById('ora-inizio').value;
            const fine = document.getElementById('ora-fine').value;
            
            if (!inizio || !fine) {
                mostraNotifica("Inserire orario di inizio e fine", 'errore');
                return;
            }

            const res = processHoursMontaggio(inizio, fine, dataSelezionata.getDay());
            oreOrd = res.ord;
            oreStra = res.stra;
            oraInizioIntervento = inizio;

            if (oreOrd <= 0 && oreStra <= 0) {
                mostraNotifica("Intervallo orario non valido", 'errore');
                return;
            }
        }

        const totaleOreLavoro = oreOrd + oreStra;
        const oreViaggio = parseFloat(document.getElementById('ore-viaggio').value || '0') || 0;
        const note = document.getElementById('note').value;

        // PAYLOAD per Supabase (coerente con tabella fogliolavoro)
        const payload = {
            tecnico: tecnicoLoggato,
            giorno: dataSelezionata.getDate(),
            mese: dataSelezionata.getMonth() + 1,
            anno: dataSelezionata.getFullYear(),
            
            // CODICE: sempre cod_montaggio (es: "007" o "001")
            codice: codMontaggio,
            
            // IMPIANTO: codice impianto dalla tabella montaggi
            impianto: datiMontaggio.impianto,
            
            // INDIRIZZO: dall'impianto
            indirizzo: datiMontaggio.Indirizzo || '',
            
            // TIPO FISSO: "MONTAGGIO"
            ch_rep: 'MONTAGGIO',
            
            // ORARI (solo se straordinarie)
            inizio_int: (tipoOre === 'STRAORDINARIE') ? document.getElementById('ora-inizio').value : null,
            fine_int: (tipoOre === 'STRAORDINARIE') ? document.getElementById('ora-fine').value : null,
            
            // ORE
            ore_ord: oreOrd,
            ore_stra: oreStra,
            ore: totaleOreLavoro,
            ore_viaggio: oreViaggio,
            
            // NOTE
            note: note,
            
            // COLONNE EXTRA (come in nuovo_lavoro.js)
            data: formatDataOra(dataSelezionata, oraInizioIntervento),
            settimana: getWeekNumber(dataSelezionata),
            "Data/ora creazione": formatDataOra(new Date())
        };

        // DETERMINA SE È INSERT O UPDATE
        let operazione;
        
        if (interventoEditID) {
            // MODALITÀ EDIT: UPDATE
            console.log('Aggiornamento montaggio ID:', interventoEditID);
            const { error } = await supabaseClient
                .from('fogliolavoro')
                .update(payload)
                .eq('ID', interventoEditID);
            
            operazione = 'update';
            if (error) throw error;
            mostraNotifica('Montaggio aggiornato con successo!', 'successo');
        } else {
            // MODALITÀ NUOVO: INSERT
            console.log('Inserimento nuovo montaggio');
            const { error } = await supabaseClient
                .from('fogliolavoro')
                .insert([payload]);
            
            operazione = 'insert';
            if (error) throw error;
            mostraNotifica('Montaggio salvato con successo!', 'successo');
        }

        // Pulisci localStorage e reindirizza
        localStorage.removeItem('edit_intervento');
        
        // REDIRECT
        setTimeout(() => {
            if (operazione === 'update') {
                window.location.href = 'calendario.html';
            } else {
                window.location.href = 'montaggi.html';
            }
        }, 1500);

    } catch (error) {
        console.error('Errore salvataggio:', error);
        mostraNotifica('Errore durante il salvataggio: ' + error.message, 'errore');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility functions (stesse di nuovo_lavoro.js)
// ─────────────────────────────────────────────────────────────────────────────
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDate() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatDataOra(date, hours = null) {
    const gg = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const aaaa = date.getFullYear();
    const orario = hours || 
        (String(date.getHours()).padStart(2, '0') + ":" + 
         String(date.getMinutes()).padStart(2, '0'));
    return `${gg}/${mm}/${aaaa} ${orario}`;
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