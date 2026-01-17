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

        lista.innerHTML = "";
        filtrati.forEach(imp => {
            // --- LOGICA DATA E COLORE ---
            let coloreData = "#475569"; 
            if (imp.ult_sem) {
                const parti = imp.ult_sem.includes('/') ? imp.ult_sem.split('/') : imp.ult_sem.split('-');
                const dataVisita = imp.ult_sem.includes('/') ? 
                    new Date(parti[2], parti[1] - 1, parti[0]) : new Date(parti[0], parti[1] - 1, parti[2]);
                const diff = (new Date() - dataVisita) / (1000 * 60 * 60 * 24);
                if (diff > 180) coloreData = "#ef4444";
            }

            // --- FILIGRANA ---
            const mP = parseInt(imp.mese_sem);
            const mS = mP > 6 ? mP - 6 : mP + 6;
            const nomiMesi = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];
            const testoFiligrana = `${nomiMesi[mP-1]} - ${nomiMesi[mS-1]}`;

            const card = document.createElement('div');
            card.style.cssText = `
                background: white; border-radius: 16px; padding: 16px; margin-bottom: 12px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-left: 6px solid #3b82f6;
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
                            <span style="font-size: 0.85rem; font-weight: 800;">${imp.ult_sem || '---'}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 10px;">
                        <button onclick="vaiAEsegui('${imp.impianto}', '${imp.Indirizzo.replace(/'/g, "\\'")}')" 
                            style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #2563eb; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <span class="material-symbols-rounded" style="font-size: 18px;">play_arrow</span>
                        </button>
                        <button style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #22c55e; color: white; display: flex; align-items: center; justify-content: center; opacity: 0.8;">
                            <span class="material-symbols-rounded" style="font-size: 18px;">play_arrow</span>
                        </button>
                        <button style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #ef4444; color: white; display: flex; align-items: center; justify-content: center; opacity: 0.8;">
                            <span class="material-symbols-rounded" style="font-size: 18px;">play_arrow</span>
                        </button>
                    </div>
                </div>
            `;
            lista.appendChild(card);
        });
    } catch (err) {
        lista.innerHTML = `<div style='color:red; text-align:center;'>Errore: ${err.message}</div>`;
    }
}

function vaiAEsegui(codice, indirizzo) {
    localStorage.setItem('selected_plant', JSON.stringify({ impianto: codice, indirizzo: indirizzo }));
    window.location.href = `nuovo_lavoro.html?id=${codice}`;
}