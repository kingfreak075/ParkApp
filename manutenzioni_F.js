const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tecnicoLoggato = localStorage.getItem('tecnico_loggato');

document.addEventListener('DOMContentLoaded', async () => {
    const meseCorrente = new Date().getMonth() + 1;
    const selMese = document.getElementById('select-mese');
    if (selMese) selMese.value = meseCorrente;

    await caricaManutentori();
    caricaManutenzioni();
});

async function caricaManutentori() {
    const select = document.getElementById('select-tecnico');
    try {
        const { data, error } = await supabaseClient
            .from('Parco_app')
            .select('tecnico');

        if (error) throw error;

        const tecniciUnici = [...new Set(data.map(item => item.tecnico))].filter(Boolean).sort();
        
        select.innerHTML = ""; 
        tecniciUnici.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.innerText = t;
            if (t === tecnicoLoggato) opt.selected = true;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Errore tecnici:", err);
    }
}


function creaFooter(statistiche) {
    return `
        <div style="position: fixed; bottom: 0; left: 0; right: 0; background: white; border-top: 1px solid #e2e8f0; padding: 12px 20px; display: flex; justify-content: space-around; z-index: 100;">
            <div style="text-align: center;">
                <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 2px;">Totali</div>
                <div style="font-weight: 800; color: #1e293b;">${statistiche.totali}</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 2px;">Nel mese</div>
                <div style="font-weight: 800; color: #22c55e;">${statistiche.nelMese}</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 2px;">In Ritardo</div>
                <div style="font-weight: 800; color: #ef4444;">${statistiche.inRitardo}</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 2px;">Regolari</div>
                <div style="font-weight: 800; color: #000000;">${statistiche.regolari}</div>
            </div>
        </div>
    `;
}

