const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const listaDiv = document.getElementById('listaImpianti');
const searchMain = document.getElementById('searchMain');

async function caricaImpianti() {
    const searchVal = searchMain.value.trim();
    
    let query = supabaseClient.from('Parco_app').select('*');

    if (searchVal !== "") {
        // Ricerca combinata (or) su impianto o indirizzo
        query = query.or(`impianto.ilike.%${searchVal}%,Indirizzo.ilike.%${searchVal}%`);
    }

    const { data, error } = await query.order('impianto').limit(30);

    if (error) {
        listaDiv.innerHTML = `<p class="text-red-500 text-center p-10">${error.message}</p>`;
        return;
    }

    renderizzaLista(data);
}

/**
 * Genera l'interfaccia a lista con controllo disdette
 */
function renderizzaLista(impianti) {
    if (impianti.length === 0) {
        listaDiv.innerHTML = '<p style="text-align: center; color: #64748b; padding-top: 3rem;">Nessun impianto trovato</p>';
        return;
    }

    listaDiv.innerHTML = impianti.map(imp => {
        // Logica per identificare la disdetta
        const giroVal = imp.giro ? imp.giro.toString().trim() : "";
        const isDisdettato = ["66", "77", "88"].includes(giroVal);
        
        // Definiamo lo stile del tag e dello sfondo
        const tagGiro = isDisdettato 
            ? `<span style="color: #ef4444; font-weight: 800;">DISDETTA</span>`
            : `<span class="giro-tag">GIRO ${imp.giro || '-'}</span>`;
            
        const bgStyle = isDisdettato 
            ? `style="background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3);"` 
            : "";

        return `
            <div class="card-impianto" ${bgStyle}>
                <div style="flex: 1; min-width: 0; padding-right: 1rem;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="id-tag">${imp.impianto}</span>
                        <span style="color: #cbd5e1;">•</span>
                        ${tagGiro}
                    </div>
                    
                    <h2 class="indirizzo-titolo">${imp.Indirizzo || 'Nessun Indirizzo'}</h2>
                    
                    <div class="localita-sub">
                        <span class="material-symbols-rounded" style="font-size: 14px; margin-right: 4px;">location_on</span>
                        ${imp.localit || '-'} (${imp.prov || '-'})
                    </div>
                </div>

                <button onclick="apriDettagli('${imp.impianto}')" class="btn-scheda">
                    <span class="material-symbols-rounded">description</span>
                </button>
            </div>
        `;
    }).join('');
}

// Debounce per ricerca fluida
let timeout = null;
searchMain.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(caricaImpianti, 300);
});

// Avvio
caricaImpianti();

// Funzione placeholder per i dettagli
window.apriDettagli = function(codice) {
    window.location.href = `dettaglio.html?id=${codice}`;
};