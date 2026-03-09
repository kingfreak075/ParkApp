// ✅ SOSTITUITO CON CLIENT CENTRALIZZATO
const supabaseClient = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

// ✅ CONTROLLO CLIENT INIZIALE
if (!supabaseClient) {
    console.error('Client Supabase non disponibile');
    mostraMessaggio('Connessione al database non disponibile', 'error');
}

// Mappatura stati (coerente con montaggi.js)
const MAPPA_STATI = {
    '0': { testo: 'Sconosciuto', colore: '#64748b', azioni: ['1', '2', '3'] },
    '1': { testo: 'Chiuso', colore: '#10b981', azioni: ['2', '3'] },
    '2': { testo: 'In Lavorazione', colore: '#f59e0b', azioni: ['1', '3'] },
    '3': { testo: 'In Programmazione', colore: '#3b82f6', azioni: ['1', '2'] }
};

// Variabili globali
let datiImpianto = null;
let impiantoId = null;

// Carica dati al caricamento pagina
document.addEventListener('DOMContentLoaded', async () => {
    // ✅ CONTROLLO CLIENT
    if (!supabaseClient) {
        mostraMessaggio('Errore di connessione al database', 'error');
        return;
    }
    
    // ✅ MOSTRA PULSANTE MODIFICA SOLO A SUPERVISORI/ADMIN
    const btnModifica = document.getElementById('btnModificaImpianto');
    if (btnModifica) {
        if (isSupervisoreOAdmin()) {
            btnModifica.style.display = 'flex';
            console.log('🔓 Utente supervisore/admin - pulsante modifica visibile');
        } else {
            btnModifica.style.display = 'none';
            console.log('🔒 Utente tecnico - pulsante modifica nascosto');
        }
    }

    // Ottieni ID dall'URL
    const urlParams = new URLSearchParams(window.location.search);
    impiantoId = urlParams.get('id');
    
    if (!impiantoId) {
        mostraMessaggio('Nessun impianto specificato', 'error');
        setTimeout(() => {
            window.location.href = 'montaggi.html';
        }, 2000);
        return;
    }
    
    // Mostra codice impianto in header
    document.getElementById('codice-impianto-display').textContent = impiantoId;
    
    // Carica dati
    await caricaDatiImpianto();
});

// Funzione per verificare se l'utente è supervisore o admin

function isSupervisoreOAdmin() {
    const utente = typeof authGetUtente === 'function' ? authGetUtente() : null;
    return utente && (utente.ruolo === 'supervisore' || utente.ruolo === 'admin');
}




