// === Supabase init ===
const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tecnicoLoggato = localStorage.getItem('tecnico_loggato');
let tipoCorrente = ''; // ASSENZA, FILIALE, ESTERNO
let codiceSelezionato = '';
let descSelezionata = '';
let tipoInterventoSelezionato = '';

const listaAssenze = [
    {cod: '075', desc: 'Ferie'}, {cod: '077', desc: 'Malattia'}, 
    {cod: '082', desc: 'Permesso Retribuito'}, {cod: '072', desc: 'Assemblea Retribuita'},
    {cod: '076', desc: 'Festivita'}, {cod: '078', desc: 'Infortunio'},
    {cod: '084', desc: 'Permesso 104'}, {cod: '092', desc: 'Addestramento'}
];

document.addEventListener('DOMContentLoaded', () => {
    // Genera pulsanti assenze
    const grid = document.getElementById('grid-assenze');
    if(grid) {
        listaAssenze.forEach(item => {
            const btn = document.createElement('div');
            btn.className = 'btn-modern';
            btn.innerHTML = `${item.cod}<span>${item.desc}</span>`;
            btn.onclick = function() { selectCodice(item.cod, item.desc, 'ASSENZA', this); };
            grid.appendChild(btn);
        });
    }
    // Imposta data odierna
    const elData = document.getElementById('data-lavoro');
    if (elData) elData.valueAsDate = new Date();
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

    // Estetica pulsanti
    document.querySelectorAll('.btn-modern').forEach(b => b.classList.remove('active'));
    element.classList.add('active');

    // Mostra area configurazione
    document.getElementById('area-config').style.display = 'block';

    // Regole visibilità Viaggio e 8h
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

    // Info extra per esterni
    document.getElementById('box-esterni-info').style.display = (tipo === 'ESTERNO') ? 'block' : 'none';

    // Genera i pulsanti del Tipo Intervento in base al codice
    generaPulsantiIntervento(cod, tipo);
    aggiornaRiepilogo();
}

function generaPulsantiIntervento(cod, tipo) {
    const container = document.getElementById('container-tipo-intervento');
    if(!container) return;
    container.innerHTML = '';
    let opzioni = [];

    // Regole richieste
    if (tipo === 'ASSENZA') opzioni = ['ALTRO'];
    else if (cod === '024') opzioni = ['ORDINARIA'];
    else if (cod === '021' || cod === '013') opzioni = ['ORDINARIA', 'STRAORDINARIO'];
    else if (cod === '022') opzioni = ['ORDINARIA', 'STRAORDINARIO', 'REPERIBILITA'];

    opzioni.forEach(opt => {
        const b = document.createElement('div');
        b.className = 'btn-modern';
        b.innerText = opt;
        b.onclick = function() { setTipoIntervento(opt, this); };
        container.appendChild(b);
    });

    // Seleziona il primo in automatico
    if(container.firstChild) setTipoIntervento(opzioni[0], container.firstChild);
}

function setTipoIntervento(tipo, element) {
    tipoInterventoSelezionato = tipo;
    document.querySelectorAll('#container-tipo-intervento .btn-modern').forEach(b => b.classList.remove('active'));
    element.classList.add('active');

    // Mostra slider ore per ORDINARIA, altrimenti mostra orari
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
    const sliderBox = document.getElementById('box-ore-secche');
    if(checked) {
        sliderBox.style.opacity = "0.3";
        sliderBox.style.pointerEvents = "none";
        updateSlider(8);
    } else {
        sliderBox.style.opacity = "1";
        sliderBox.style.pointerEvents = "auto";
        updateSlider(1);
    }
}

function aggiornaRiepilogo() {
    const r = document.getElementById('testo-riepilogo');
    if(!codiceSelezionato) return;
    
    let ore = (tipoInterventoSelezionato === 'ORDINARIA' || tipoInterventoSelezionato === 'ALTRO') 
              ? document.getElementById('slider-ore').value 
              : "Orari";
              
    if (document.getElementById('check-8h').checked) ore = "8.0";
    
    r.innerText = `${codiceSelezionato} | ${tipoInterventoSelezionato} | Ore: ${ore} | Viaggio: ${document.getElementById('slider-viaggio').value}h`;
}

async function salvaGestione() {
    if (!codiceSelezionato) return alert("Seleziona un'attività!");
    
    const dataLavoro = document.getElementById('data-lavoro').value;
    const viaggio = parseFloat(document.getElementById('slider-viaggio').value);
    const nota = document.getElementById('note').value;
    
    let oreOrd = 0; let oreStra = 0;
    let oraInizio = null; let oraFine = null;

    if (tipoInterventoSelezionato === 'ORDINARIA' || tipoInterventoSelezionato === 'ALTRO') {
        oreOrd = parseFloat(document.getElementById('slider-ore').value);
    } else {
        oraInizio = document.getElementById('ora-inizio').value;
        oraFine = document.getElementById('ora-fine').value;
        if (!oraInizio || !oraFine) return alert("Inserisci inizio e fine intervento!");
        // Calcolo rapido differenza
        let [h1, m1] = oraInizio.split(':').map(Number);
        let [h2, m2] = oraFine.split(':').map(Number);
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 1440;
        oreStra = diff / 60;
    }

    const payload = {
        tecnico: tecnicoLoggato,
        data: dataLavoro, // Semplificato per compatibilità Tabella
        impianto: (tipoCorrente === 'FILIALE') ? "FILIALE" : (tipoCorrente === 'ESTERNO' ? document.getElementById('ext-impianto').value : ""),
        indirizzo: (tipoCorrente === 'ASSENZA') ? descSelezionata : (tipoCorrente === 'ESTERNO' ? document.getElementById('ext-indirizzo').value : ""),
        codice: codiceSelezionato,
        ora_inizio: oraInizio,
        ora_fine: oraFine,
        ore_ord: oreOrd,
        ore_stra: oreStra,
        ore_viaggio: viaggio,
        ch_rep: tipoInterventoSelezionato,
        note: nota,
        creato_il: new Date().toISOString()
    };

    const { error } = await supabaseClient.from('fogliolavoro').insert([payload]);
    if (error) alert("Errore: " + error.message);
    else { 
        alert("Attività inviata con successo!"); 
        window.location.href = 'menu.html'; 
    }
}