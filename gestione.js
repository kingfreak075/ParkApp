const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tecnicoLoggato = localStorage.getItem('tecnico_loggato');
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

function updateSlider(val) { document.getElementById('valore-ore').innerText = val; aggiornaRiepilogo(); }
function updateViaggio(val) { document.getElementById('valore-viaggio').innerText = val; aggiornaRiepilogo(); }

function handle8h(checked) {
    const s = document.getElementById('box-ore-secche');
    const sliderInput = document.getElementById('slider-ore'); // Recuperiamo l'input
    
    if(checked) { 
        s.style.opacity = "0.3"; 
        s.style.pointerEvents = "none"; 
        
        // --- AGGIUNTA: Forza il valore dello slider a 8 ---
        sliderInput.value = 8; 
        
        updateSlider(8); 
    }
    else { 
        s.style.opacity = "1"; 
        s.style.pointerEvents = "auto"; 
        
        // Opzionale: riporta lo slider a 1 se tolgono la spunta
        sliderInput.value = 1; 
        updateSlider(1); 
    }
}

function aggiornaRiepilogo() {
    const r = document.getElementById('testo-riepilogo');
    let ore = (tipoInterventoSelezionato === 'ORDINARIA' || tipoInterventoSelezionato === 'ALTRO') ? document.getElementById('slider-ore').value : "Orari";
    r.innerText = `${codiceSelezionato} | ${tipoInterventoSelezionato} | Ore: ${ore} | Viaggio: ${document.getElementById('slider-viaggio').value}h`;
}

async function salvaGestione() {
    if (!codiceSelezionato) return alert("Seleziona attività!");
    const dataObj = new Date(document.getElementById('data-lavoro').value);
    
    let oreOrd = 0, oreStra = 0, oraInizio = null, oraFine = null;

    if (tipoInterventoSelezionato === 'ORDINARIA' || tipoInterventoSelezionato === 'ALTRO') {
        oreOrd = parseFloat(document.getElementById('slider-ore').value);
    } else {
        oraInizio = document.getElementById('ora-inizio').value;
        oraFine = document.getElementById('ora-fine').value;
        if(!oraInizio || !oraFine) return alert("Mancano orari!");
        // Calcolo differenza semplice
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

    const { error } = await supabaseClient.from('fogliolavoro').insert([payload]);
    if (error) alert("Errore DB: " + error.message);
    else { alert("Inviato!"); window.location.href = 'menu.html'; }
}
