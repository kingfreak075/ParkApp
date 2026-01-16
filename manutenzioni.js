
// ========== CONFIGURAZIONE ==========
const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 👉 MOSTRA SOLO MANUTENTORE LOGGATO?
// false = tutti i manutentori
// true  = solo manutentore loggato
const SOLO_LOGGATO = false;

const tecnicoLoggato = localStorage.getItem('tecnico_loggato');

// ======================================================
// AVVIO PAGINA
// ======================================================
document.addEventListener('DOMContentLoaded', async () => {
    const meseCorrente = new Date().getMonth() + 1;
    document.getElementById('select-mese').value = meseCorrente;

    await caricaManutentori();
    caricaManutenzioni();
});

// ======================================================
// CARICA LISTA MANUTENTORI
// ======================================================
async function caricaManutentori() {
    const select = document.getElementById('select-tecnico');
    select.innerHTML = "<option>Caricamento...</option>";

    let query = supabaseClient
        .from('manutentori')
        .select('Manutentore, Giro');

    if (SOLO_LOGGATO) {
        query = query.eq('Manutentore', tecnicoLoggato);
    }

    const { data, error } = await query;
    if (error) {
        select.innerHTML = "<option>Errore caricamento</option>";
        return;
    }

    select.innerHTML = "";

    data.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.Giro;                 // valore = giro
        opt.textContent = m.Manutentore;    // testo = nome manutentore
        select.appendChild(opt);
    });
}

// ======================================================
// CARICA IMPIANTI DEL MANUTENTORE + MESE
// ======================================================
async function caricaManutenzioni() {

    const lista = document.getElementById('lista-manutenzioni');
    lista.innerHTML = "<div style='color:#64748b'>Caricamento...</div>";

    const meseSelezionato = parseInt(document.getElementById('select-mese').value);
    const giroSelezionato = parseInt(document.getElementById('select-tecnico').value);

    if (isNaN(giroSelezionato)) {
        lista.innerHTML = "<div>Seleziona un manutentore.</div>";
        return;
    }

    // 1) CARICO IMPIANTI DEL GIRO
    const { data: impianti, error } = await supabaseClient
        .from('Parco_app')
        .select('impianto, indirizzo, localit, mese_sem, ult_sem, giro')
        .eq('giro', giroSelezionato);

    if (error) {
        lista.innerHTML = "<div>Errore lettura impianti.</div>";
        return;
    }

    // 2) FILTRO IMPIANTI SECONDO SEMESTRALE
    const filtrati = impianti.filter(imp => {
        const m = parseInt(imp.mese_sem);
        if (isNaN(m)) return false;

        const opposto = m > 6 ? m - 6 : m + 6;

        return (m === meseSelezionato || opposto === meseSelezionato);
    });

    if (filtrati.length === 0) {
        lista.innerHTML = "<div style='color:#64748b;text-align:center;margin-top:40px'>Nessuna semestrale per questo mese.</div>";
        return;
    }

    // 3) RENDER LISTA
    lista.innerHTML = "";
    filtrati.forEach(imp => {
        const card = document.createElement('div');
        card.style.cssText = `
            background: white;
            border-radius: 14px;
            padding: 16px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.06);
            border-left: 6px solid #3b82f6;
        `;

        card.innerHTML = `
            <div style="font-size:1.1rem; font-weight:900; color:#1e293b">
                ${imp.impianto}
            </div>

            <div style="font-size:0.85rem; color:#475569; margin-top:4px">
                ${imp.indirizzo}
            </div>

            <div style="font-size:0.85rem; color:#475569">
                ${imp.localit}
            </div>

            <div style="margin-top:8px; font-size:0.75rem; color:#0f172a; font-weight:700">
                Ultima Semestrale: 
                <span style="color:#2563eb">${imp.ult_sem ?? '-'}</span>
            </div>
        `;

        lista.appendChild(card);
    });
}
