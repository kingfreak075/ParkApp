// ✅ SOSTITUITO CON CLIENT CENTRALIZZATO
const supabaseClient = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

// ✅ CONTROLLO CLIENT INIZIALE
if (!supabaseClient) {
    console.error('Client Supabase non disponibile');
    mostraErroreDB('Connessione al database non disponibile');
}

// ✅ SOSTITUITO con authGetUtente()
const utenteCorrente = typeof authGetUtente === 'function' ? authGetUtente() : null;
const tecnicoLoggato = utenteCorrente ? utenteCorrente.nome_completo : null;

// 3. Funzione errore DB
function mostraErroreDB(messaggio) {
    console.error('Errore DB:', messaggio);
    
    // Mostra messaggio nella pagina
    const listaDiv = document.getElementById('listaMontaggi');
    if (listaDiv) {
        listaDiv.innerHTML = `
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
    
    // Disabilita filtro periodicità se presente
    const filtroDiv = document.querySelector('.filtro-stato');
    if (filtroDiv) {
        filtroDiv.style.opacity = '0.5';
        filtroDiv.style.pointerEvents = 'none';
    }
}

// Elementi DOM
const listaDiv = document.getElementById('listaMontaggi');
const searchMain = document.getElementById('searchMain');
let filtroStatoAttivo = 'tutti'; // Filtro stato iniziale

// Mappatura stati
const MAPPA_STATI = {
    '0': { testo: 'Sconosciuto', colore: '#64748b' },
    '1': { testo: 'Chiuso', colore: '#10b981' },
    '2': { testo: 'In Lavorazione', colore: '#f59e0b' },
    '3': { testo: 'In Programmazione', colore: '#3b82f6' }
};

// Funzione principale per caricare i montaggi
async function caricaMontaggi() {
    // ✅ CONTROLLO CLIENT
    if (!supabaseClient) {
        listaDiv.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 2rem; font-weight: 600;">Errore di connessione al database</p>`;
        return;
    }
    
    const searchVal = searchMain.value.trim();
    
    // Query base
    let query = supabaseClient.from('montaggi').select('*');
    
    // Applica ricerca testo
    if (searchVal !== "") {
        query = query.or(`impianto.ilike.%${searchVal}%,Indirizzo.ilike.%${searchVal}%`);
    }
    
    // Applica filtro stato (se non è "tutti")
    if (filtroStatoAttivo !== 'tutti') {
        query = query.eq('stato', filtroStatoAttivo);
    }
    
    // Esegui query
    const { data, error } = await query.order('impianto').limit(50);
    
    if (error) {
        listaDiv.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 2rem; font-weight: 600;">Errore: ${error.message}</p>`;
        console.error('Errore Supabase:', error);
        return;
    }
    
    renderizzaLista(data);
}