async function caricaManutenzioni() {
    const meseSelezionato = parseInt(document.getElementById('select-mese').value);
    const tecnicoScelto = document.getElementById('select-tecnico').value;
    const lista = document.getElementById('lista-manutenzioni');
    
    lista.innerHTML = "<div style='text-align:center; padding:20px;'>Caricamento...</div>";

    try {
        // Query alla tabella corretta
        const { data: impianti, error } = await supabaseClient
            .from('Parco_app')
            .select('*')
            .eq('tecnico', tecnicoScelto);

        if (error) throw error;

        // Filtro semestrale
        const filtrati = impianti.filter(imp => {
            const m = parseInt(imp.mese_sem);
            if (isNaN(m)) return false;
            const opposto = m > 6 ? m - 6 : m + 6;
            return (m === meseSelezionato || opposto === meseSelezionato);
        });

        if (filtrati.length === 0) {
            lista.innerHTML = "<div style='text-align:center; margin-top:40px; color:#64748b;'>Nessun impianto per questo mese.</div>";
            return;
        }

// Variabili per statistiche
        let statistiche = {
            totali: filtrati.length,
            nelMese: 0,       // manutenzione fatta nel mese visualizzato (VERDE)
            inRitardo: 0,     // oltre 6 mesi (ROSSO)
            regolari: 0       // entro 6 mesi ma non nel mese (NERO)
        };




        lista.innerHTML = "";
        filtrati.forEach(imp => {
// --- LOGICA DATA E COLORE ---
let coloreData = "#475569"; // default grigio
let showGreenDot = false; // per il pallino verde
let linguettaVerde = false; // per la linguetta laterale verde

if (imp.ult_sem) {
    const parti = imp.ult_sem.includes('/') ? imp.ult_sem.split('/') : imp.ult_sem.split('-');
    const dataVisita = imp.ult_sem.includes('/') ? 
        new Date(parti[2], parti[1] - 1, parti[0]) : new Date(parti[0], parti[1] - 1, parti[2]);
    
    const oggi = new Date();
    const diffGiorni = (oggi - dataVisita) / (1000 * 60 * 60 * 24);
    
    // Mese dell'ultima manutenzione (1-12)
    const meseUltManutenzione = dataVisita.getMonth() + 1;
    const meseVisualizzato = meseSelezionato; // dal <select>
    const meseCorrente = new Date().getMonth() + 1;

    // 1. VERIFICA LINGUETTA VERDE (bordo sinistro)
    // Linguetta verde solo se: 
    // - il mese visualizzato = mese ultima manutenzione
    // - E siamo proprio in quel mese (mese corrente = mese visualizzato)
    if (meseUltManutenzione === meseVisualizzato && meseVisualizzato === meseCorrente) {
        linguettaVerde = true;
    }

    // 2. LOGICA COLORE FONT E PALLINO VERDE
    if (meseUltManutenzione === meseVisualizzato) {
        // Se la manutenzione è stata fatta nel mese che sto guardando → VERDE
        coloreData = "#22c55e"; // verde
        showGreenDot = true; // mostra pallino verde
    } else if (diffGiorni <= 180) {
        // Entro 6 mesi ma non nel mese visualizzato → NERO
        coloreData = "#000000"; // nero
        showGreenDot = false;
    } else {
        // Oltre 6 mesi → ROSSO
        coloreData = "#ef4444"; // rosso
        showGreenDot = false;
    }
}

// --- FILIGRANA ---
const mP = parseInt(imp.mese_sem);
const mS = mP > 6 ? mP - 6 : mP + 6;
const nomiMesi = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];
const testoFiligrana = `${nomiMesi[mP-1]} - ${nomiMesi[mS-1]}`;

const card = document.createElement('div');

// Determina colore bordo sinistro (linguetta)
const borderColor = linguettaVerde ? "#22c55e" : "#3b82f6";

card.style.cssText = `
    background: white; border-radius: 16px; padding: 16px; margin-bottom: 12px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-left: 6px solid ${borderColor};
    display: flex; flex-direction: column; position: relative; overflow: hidden;
`;

card.innerHTML = `
    <div style="position: absolute; bottom: -5px; right: 30px; font-size: 1.8rem; font-weight: 900; color: #e2e8f0; z-index: 0; pointer-events: none; opacity: 0.8; letter-spacing: -1px;">
        ${testoFiligrana}
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; z-index: 1;">
        <div style="flex:1; padding-right: 10px;">
            <div style="font-weight:800; color:#1e293b; font-size: 1rem;">${imp.impianto}</div>
            <div style="font-size:0.8rem; color:#64748b; margin-top: 2px;">
                ${imp.Indirizzo}${imp.localit ? ' - ' + imp.localit : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 5px; margin-top: 10px; color: ${coloreData};">
                <span class="material-symbols-rounded" style="font-size: 16px;">calendar_today</span>
                ${showGreenDot ? '<span style="display:inline-block; width:8px; height:8px; background:#22c55e; border-radius:50%; margin-right:3px;"></span>' : ''}
                <span style="font-size: 0.85rem; font-weight: 800;">${imp.ult_sem || '---'}</span>
            </div>
        </div>
        <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 10px;">
            <button onclick="vaiAEsegui('${imp.impianto}', '${imp.Indirizzo.replace(/'/g, "\\'")}')" 
                style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <span class="material-symbols-rounded" style="font-size: 18px;">play_arrow</span>
            </button>
            <button onclick="apriAnnotazioni('${imp.impianto}')" 
                style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #22c55e; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <span class="material-symbols-rounded" style="font-size: 18px;">note_add</span>
            </button>
            <button style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #ef4444; color: white; display: flex; align-items: center; justify-content: center; opacity: 0.8;">
                <span class="material-symbols-rounded" style="font-size: 18px;">play_arrow</span>
            </button>
        </div>
    </div>
`;
            lista.appendChild(card);
        });

        // AGGIUNGI FOOTER CON STATISTICHE
        const footer = document.createElement('div');
        footer.innerHTML = creaFooter(statistiche);
        lista.appendChild(footer);



    } catch (err) {
        lista.innerHTML = `<div style='color:red; text-align:center;'>Errore: ${err.message}</div>`;
    }
}

function vaiAEsegui(codice, indirizzo) {
    localStorage.setItem('selected_plant', JSON.stringify({ impianto: codice, indirizzo: indirizzo }));
    window.location.href = `nuovo_lavoro.html?id=${codice}`;
}

// Aggiungi la funzione:
function apriAnnotazioni(codiceImpianto) {
    window.location.href = `annotazioni.html?impianto=${codiceImpianto}`;
}