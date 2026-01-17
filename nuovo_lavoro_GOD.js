const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. DICHIARAZIONI GLOBALI
const impiantoCorrente = JSON.parse(localStorage.getItem('selected_plant'));
const tecnicoLoggato = localStorage.getItem('tecnico_loggato');
let codiceSelezionato = null;

// Funzione per selezionare il codice e mostrare la sezione successiva
function selectCodice(codice, element) {
    console.log("Codice selezionato:", codice); 
    codiceSelezionato = codice;
    
    // Estetica delle card
    document.querySelectorAll('.card-codice').forEach(c => {
        c.style.borderColor = "#e2e8f0";
        c.style.background = "white";
        c.classList.remove('active');
    });
    
    element.classList.add('active');
    element.style.borderColor = "#2563eb";
    element.style.background = "#eff6ff";

    // Mostra l'area di lavoro (che nel tuo HTML si chiama 'area-lavoro')
    const areaLavoro = document.getElementById('area-lavoro');
    if (areaLavoro) {
        areaLavoro.style.display = 'block';
    }

    updateUI(); 
}

// Funzione per gestire la visibilità dei box ore
function updateUI() {
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    const boxOreDirette = document.getElementById('box-ore-dirette'); // Corretto ID HTML
    const boxOrari = document.getElementById('box-orari');           // Corretto ID HTML

    if (tipo === 'ORDINARIA') {
        if(boxOreDirette) boxOreDirette.style.display = 'block';
        if(boxOrari) boxOrari.style.display = 'none';
    } else {
        if(boxOreDirette) boxOreDirette.style.display = 'none';
        if(boxOrari) boxOrari.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode'); 
    const datiEdit = localStorage.getItem('edit_intervento');
    
    // --- AGGIUNGI QUESTE RIGHE QUI ---
    if (mode !== 'edit') {
        localStorage.removeItem('edit_intervento');
        console.log("Memoria pulita per nuovo inserimento");
    }
    // --------------------------------


    
    // Visualizzazione Impianto
    if (impiantoCorrente) {
        document.getElementById('display-impianto').innerText = impiantoCorrente.impianto || impiantoCorrente.codice || impiantoCorrente.nome;
        document.getElementById('display-indirizzo').innerText = impiantoCorrente.indirizzo;
    }

    // LOGICA MODIFICA
    if (mode === 'edit' && datiEdit) {
        const intervento = JSON.parse(datiEdit);
        
        // Seleziona la card codice corretta
        const card = Array.from(document.querySelectorAll('.card-codice'))
                          .find(c => c.getAttribute('onclick').includes(`'${intervento.codice}'`));
        if (card) selectCodice(intervento.codice, card);

        // Popola i campi
        document.getElementById('data-lavoro').value = `${intervento.anno}-${String(intervento.mese).padStart(2, '0')}-${String(intervento.giorno).padStart(2, '0')}`;
        document.getElementById('note').value = intervento.note || "";
        document.getElementById('ore-viaggio').value = intervento.ore_via || 0;

        const radioTipo = document.querySelector(`input[name="tipo"][value="${intervento.ch_rep}"]`);
        if (radioTipo) {
            radioTipo.checked = true;
            updateUI();
        }

        if (intervento.ch_rep === 'ORDINARIA') {
            document.getElementById('ore-ord-manual').value = intervento.ore_ord;
        } else {
            document.getElementById('ora-inizio').value = intervento.inizio_int || "";
            document.getElementById('ora-fine').value = intervento.fine_int || "";
            // Forza il calcolo delle ore per la preview
            const res = processHours(intervento.inizio_int, intervento.fine_int, intervento.ch_rep, new Date(document.getElementById('data-lavoro').value).getDay());
            document.getElementById('res-ord').innerText = res.ord.toFixed(2);
            document.getElementById('res-stra').innerText = res.stra.toFixed(2);
        }

        const btnSalva = document.querySelector('button[onclick="salvaIntervento()"]');
        if (btnSalva) btnSalva.innerText = "AGGIORNA INTERVENTO";
    } else {
        document.getElementById('data-lavoro').valueAsDate = new Date();
    }
});

// Funzione chiamata dagli input time nel tuo HTML
function validateTimeAndCalculate() {
    const inizio = document.getElementById('ora-inizio').value;
    const fine = document.getElementById('ora-fine').value;
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    const dataSelezionata = new Date(document.getElementById('data-lavoro').value);
    
    if (inizio && fine) {
        const res = processHours(inizio, fine, tipo, dataSelezionata.getDay());
        document.getElementById('res-ord').innerText = res.ord.toFixed(2);
        document.getElementById('res-stra').innerText = res.stra.toFixed(2);
    }
}

async function salvaIntervento() {
    if (!codiceSelezionato) return alert("Seleziona un codice!");
    
    const dataInput = document.getElementById('data-lavoro').value;
    const dataObj = new Date(dataInput);
    const tipo = document.querySelector('input[name="tipo"]:checked').value;

    let oreOrd = 0, oreStra = 0, inizioInt = null, fineInt = null;

    if (tipo === 'ORDINARIA') {
        oreOrd = parseFloat(document.getElementById('ore-ord-manual').value) || 0;
    } else {
        inizioInt = document.getElementById('ora-inizio').value;
        fineInt = document.getElementById('ora-fine').value;
        const res = processHours(inizioInt, fineInt, tipo, dataObj.getDay());
        oreOrd = res.ord;
        oreStra = res.stra;
    }

    const payload = {
        tecnico: tecnicoLoggato,
        impianto: document.getElementById('display-impianto').innerText,
        codice: codiceSelezionato,
        data: dataInput,
        giorno: dataObj.getDate(),
        mese: dataObj.getMonth() + 1,
        anno: dataObj.getFullYear(),
        ch_rep: tipo,
        ore_ord: oreOrd,
        ore_stra: oreStra,
        ore_viaggio: parseFloat(document.getElementById('ore-viaggio').value) || 0,
        inizio_int: inizioInt,
        fine_int: fineInt,
        note: document.getElementById('note').value
    };

    const mode = new URLSearchParams(window.location.search).get('mode');
    try {
        if (mode === 'edit') {
            const interventoOriginale = JSON.parse(localStorage.getItem('edit_intervento'));
            const { error } = await supabaseClient.from('fogliolavoro').update(payload).eq('ID', interventoOriginale.ID);
            if (error) throw error;
            alert("Aggiornato!");
        } else {
            const { error } = await supabaseClient.from('fogliolavoro').insert([payload]);
            if (error) throw error;
            alert("Salvato!");
        }
        localStorage.removeItem('edit_intervento');
        window.location.href = 'calendario.html';
    } catch (err) {
        alert("Errore: " + err.message);
    }
}

// UTILITY (stesse di prima)
function calculateTotalDiff(inizio, fine) {
    let [hIn, mIn] = inizio.split(':').map(Number);
    let [hFi, mFi] = fine.split(':').map(Number);
    let diff = (hFi * 60 + mFi) - (hIn * 60 + mIn);
    return diff > 0 ? diff / 60 : 0;
}

function processHours(inizio, fine, tipo, dayOfWeek) {
    const total = calculateTotalDiff(inizio, fine);
    if (tipo === 'REPERIBILITA' || dayOfWeek === 0 || dayOfWeek === 6) return { ord: 0, stra: total };
    if (total > 8) return { ord: 8, stra: total - 8 };
    return { ord: total, stra: 0 };
}