// Funzione per caricare i dati dell'impianto
async function caricaDatiImpianto() {
    try {
        const { data, error } = await supabaseClient
            .from('montaggi')
            .select('*')
            .eq('impianto', impiantoId)
            .single();
        
        if (error) throw error;
        
        datiImpianto = data;
        aggiornaInterfaccia();
        
    } catch (error) {
        console.error('Errore caricamento dati:', error);
        document.getElementById('schedaContenuto').innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #ef4444;">
                <span class="material-symbols-rounded" style="font-size: 3rem; margin-bottom: 1rem;">error</span>
                <p style="font-weight: 600;">Errore nel caricamento dei dati</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">${error.message}</p>
                <button onclick="window.location.href='montaggi.html'" class="btn-primario" style="margin-top: 1.5rem;">
                    Torna alla lista
                </button>
            </div>
        `;
    }
}

// Aggiorna l'interfaccia con i dati
function aggiornaInterfaccia() {
    if (!datiImpianto) return;
    
    // 1. STATO ATTUALE
    const infoStato = MAPPA_STATI[datiImpianto.stato] || MAPPA_STATI['0'];
    const badgeStato = document.getElementById('badgeStatoAttuale');
    badgeStato.innerHTML = `
        <span style="
            background-color: ${infoStato.colore}15;
            color: ${infoStato.colore};
            font-size: 0.9rem;
            font-weight: 800;
            padding: 8px 16px;
            border-radius: 20px;
            border: 2px solid ${infoStato.colore}30;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        ">
            <span class="material-symbols-rounded" style="font-size: 18px;">circle</span>
            ${infoStato.testo}
        </span>
    `;
    
    // 2. PULSANTI STATO RAPIDI
    const pulsantiStatoDiv = document.getElementById('pulsantiStato');
    pulsantiStatoDiv.innerHTML = '';
    
    // Pulsanti disponibili per lo stato corrente
    infoStato.azioni.forEach(statoTarget => {
        const targetInfo = MAPPA_STATI[statoTarget];
        if (targetInfo) {
            const btn = document.createElement('button');
            btn.className = 'btn-stato-rapido';
            btn.innerHTML = `
                <span class="material-symbols-rounded" style="margin-right: 6px;">arrow_forward</span>
                Imposta: ${targetInfo.testo}
            `;
            btn.style.backgroundColor = targetInfo.colore + '15';
            btn.style.color = targetInfo.colore;
            btn.style.borderColor = targetInfo.colore + '40';
            
            btn.onclick = () => cambiaStato(statoTarget);
            
            pulsantiStatoDiv.appendChild(btn);
        }
    });
    
    // 3. INFORMAZIONI IMPIANTO
    document.getElementById('indirizzoTesto').textContent = datiImpianto.Indirizzo || 'Non specificato';
    document.getElementById('localitaTesto').textContent = 
        `${datiImpianto.localita || 'BOLOGNA'} • ${datiImpianto.provincia || 'BO'} • CAP ${datiImpianto.cap || '40122'}`;
    
    document.getElementById('clienteTesto').textContent = datiImpianto.cliente || 'Non specificato';
    document.getElementById('tipoTesto').textContent = datiImpianto.tipo || 'Nessun tipo specificato';
    
    // 4. CRONOLOGIA
    const created = datiImpianto.created_at ? new Date(datiImpianto.created_at) : null;
    const updated = datiImpianto.updated_at ? new Date(datiImpianto.updated_at) : null;
    
    let cronologiaText = '';
    if (created) {
        cronologiaText += `Creato: ${created.toLocaleDateString('it-IT')}`;
    }
    if (updated) {
        cronologiaText += ` • Ultima modifica: ${updated.toLocaleDateString('it-IT')} ${updated.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}`;
    }
    
    document.getElementById('cronologiaTesto').textContent = cronologiaText || 'Dati cronologia non disponibili';
}

// FUNZIONE: Cambia stato (rapido, auto-salva)
async function cambiaStato(nuovoStato) {
    // ✅ CONTROLLO CLIENT
    if (!supabaseClient) {
        mostraMessaggio('Errore di connessione al database', 'error');
        return;
    }
    
    if (!impiantoId || !datiImpianto) {
        mostraMessaggio('Dati impianto non disponibili', 'error');
        return;
    }
    
    const conferma = confirm(`Vuoi impostare lo stato a "${MAPPA_STATI[nuovoStato].testo}"?`);
    if (!conferma) return;
    
    // Mostra indicatore caricamento
    const badgeStato = document.getElementById('badgeStatoAttuale');
    const testoOriginale = badgeStato.innerHTML;
    badgeStato.innerHTML = `
        <span style="background-color: #f1f5f9; color: #64748b; padding: 8px 16px; border-radius: 20px;">
            <span class="material-symbols-rounded" style="font-size: 18px;">sync</span>
            Aggiornamento in corso...
        </span>
    `;
    
    try {
        const timestamp = new Date().toISOString();
        
        // 1. AGIORNAMENTO SU SUPABASE
        const { error } = await supabaseClient
            .from('montaggi')
            .update({ 
                stato: nuovoStato,
                updated_at: timestamp
            })
            .eq('impianto', impiantoId);
        
        if (error) {
            console.error('Errore Supabase:', error);
            
            // Ripristina stato originale
            badgeStato.innerHTML = testoOriginale;
            
            // Mostra errore specifico
            if (error.code === '42501') {
                mostraMessaggio('Errore: Permessi insufficienti sul database', 'error');
            } else if (error.code === '42P01') {
                mostraMessaggio('Errore: Tabella "montaggi" non trovata', 'error');
            } else {
                mostraMessaggio(`Errore: ${error.message}`, 'error');
            }
            return;
        }
        
        // 2. AGGIORNAMENTO LOCALE
        datiImpianto.stato = nuovoStato;
        datiImpianto.updated_at = timestamp;
        
        // 3. AGGIORNA INTERFACCIA
        setTimeout(() => {
            aggiornaInterfaccia();
            mostraMessaggio(`✅ Stato aggiornato a: ${MAPPA_STATI[nuovoStato].testo}`, 'success');
        }, 300);
        
    } catch (error) {
        console.error('Errore imprevisto:', error);
        badgeStato.innerHTML = testoOriginale;
        mostraMessaggio('Errore imprevisto durante l\'aggiornamento', 'error');
    }
}

// FUNZIONE: Attiva modalità modifica
function attivaModifica() {

// Controllo aggiuntivo di sicurezza
    if (!isSupervisoreOAdmin()) {
        mostraMessaggio('Non hai i permessi per modificare', 'error');
        return;
    }

    // Popola form con dati attuali
    document.getElementById('modificaIndirizzo').value = datiImpianto.Indirizzo || '';
    document.getElementById('modificaProvincia').value = datiImpianto.provincia || '';
    document.getElementById('modificaCap').value = datiImpianto.cap || '';
    document.getElementById('modificaCliente').value = datiImpianto.cliente || '';
    document.getElementById('modificaTipo').value = datiImpianto.tipo || '';
    
    // Nascondi info, mostra form
    document.getElementById('infoSection').style.display = 'none';
    document.getElementById('modificaSection').style.display = 'block';
    document.getElementById('azioniSection').style.display = 'none';
}

// FUNZIONE: Annulla modifica
function annullaModifica() {
    document.getElementById('infoSection').style.display = 'block';
    document.getElementById('modificaSection').style.display = 'none';
    document.getElementById('azioniSection').style.display = 'block';
}

// FUNZIONE: Salva modifiche (form submit)
document.getElementById('modificaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // ✅ CONTROLLO CLIENT
    if (!supabaseClient) {
        mostraMessaggio('Errore di connessione al database', 'error');
        return;
    }
    
    // Validazione
    const provincia = document.getElementById('modificaProvincia').value.toUpperCase();
    const cap = document.getElementById('modificaCap').value;
    
    if (provincia.length !== 2 || !/^[A-Z]{2}$/.test(provincia)) {
        mostraMessaggio('Provincia non valida. Deve essere 2 lettere (es: BO)', 'error');
        return;
    }
    
    if (cap.length !== 5 || !/^\d{5}$/.test(cap)) {
        mostraMessaggio('CAP non valido. Deve essere 5 numeri (es: 40121)', 'error');
        return;
    }
    
    // Conferma
    if (!confirm('Salvare le modifiche?')) return;
    
    // Prepara dati (tutto maiuscolo)
    const datiAggiornati = {
        Indirizzo: document.getElementById('modificaIndirizzo').value.toUpperCase(),
        provincia: provincia,
        cap: cap,
        cliente: document.getElementById('modificaCliente').value.toUpperCase(),
        tipo: document.getElementById('modificaTipo').value,
        updated_at: new Date().toISOString()
    };
    
    try {
        const { error } = await supabaseClient
            .from('montaggi')
            .update(datiAggiornati)
            .eq('impianto', impiantoId);
        
        if (error) throw error;
        
        // Aggiorna dati locali
        Object.assign(datiImpianto, datiAggiornati);
        
        // Torna a visualizzazione
        annullaModifica();
        aggiornaInterfaccia();
        
        mostraMessaggio('Dati aggiornati con successo!', 'success');
        
    } catch (error) {
        console.error('Errore salvataggio:', error);
        mostraMessaggio('Errore durante il salvataggio', 'error');
    }
});

// FUNZIONE: Mostra messaggio temporaneo
function mostraMessaggio(testo, tipo = 'info') {
    // Rimuovi messaggi precedenti
    const vecchiMsg = document.querySelectorAll('.messaggio-temporaneo');
    vecchiMsg.forEach(msg => msg.remove());
    
    // Crea nuovo messaggio
    const msgDiv = document.createElement('div');
    msgDiv.className = `messaggio-temporaneo messaggio-${tipo}`;
    msgDiv.textContent = testo;
    document.body.appendChild(msgDiv);
    
    // Rimuovi dopo 3 secondi
    setTimeout(() => {
        if (msgDiv.parentNode) {
            msgDiv.remove();
        }
    }, 3000);
}


// ========================
// FUNZIONE PER CREARE NUOVO LAVORO MONTAGGIO
// ========================
window.apriNuovoLavoroMontaggio = function() {
    if (!datiImpianto || !datiImpianto.impianto) {
        mostraMessaggio('Impianto non disponibile', 'error');
        return;
    }
    
    // Reindirizza alla pagina nuovo lavoro montaggio
    window.location.href = `nuovo_lavoro_montaggi.html?id=${datiImpianto.impianto}`;
};