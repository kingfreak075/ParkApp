const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const listaDiv = document.getElementById('listaImpianti');
const inputImpianto = document.getElementById('searchImpianto');
const inputIndirizzo = document.getElementById('searchIndirizzo');

// Funzione per caricare e filtrare i dati
async function caricaImpianti() {
    let query = supabase.from('Parco_app').select('*');

    // Applica filtri se l'utente scrive
    if (inputImpianto.value) {
        query = query.ilike('impianto', `%${inputImpianto.value}%`);
    }
    if (inputIndirizzo.value) {
        query = query.ilike('Indirizzo', `%${inputIndirizzo.value}%`);
    }

    const { data, error } = await query.limit(50); // Limite per velocità

    if (error) {
        listaDiv.innerHTML = `<p class="text-red-500">Errore: ${error.message}</p>`;
        return;
    }

    renderizzaCard(data);
}

// Funzione per creare il design delle card
function renderizzaCard(impianti) {
    if (impianti.length === 0) {
        listaDiv.innerHTML = '<p class="text-center col-span-full">Nessun impianto trovato.</p>';
        return;
    }

    listaDiv.innerHTML = impianti.map(imp => `
        <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div class="flex justify-between items-start mb-2">
                <span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                    ${imp.impianto}
                </span>
                <span class="text-gray-400 text-xs uppercase">${imp.tipo || ''}</span>
            </div>
            <h2 class="text-lg font-bold text-gray-800 uppercase">${imp.cliente || 'Senza Nome'}</h2>
            <p class="text-sm text-gray-600 mt-1">📍 ${imp.Indirizzo || 'Indirizzo non disponibile'}</p>
            <div class="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>Tecnico: <strong>${imp.tecnico || '-'}</strong></span>
                <span>Zona: ${imp.zona || '-'}</span>
            </div>
        </div>
    `).join('');
}

// Eventi di ricerca (scatta mentre scrivi)
inputImpianto.addEventListener('input', caricaImpianti);
inputIndirizzo.addEventListener('input', caricaImpianti);

// Caricamento iniziale
caricaImpianti();