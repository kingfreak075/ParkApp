// ✅ CONFIGURAZIONE CENTRALIZZATA SUPABASE - GESTIONE
// ===================================================

// 1. OTTIENI CLIENT SUPABASE CENTRALIZZATO
const supabaseClient = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

// 2. CONTROLLO CLIENT INIZIALE
if (!supabaseClient) {
    console.error('Client Supabase non disponibile');
    mostraErroreDB('Connessione al database non disponibile');
}

// 3. FUNZIONE ERRORE DB PER GESTIONE
function mostraErroreDB(messaggio) {
    console.error('Errore DB:', messaggio);
    
    // Disabilita tutti i pulsanti e mostra messaggio
    document.querySelectorAll('.btn-modern, button').forEach(btn => {
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
    });
    
    // Mostra messaggio di errore nell'area configurazione
    const areaConfig = document.getElementById('area-config');
    if (areaConfig) {
        areaConfig.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #ef4444;">
                <span class="material-symbols-rounded" style="font-size: 3rem; margin-bottom: 20px;">error</span>
                <h3 style="margin-bottom: 10px;">Errore Database</h3>
                <p>${messaggio}</p>
                <button onclick="window.location.href='config.html'" 
                        style="margin-top: 20px; padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 8px; font-weight: 600;">
                    Configura Database
                </button>
            </div>
        `;
    }
}

// ===================================================
// CODICE ORIGINALE DELLA GESTIONE
// ===================================================

// ✅ SOSTITUITO con authGetUtente()
const utenteCorrente = typeof authGetUtente === 'function' ? authGetUtente() : null;
const tecnicoLoggato = utenteCorrente ? utenteCorrente.nome_completo : null;

let tipoCorrente = ''; 
let codiceSelezionato = '';
let descSelezionata = '';
let tipoInterventoSelezionato = '';

const listaAssenze = [
    {cod: '072', desc: 'Assemblea Retribuita'}, {cod: '073', desc: 'Sciopero'},
    {cod: '075', desc: 'Ferie'}, {cod: '076', desc: 'Festivita'},
    {cod: '077', desc: 'Malattia'}, {cod: '078', desc: 'Infortunio'},
    {cod: '079', desc: 'Donazione Sangue'}, {cod: '080', desc: 'Allattamento'},
    {cod: '081', desc: 'Congedo Matrimoniale'}, {cod: '082', desc: 'Permesso Retribuito'},
    {cod: '083', desc: 'Permesso NON Retribuito'}, {cod: '084', desc: 'Permesso Legge 104'},
    {cod: '085', desc: 'Permesso Elettorale'}, {cod: '086', desc: 'Permesso per Lutto'},
    {cod: '087', desc: 'Permesso Sindacale'}, {cod: '088', desc: 'Permesso Studio'},
    {cod: '089', desc: 'Permesso Volontariato'}, {cod: '090', desc: 'Spese Generali Diverse'},
    {cod: '091', desc: 'Altro Retribuito'}, {cod: '092', desc: 'Addestramento'}
];

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('grid-assenze');
    listaAssenze.forEach(item => {
        const btn = document.createElement('div');
        btn.className = 'btn-modern';
        btn.innerHTML = `${item.cod}<span>${item.desc}</span>`;
        btn.onclick = function() { selectCodice(item.cod, item.desc, 'ASSENZA', this); };
        grid.appendChild(btn);
    });
    document.getElementById('data-lavoro').valueAsDate = new Date();
});

function toggleAccordion(id) {
    const est = document.getElementById('acc-esterni');
    const ass = document.getElementById('acc-assenze');
    if (id === 'esterni') {
        est.classList.toggle('open');
        ass.classList.remove('open');
    } else {
        ass.classList.toggle('open');
        est.classList.remove('open');
    }
}

function selectCodice(cod, desc, tipo, element) {
    codiceSelezionato = cod;
    descSelezionata = desc;
    tipoCorrente = tipo;

    document.querySelectorAll('.btn-modern').forEach(b => b.classList.remove('active'));
    element.classList.add('active');
    document.getElementById('area-config').style.display = 'block';

    if (tipo === 'ASSENZA') {
        updateViaggio(0);
        document.getElementById('slider-viaggio').value = 0;
        document.getElementById('box-viaggio').style.display = 'none';
        document.getElementById('box-8h').style.display = 'flex';
    } else {
        document.getElementById('box-viaggio').style.display = 'block';
        document.getElementById('box-8h').style.display = 'none';
        document.getElementById('check-8h').checked = false;
    }

    document.getElementById('box-esterni-info').style.display = (tipo === 'ESTERNO') ? 'block' : 'none';
    generaPulsantiIntervento(cod, tipo);
    aggiornaRiepilogo();
}

function generaPulsantiIntervento(cod, tipo) {
    const container = document.getElementById('container-tipo-intervento');
    container.innerHTML = '';
    let opzioni = [];

    if (tipo === 'ASSENZA') opzioni = ['ALTRO'];
    else if (cod === '24') opzioni = ['ORDINARIA'];
    else if (cod === '21' || cod === '13') opzioni = ['ORDINARIA', 'STRAORDINARIO'];
    else if (cod === '22') opzioni = ['ORDINARIA', 'STRAORDINARIO', 'REPERIBILITA'];

    opzioni.forEach(opt => {
        const b = document.createElement('div');
        b.className = 'btn-modern';
        b.innerText = opt;
        b.onclick = function() { setTipoIntervento(opt, this); };
        container.appendChild(b);
    });
    setTipoIntervento(opzioni[0], container.firstChild);
}

function setTipoIntervento(tipo, element) {
    tipoInterventoSelezionato = tipo;
    document.querySelectorAll('#container-tipo-intervento .btn-modern').forEach(b => b.classList.remove('active'));
    element.classList.add('active');

    if (tipo === 'ORDINARIA' || tipo === 'ALTRO') {
        document.getElementById('box-ore-secche').style.display = 'block';
        document.getElementById('box-orari-dettaglio').style.display = 'none';
    } else {
        document.getElementById('box-ore-secche').style.display = 'none';
        document.getElementById('box-orari-dettaglio').style.display = 'block';
    }
    aggiornaRiepilogo();
}

function updateSlider(val) { 
    document.getElementById('valore-ore').innerText = val; 
    aggiornaRiepilogo(); 
}

function updateViaggio(val) { 
    document.getElementById('valore-viaggio').innerText = val; 
    aggiornaRiepilogo(); 
}

function handle8h(checked) {
    const s = document.getElementById('box-ore-secche');
    const sliderInput = document.getElementById('slider-ore');
    
    if(checked) { 
        s.style.opacity = "0.3"; 
        s.style.pointerEvents = "none"; 
        sliderInput.value = 8; 
        updateSlider(8); 
    }
    else { 
        s.style.opacity = "1"; 
        s.style.pointerEvents = "auto"; 
        sliderInput.value = 1; 
        updateSlider(1); 
    }
}

function aggiornaRiepilogo() {
    const r = document.getElementById('testo-riepilogo');
    let ore = (tipoInterventoSelezionato === 'ORDINARIA' || tipoInterventoSelezionato === 'ALTRO') ? 
        document.getElementById('slider-ore').value : "Orari";
    r.innerText = `${codiceSelezionato} | ${tipoInterventoSelezionato} | Ore: ${ore} | Viaggio: ${document.getElementById('slider-viaggio').value}h`;
}

async function salvaGestione() {
    // ✅ CONTROLLO CLIENT
    if (!supabaseClient) {
        alert('Errore di connessione al database');
        return;
    }
    
    if (!codiceSelezionato) return alert("Seleziona attività!");
    const dataObj = new Date(document.getElementById('data-lavoro').value);
    
    let oreOrd = 0, oreStra = 0, oraInizio = null, oraFine = null;

    if (tipoInterventoSelezionato === 'ORDINARIA' || tipoInterventoSelezionato === 'ALTRO') {
        oreOrd = parseFloat(document.getElementById('slider-ore').value);
    } else {
        oraInizio = document.getElementById('ora-inizio').value;
        oraFine = document.getElementById('ora-fine').value;
        if(!oraInizio || !oraFine) return alert("Mancano orari!");
        
        let [h1, m1] = oraInizio.split(':').map(Number);
        let [h2, m2] = oraFine.split(':').map(Number);
        let d = (h2*60+m2) - (h1*60+m1);
        oreStra = (d < 0 ? d + 1440 : d) / 60;
    }

    // Mapping esatto colonne DB
    const payload = {
        tecnico: tecnicoLoggato,
        giorno: dataObj.getDate(),
        mese: dataObj.getMonth() + 1,
        anno: dataObj.getFullYear(),
        codice: codiceSelezionato,
        impianto: (tipoCorrente === 'FILIALE') ? "FILIALE" : (tipoCorrente === 'ESTERNO' ? document.getElementById('ext-impianto').value : ""),
        indirizzo: (tipoCorrente === 'ASSENZA') ? descSelezionata : (tipoCorrente === 'ESTERNO' ? document.getElementById('ext-indirizzo').value : ""),
        ch_rep: tipoInterventoSelezionato,
        inizio_int: oraInizio,
        fine_int: oraFine,
        ore_ord: oreOrd,
        ore_stra: oreStra,
        ore: oreOrd + oreStra,
        ore_viaggio: parseFloat(document.getElementById('slider-viaggio').value),
        note: document.getElementById('note').value,
        data: document.getElementById('data-lavoro').value + " 08:00",
        "Data/ora creazione": new Date().toLocaleString()
    };

    try {
        const { error } = await supabaseClient.from('fogliolavoro').insert([payload]);
        if (error) throw error;
        alert("Attività salvata con successo!"); 
        window.location.href = 'menu.html';
    } catch (err) {
        alert("Errore DB: " + err.message);
    }
}