// Funzione per renderizzare la lista
function renderizzaLista(montaggi) {
    if (montaggi.length === 0) {
        listaDiv.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #64748b;">
                <span class="material-symbols-rounded" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">search_off</span>
                <p style="font-weight: 600;">Nessun montaggio trovato</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Prova a modificare i filtri o la ricerca</p>
            </div>
        `;
        return;
    }
    
    listaDiv.innerHTML = montaggi.map((mont, index) => {
        const infoStato = MAPPA_STATI[mont.stato] || MAPPA_STATI['0'];
        const tipoTesto = mont.tipo && mont.tipo.trim() !== '' ? mont.tipo : 'NESSUNA TIPOLOGIA';
        const tipoColore = mont.tipo ? '#0369a1' : '#94a3b8';
        
        return `
            <div class="card-montaggio" data-index="${index}" onclick="toggleEspandiCard(${index})">
                <!-- INTESTAZIONE: Codice impianto e stato -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <!-- Lato sinistro: Codice e tipo -->
                    <div style="flex: 1; min-width: 0;">
                        <!-- Codice impianto prominente -->
                        <div class="codice-impianto" style="color: white; background: linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%); padding: 6px 12px; border-radius: 8px; display: inline-block; margin-bottom: 5px;">
                            ${mont.impianto || 'N/D'}
                        </div>
                        
                        <!-- Tipo sotto il codice -->
                        <div style="margin-top: 6px;">
                            <span style="font-size: 0.9rem; color: ${tipoColore}; font-weight: 600;">
                                ${tipoTesto}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Lato destro: Stato -->
                    <div style="margin-left: 10px;">
                        <span class="badge-stato" style="background-color: ${infoStato.colore}15; color: ${infoStato.colore};">
                            ${infoStato.testo}
                        </span>
                    </div>
                </div>
                
                <!-- INDIRIZZO PRINCIPALE -->
                <div class="sezione-indirizzo" style="cursor: pointer;">
                    <div style="display: flex; align-items: flex-start; gap: 10px;">
                        <span class="material-symbols-rounded" style="color: #6366f1; margin-top: 2px;">location_on</span>
                        <div style="flex: 1;">
                            <h3 class="testo-indirizzo">${mont.Indirizzo || 'Indirizzo non disponibile'}</h3>
                            <div class="localita-info">
                                <span class="localita-nome">${mont.localita || 'BOLOGNA'}</span>
                                <span class="separatore">•</span>
                                <span class="provincia">${mont.provincia || 'BO'}</span>
                                <span class="separatore">•</span>
                                <span class="cap">CAP ${mont.cap || '40122'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- CONTENUTO ESPANDIBILE - NASCOSTO DI DEFAULT -->
                <div id="contenuto-espanso-${index}" class="contenuto-espanso" style="display: none;">
                    <div class="sezione-cliente">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="material-symbols-rounded" style="color: #8b5cf6; font-size: 18px;">apartment</span>
                            <div>
                                <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 2px;">CLIENTE</div>
                                <div class="nome-cliente">${mont.cliente || 'Non specificato'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Info date creazione/modifica -->
                    <div style="margin-top: 15px; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #64748b;">
                            <div>
                                <div style="font-weight: 600; margin-bottom: 2px;">Creato il</div>
                                <div>${mont.created_at ? new Date(mont.created_at).toLocaleDateString('it-IT') : 'Non disponibile'}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 600; margin-bottom: 2px;">Modificato il</div>
                                <div>${mont.updated_at ? new Date(mont.updated_at).toLocaleDateString('it-IT') : 'Non disponibile'}</div>
                            </div>
                        </div>
                        
                        <div style="font-size: 0.75rem; color: #94a3b8; text-align: center; margin-top: 5px;">
                            ${mont.updated_at ? `Ultima modifica: ${new Date(mont.updated_at).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}` : ''}
                        </div>
                    </div>
                    
                    <!-- Pulsante Scheda -->
                    <div style="text-align: right; margin-top: 15px;">
                        <button onclick="event.stopPropagation(); apriSchedaMontaggio('${mont.impianto}')" class="btn-scheda" style="width: 100%; justify-content: center;">
                            <span class="material-symbols-rounded" style="margin-right: 6px;">description</span>
                            Scheda
                        </button>
                    </div>
                </div>
                
                <!-- Indicatore espansione (freccetta) -->
                <div style="text-align: center; margin-top: 10px;">
                    <span id="freccia-${index}" class="material-symbols-rounded" style="color: #94a3b8; font-size: 24px; transition: transform 0.3s ease;">expand_more</span>
                </div>
            </div>
        `;
    }).join('');
}

// Funzione per gestire l'espansione delle card
window.toggleEspandiCard = function(index) {
    const contenuto = document.getElementById(`contenuto-espanso-${index}`);
    const freccia = document.getElementById(`freccia-${index}`);
    const card = document.querySelector(`.card-montaggio[data-index="${index}"]`);
    
    if (!contenuto || !freccia || !card) return;
    
    // Controlla se è già espanso
    const isEspanso = contenuto.style.display === 'block';
    
    // Chiudi tutti gli altri contenuti espansi
    document.querySelectorAll('.contenuto-espanso').forEach(el => {
        if (el.id !== `contenuto-espanso-${index}`) {
            el.style.display = 'none';
        }
    });
    
    // Resetta tutte le frecce
    document.querySelectorAll('[id^="freccia-"]').forEach(el => {
        if (el.id !== `freccia-${index}`) {
            el.style.transform = 'rotate(0deg)';
        }
    });
    
    // Toggle dello stato corrente
    if (isEspanso) {
        contenuto.style.display = 'none';
        freccia.style.transform = 'rotate(0deg)';
        card.classList.remove('card-espansa');
    } else {
        contenuto.style.display = 'block';
        freccia.style.transform = 'rotate(180deg)';
        card.classList.add('card-espansa');
        
        // Scroll automatico per mostrare il contenuto
        setTimeout(() => {
            contenuto.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
};

// Funzione per aprire la scheda montaggio
window.apriSchedaMontaggio = function(codice) {
    window.location.href = `scheda_montaggio.html?id=${codice}`;
    console.log('Apri scheda per:', codice);
};

// Inizializza i filtri per stato
function inizializzaFiltri() {
    const bottoniFiltro = document.querySelectorAll('.filtro-stato');
    
    // Aggiungi evento click a ogni bottone
    bottoniFiltro.forEach(bottone => {
        bottone.addEventListener('click', function() {
            const nuovoStato = this.getAttribute('data-stato');
            
            // Rimuovi classe attiva da tutti
            bottoniFiltro.forEach(btn => {
                btn.classList.remove('filtro-stato-attivo');
            });
            
            // Aggiungi classe attiva al bottone cliccato
            this.classList.add('filtro-stato-attivo');
            
            // Aggiorna filtro e ricarica
            filtroStatoAttivo = nuovoStato;
            caricaMontaggi();
        });
    });
    
    // Imposta "Tutti" come attivo di default
    document.querySelector('.filtro-stato[data-stato="tutti"]').classList.add('filtro-stato-attivo');
}

// Debounce per la ricerca
let timeout = null;
searchMain.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(caricaMontaggi, 300);
});

// Inizializzazione al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
    inizializzaFiltri();
    caricaMontaggi();
});