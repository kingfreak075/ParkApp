const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Recupero dati dall'impianto selezionato nella pagina DETTAGLI
const impiantoCorrente = JSON.parse(localStorage.getItem('selected_plant'));
const tecnicoLoggato = localStorage.getItem('tecnico_loggato');

document.addEventListener('DOMContentLoaded', () => {
    if (!tecnicoLoggato || !impiantoCorrente) {
        alert("Errore: Dati impianto mancanti. Torna alla pagina ricerca.");
        window.location.href = 'parco.html';
        return;
    }

    // Inizializzazione UI con dati da localStorage
    document.getElementById('display-impianto').innerText = impiantoCorrente.nome;
    document.getElementById('display-indirizzo').innerText = impiantoCorrente.indirizzo;
    document.getElementById('data-lavoro').valueAsDate = new Date(); // Default oggi
});

/**
 * Gestisce il cambio del codice intervento
 */
function handleCodiceChange() {
    const cod = document.getElementById('select-codice').value;
    const boxTipo = document.getElementById('box-tipo');
    const labelStra = document.getElementById('label-stra');
    const labelRep = document.getElementById('label-rep');
    const inputCommessa = document.getElementById('input-commessa');
    const displayImpianto = document.getElementById('display-impianto');
    const labelImpianto = document.getElementById('label-impianto');

    boxTipo.style.display = 'block';
    
    // 1. Visibilità Radio Buttons in base al codice
    // 21, 13, 10 -> Ord e Stra | 22 -> Tutte e tre | 24 -> Solo Ord
    labelStra.style.display = (cod == '21' || cod == '22' || cod == '13' || cod == '10') ? 'flex' : 'none';
    labelRep.style.display = (cod == '22') ? 'flex' : 'none';

    // 2. Trasformazione Impianto in Commessa (Codici 13 e 10)
    if (cod == '13' || cod == '10') {
        labelImpianto.innerText = "Numero Commessa (8 caratteri)";
        displayImpianto.style.display = 'none';
        inputCommessa.style.display = 'block';
        // Pre-carica il codice impianto ma lascia modificare
        inputCommessa.value = impiantoCorrente.id || ''; 
    } else {
        labelImpianto.innerText = "Impianto";
        displayImpianto.style.display = 'block';
        inputCommessa.style.display = 'none';
    }

    // Reset a ORDINARIA ogni volta che cambia il codice per evitare errori
    document.querySelector('input[name="tipo"][value="ORDINARIA"]').checked = true;
    updateUI();
}

/**
 * Mostra/Nasconde i campi in base alla tipologia scelta (Ord/Stra/Rep)
 */
function updateUI() {
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    const boxOreDirette = document.getElementById('box-ore-dirette');
    const boxOrari = document.getElementById('box-orari');
    const cod = document.getElementById('select-codice').value;

    // Se ORDINARIA: mostra inserimento ore diretto
    if (tipo === 'ORDINARIA') {
        boxOreDirette.style.display = 'block';
        boxOrari.style.display = 'none';
        document.getElementById('preview-calcolo').style.display = 'none';
    } 
    // Se STRAORD o REPERIBILITA: mostra selettori orario
    else {
        boxOreDirette.style.display = 'none';
        boxOrari.style.display = 'block';
        calcolaOre(); // Ricalcola se c'erano già orari inseriti
    }
}

/**
 * Calcola la durata dell'intervento e mostra la preview dello split ore
 */
function calcolaOre() {
    const inizio = document.getElementById('ora-inizio').value;
    const fine = document.getElementById('ora-fine').value;
    const preview = document.getElementById('preview-calcolo');
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    const dataVal = document.getElementById('data-lavoro').value;

    if (!inizio || !fine) return;

    const d = new Date(dataVal);
    const results = processHours(inizio, fine, tipo, d.getDay());

    preview.style.display = 'block';
    document.getElementById('res-calcolo').innerText = (results.ord + results.stra).toFixed(2) + "h totali";
    
    let infoText = "";
    if (results.ord > 0) infoText += `Ordinarie: ${results.ord.toFixed(2)}h `;
    if (results.stra > 0) infoText += `Straordinarie: ${results.stra.toFixed(2)}h`;
    
    document.getElementById('split-info').innerText = infoText;
}

/**
 * LOGICA CORE: Splitta le ore tra Ordinarie e Straordinarie
 */
