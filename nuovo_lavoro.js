const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let infoImpianto = {};

async function caricaDatiBase() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    const { data } = await supabaseClient.from('Parco_app').select('*').eq('impianto', id).single();
    if (data) {
        infoImpianto = data;
        document.getElementById('disp-impianto').innerText = data.impianto;
        document.getElementById('disp-indirizzo').innerText = data.Indirizzo;
        document.getElementById('data-lavoro').valueAsDate = new Date();
    }
}

function calcolaSettimana(data) {
    const d = new Date(data);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

document.getElementById('form-lavoro').onsubmit = async (e) => {
    e.preventDefault();
    
    const dataSel = new Date(document.getElementById('data-lavoro').value);
    const inizio = document.getElementById('inizio-int').value;
    const fine = document.getElementById('fine-int').value;
    const tipo = document.getElementById('tipo-intervento').value;

    // Calcolo ore
    const hInizio = parseFloat(inizio.split(':')[0]) + parseFloat(inizio.split(':')[1])/60;
    const hFine = parseFloat(fine.split(':')[0]) + parseFloat(fine.split(':')[1])/60;
    const oreTotali = (hFine - hInizio).toFixed(2);

    const nuovoInserimento = {
        data: dataSel.toLocaleDateString('it-IT'),
        impianto: infoImpianto.impianto,
        indirizzo: infoImpianto.Indirizzo,
        tecnico: infoImpianto.tecnico || "Tecnico ParkApp",
        codice: infoImpianto.tecnico_cod || "000",
        ore: oreTotali,
        ore_ord: tipo !== 'REPERIBILITÀ' ? oreTotali : 0,
        ore_stra: tipo === 'REPERIBILITÀ' ? oreTotali : 0,
        inizio_int: inizio,
        fine_int: fine,
        ch_rep: tipo,
        settimana: calcolaSettimana(dataSel),
        giorno: dataSel.getDate(),
        mese: dataSel.getMonth() + 1,
        anno: dataSel.getFullYear(),
        note: document.getElementById('note-lavoro').value,
        "Data/ora creazione": new Date().toLocaleString('it-IT')
    };

    const { error } = await supabaseClient.from('foglio lavoro').insert([nuovoInserimento]);

    if (error) {
        alert("Errore salvataggio: " + error.message);
    } else {
        alert("Lavoro salvato correttamente!");
        window.location.href = 'index.html';
    }
};

caricaDatiBase();