function processHours(inizio, fine, tipo, dayOfWeek) {
    // REPERIBILITA va sempre tutto in ore_stra
    if (tipo === 'REPERIBILITA') {
        return { ord: 0, stra: calculateTotalDiff(inizio, fine) };
    }
    
    const isFeriale = dayOfWeek !== 0 && dayOfWeek !== 6;
    const total = calculateTotalDiff(inizio, fine);

    // Sabato e Domenica -> Tutto Straordinario
    if (!isFeriale) return { ord: 0, stra: total };

    // Feriale -> Logica Split (Pausa 12-13 e Fine turno 17:00)
    let ord = 0;
    let stra = 0;
    
    let [hIn, mIn] = inizio.split(':').map(Number);
    let [hFi, mFi] = fine.split(':').map(Number);
    let startMin = hIn * 60 + mIn;
    let endMin = hFi * 60 + mFi;
    
    if (endMin < startMin) endMin += 1440; // Gestione scavalco mezzanotte

    for (let m = startMin; m < endMin; m++) {
        let currentHour = (m / 60) % 24;
        
        // Regola: Straordinario se in pausa pranzo (12-13) o fuori orario (prima 8, dopo 17)
        const isPausaPranzo = currentHour >= 12 && currentHour < 13;
        const isFuoriOrario = currentHour < 8 || currentHour >= 17;

        if (isPausaPranzo || isFuoriOrario) {
            stra++;
        } else {
            ord++;
        }
    }

    return { ord: ord / 60, stra: stra / 60 };
}

function calculateTotalDiff(i, f) {
    let [h1, m1] = i.split(':').map(Number);
    let [h2, m2] = f.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    return (diff < 0 ? diff + 1440 : diff) / 60;
}

/**
 * INVIO DATI A SUPABASE
 */
async function salvaIntervento() {
    const cod = document.getElementById('select-codice').value;
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    const dataVal = document.getElementById('data-lavoro').value;
    const oreViag = parseFloat(document.getElementById('ore-viaggio').value || 0);
    const noteVal = document.getElementById('note').value;
    const commessaInput = document.getElementById('input-commessa');

    if (!cod) { alert("Seleziona un codice intervento!"); return; }

    // Gestione Impianto/Commessa
    let nomeImpiantoFinale = impiantoCorrente.nome;
    if (cod == '13' || cod == '10') {
        const val = commessaInput.value.trim().toUpperCase();
        if (val.length !== 8) {
            alert("Per i codici 13 e 10 la commessa deve essere di esattamente 8 caratteri.");
            return;
        }
        nomeImpiantoFinale = val;
    }

    const d = new Date(dataVal);
    let oreOrd = 0;
    let oreStra = 0;

    if (tipo === 'ORDINARIA') {
        oreOrd = parseFloat(document.getElementById('ore-ord-manual').value || 0);
        if (oreOrd <= 0) { alert("Inserisci le ore lavorate!"); return; }
    } else {
        const inizio = document.getElementById('ora-inizio').value;
        const fine = document.getElementById('ora-fine').value;
        if (!inizio || !fine) { alert("Inserisci orario inizio e fine!"); return; }
        
        const res = processHours(inizio, fine, tipo, d.getDay());
        oreOrd = res.ord;
        oreStra = res.stra;
    }

    // Inserimento su Supabase
    const { error } = await supabaseClient.from('fogliolavoro').insert([{
        tecnico: tecnicoLoggato,
        giorno: d.getDate(),
        mese: d.getMonth() + 1,
        anno: d.getFullYear(),
        codice: cod,
        impianto: nomeImpiantoFinale,
        indirizzo: impiantoCorrente.indirizzo,
        ch_rep: tipo, // ORDINARIA, STRAORDINARIO, REPERIBILITA (senza accento)
        inizio_int: (tipo !== 'ORDINARIA') ? document.getElementById('ora-inizio').value : null,
        fine_int: (tipo !== 'ORDINARIA') ? document.getElementById('ora-fine').value : null,
        ore_ord: oreOrd,
        ore_stra: oreStra,
        ore_viaggio: oreViag,
        note: noteVal
    }]);

    if (error) {
        alert("Errore durante il salvataggio: " + error.message);
    } else {
        alert("Intervento salvato con successo!");
        window.location.href = 'calendario.html';
    }
}
