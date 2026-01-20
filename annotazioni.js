const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variabili globali
let impiantoCorrente = null;
let datiImpianto = null;
let annotazioniCaricate = [];
let annotazioneDaCancellare = null;
const tecnicoLoggato = localStorage.getItem('tecnico_loggato') || 'Tecnico Non Loggato';
let filtroAttivo = 'tutti';

document.addEventListener('DOMContentLoaded', async () => {
    // Recupera codice impianto dall'URL
    const urlParams = new URLSearchParams(window.location.search);
    impiantoCorrente = urlParams.get('impianto');
    
    if (!impiantoCorrente) {
        mostraErrore('Codice impianto non specificato');
        return;
    }
    
    // Aggiorna header con codice impianto
    document.getElementById('codice-impianto-header').textContent = impiantoCorrente;
    document.getElementById('codice-impianto').textContent = impiantoCorrente;
    document.getElementById('info-impianto-modal').textContent = impiantoCorrente;
    
    // Carica dati impianto e annotazioni
    await caricaDatiImpianto();
    await caricaAnnotazioni();
    
    // Imposta data di default a oggi
    const oggi = new Date().toISOString().split('T')[0];
    document.getElementById('data-annotazione').value = oggi;
});

// ====================
// FUNZIONI NAVIGAZIONE
// ====================

function tornaIndietro() {
    window.history.back();
}

// ====================
// FUNZIONI CARICAMENTO
// ====================

async function caricaDatiImpianto() {
    try {
        const { data, error } = await supabaseClient
            .from('Parco_app')
            .select('impianto, Indirizzo, localit, prov, ult_sem')
            .eq('impianto', impiantoCorrente)
            .single();

        if (error) throw error;
        
        datiImpianto = data;
        
        // Aggiorna UI
        document.getElementById('indirizzo-impianto').textContent = 
            `${data.Indirizzo}${data.localit ? ', ' + data.localit : ''}`;
        
        document.getElementById('ultima-manutenzione').textContent = 
            data.ult_sem || '---';
        
    } catch (err) {
        console.error('Errore caricamento impianto:', err);
        mostraNotifica('Errore nel caricamento dati impianto', 'errore');
    }
}

async function caricaAnnotazioni() {
    const lista = document.getElementById('lista-annotazioni');
    lista.innerHTML = `
        <div class="stato-caricamento">
            <span class="material-symbols-rounded">progress_activity</span>
            <div style="font-weight: 600;">Caricamento annotazioni...</div>
        </div>
    `;

    try {
        const { data, error } = await supabaseClient
            .from('annotazioni')
            .select('*')
            .eq('impianto_ann', impiantoCorrente)
            .order('anno_ann', { ascending: false })
            .order('mese_ann', { ascending: false })
            .order('giorno_ann', { ascending: false });

        if (error) throw error;
        
        annotazioniCaricate = data || [];
        aggiornaListaAnnotazioni();
        aggiornaContatore();
        
    } catch (err) {
        console.error('Errore caricamento annotazioni:', err);
        lista.innerHTML = `
            <div class="messaggio-vuoto">
                <span class="material-symbols-rounded">error</span>
                <div style="font-weight: 600;">Errore nel caricamento</div>
                <div style="font-size: 0.85rem; margin-top: 5px;">${err.message}</div>
            </div>
        `;
    }
}

// ====================
// FUNZIONI UI
// ====================

function aggiornaListaAnnotazioni() {
    const lista = document.getElementById('lista-annotazioni');
    
    if (annotazioniCaricate.length === 0) {
        lista.innerHTML = `
            <div class="messaggio-vuoto">
                <span class="material-symbols-rounded">note_add</span>
                <div style="font-weight: 600;">Nessuna annotazione presente</div>
                <div style="font-size: 0.85rem; margin-top: 5px;">Aggiungi la prima annotazione</div>
            </div>
        `;
        return;
    }
    
    // Filtra annotazioni in base al filtro attivo
    let annotazioniFiltrate = annotazioniCaricate;
    if (filtroAttivo !== 'tutti') {
        annotazioniFiltrate = annotazioniCaricate.filter(ann => ann.tipo === filtroAttivo);
    }
    
    if (annotazioniFiltrate.length === 0) {
        lista.innerHTML = `
            <div class="messaggio-vuoto">
                <span class="material-symbols-rounded">filter_alt</span>
                <div style="font-weight: 600;">Nessuna annotazione con questo filtro</div>
                <div style="font-size: 0.85rem; margin-top: 5px;">Prova con un altro tipo</div>
            </div>
        `;
        return;
    }
    
    lista.innerHTML = '';
    
    annotazioniFiltrate.forEach((ann, index) => {
        const card = creaCardAnnotazione(ann, index);
        lista.appendChild(card);
    });
}

function creaCardAnnotazione(ann, index) {
    const card = document.createElement('div');
    card.className = 'card-annotazione';
    card.dataset.index = index;
    
    // Formatta data
    const dataFormattata = `${ann.giorno_ann.padStart(2, '0')}/${ann.mese_ann.padStart(2, '0')}/${ann.anno_ann}`;
    
    // Determina tipo
    let tipoTesto, tipoClasse, tipoBadge;
    switch(ann.tipo) {
        case '0':
            tipoTesto = 'MANUTENZIONE';
            tipoClasse = 'manutenzione';
            tipoBadge = 'badge-manutenzione';
            break;
        case '1':
            tipoTesto = 'APPUNTAMENTO';
            tipoClasse = 'appuntamento';
            tipoBadge = 'badge-appuntamento';
            break;
        case '2':
            tipoTesto = 'NOTA';
            tipoClasse = 'nota';
            tipoBadge = 'badge-nota';
            break;
        default:
            tipoTesto = 'SCONOSCIUTO';
            tipoClasse = 'nota';
            tipoBadge = 'badge-nota';
    }
    
    card.innerHTML = `
        <div class="annotazione-header">
            <div class="annotazione-data">
                <span class="material-symbols-rounded" style="font-size: 18px;">calendar_today</span>
                ${dataFormattata}
            </div>
            <div class="annotazione-tipo-badge ${tipoClasse}">
                <div class="badge-tipo ${tipoBadge}"></div>
                ${tipoTesto}
            </div>
        </div>
        
        <div class="annotazione-contenuto">
            <div class="annotazione-testo" id="testo-anteprima-${index}">
                ${ann.note ? (ann.note.length > 150 ? ann.note.substring(0, 150) + '...' : ann.note) : 'Nessuna nota'}
            </div>
            <div class="annotazione-testo-completo" id="testo-completo-${index}" style="display: none;">
                ${ann.note || 'Nessuna nota'}
            </div>
        </div>
        
        <div class="annotazione-footer">
            <div class="annotazione-tecnico">
                <span class="material-symbols-rounded" style="font-size: 16px;">person</span>
                ${ann.tecnico_ann || 'Tecnico non specificato'}
            </div>
            <div class="annotazione-azioni">
                <button onclick="event.stopPropagation(); mostraConfermaCancellazione('${ann.id}', ${index})" class="btn-azione cancella" title="Cancella annotazione">
                    <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                </button>
            </div>
        </div>
    `;
    
    // Aggiungi evento click per espandere
    card.addEventListener('click', (e) => {
        // Non espandere se clic su bottoni azione
        if (e.target.closest('.annotazione-azioni')) return;
        
        const anteprima = card.querySelector(`#testo-anteprima-${index}`);
        const completo = card.querySelector(`#testo-completo-${index}`);
        
        if (completo.style.display === 'none') {
            anteprima.style.display = 'none';
            completo.style.display = 'block';
            card.classList.add('card-annotazione-espansa');
        } else {
            anteprima.style.display = 'block';
            completo.style.display = 'none';
            card.classList.remove('card-annotazione-espansa');
        }
    });
    
    return card;
}

function aggiornaContatore() {
    const totale = annotazioniCaricate.length;
    const contatore = document.getElementById('contatore-annotazioni');
    contatore.textContent = `${totale} annotazion${totale === 1 ? 'e' : 'i'}`;
}

// ====================
// FUNZIONI FILTRO
// ====================

function filtraAnnotazioni(tipo) {
    // Aggiorna bottoni filtro
    document.querySelectorAll('.filtro-tipo-compatto').forEach(btn => {
        btn.classList.remove('attivo');
    });
    
    const filtroBtn = document.querySelector(`.filtro-tipo-compatto[data-tipo="${tipo}"]`);
    if (filtroBtn) {
        filtroBtn.classList.add('attivo');
    }
    
    // Aggiorna filtro attivo globale
    filtroAttivo = tipo;
    aggiornaListaAnnotazioni();
}

// ====================
// FUNZIONI FORM
// ====================

function mostraFormNuovaAnnotazione() {
    const modal = document.getElementById('modal-nuova-annotazione');
    modal.style.display = 'flex';
    
    // Reset form
    document.getElementById('tipo-selezionato').value = '';
    document.querySelectorAll('.btn-tipo-opzione').forEach(btn => {
        btn.classList.remove('selezionato');
    });
    
    const oggi = new Date().toISOString().split('T')[0];
    document.getElementById('data-annotazione').value = oggi;
    document.getElementById('note-annotazione').value = '';
    
    // Nascondi validazione
    document.getElementById('validazione-note').style.display = 'none';
    document.getElementById('note-annotazione').placeholder = 'Seleziona un tipo per visualizzare il placeholder...';
}

function chiudiModal() {
    document.getElementById('modal-nuova-annotazione').style.display = 'none';
}

function selezionaTipo(tipo) {
    const tipoSelezionato = document.getElementById('tipo-selezionato');
    
    // Rimuovi selezione precedente
    document.querySelectorAll('.btn-tipo-opzione').forEach(btn => {
        btn.classList.remove('selezionato');
    });
    
    // Aggiungi selezione corrente
    const btnTipo = document.querySelector(`.btn-tipo-opzione[data-tipo="${tipo}"]`);
    if (btnTipo) {
        btnTipo.classList.add('selezionato');
    }
    
    tipoSelezionato.value = tipo;
    
    // Aggiorna placeholder textarea in base al tipo
    const textarea = document.getElementById('note-annotazione');
    const validazioneDiv = document.getElementById('validazione-note');
    const testoValidazione = document.getElementById('testo-validazione');
    
    switch(tipo) {
        case '0':
            textarea.placeholder = 'Descrizione della manutenzione effettuata (facoltativo)...';
            testoValidazione.textContent = 'Le note sono facoltative per le manutenzioni';
            validazioneDiv.style.color = '#64748b';
            validazioneDiv.style.display = 'block';
            break;
        case '1':
            textarea.placeholder = 'Dettagli dell\'appuntamento (facoltativo)...';
            testoValidazione.textContent = 'Le note sono facoltative per gli appuntamenti';
            validazioneDiv.style.color = '#64748b';
            validazioneDiv.style.display = 'block';
            break;
        case '2':
            textarea.placeholder = 'Testo della nota informativa (obbligatorio)...';
            testoValidazione.textContent = 'Le note sono obbligatorie per le note informative';
            validazioneDiv.style.color = '#dc2626';
            validazioneDiv.style.display = 'block';
            break;
    }
}

async function salvaAnnotazione() {
    const tipo = document.getElementById('tipo-selezionato').value;
    const dataInput = document.getElementById('data-annotazione').value;
    const note = document.getElementById('note-annotazione').value.trim();
    
    // Validazioni base
    if (!tipo) {
        mostraNotifica('Seleziona un tipo di annotazione', 'errore');
        return;
    }
    
    if (!dataInput) {
        mostraNotifica('Inserisci una data', 'errore');
        return;
    }
    
    // Validazione specifica per tipo 2 (Note)
    if (tipo === '2' && !note) {
        mostraNotifica('Per le note informative è obbligatorio inserire del testo', 'errore');
        document.getElementById('note-annotazione').focus();
        return;
    }
    
    // Note facoltative per tipo 0 e 1
    if ((tipo === '0' || tipo === '1') && !note) {
        console.log('Note facoltative per tipo', tipo, '- procedo con salvataggio');
    }
    
    // Disabilita pulsante durante salvataggio
    const btnSalva = document.getElementById('btn-salva-annotazione');
    btnSalva.disabled = true;
    btnSalva.innerHTML = '<span class="material-symbols-rounded" style="font-size: 20px; animation: pulse 1.5s infinite;">progress_activity</span> Salvataggio...';
    
    try {
        // Parse data
        const data = new Date(dataInput);
        const giorno = data.getDate().toString();
        const mese = (data.getMonth() + 1).toString();
        const anno = data.getFullYear().toString();
        
        // Formatta data per Parco_app (DD/MM/YYYY)
        const dataFormattata = `${giorno.padStart(2, '0')}/${mese.padStart(2, '0')}/${anno}`;
        
        // 1. INSERISCI IN ANNOTAZIONI
        const { data: nuovaAnnotazione, error: errorAnnotazione } = await supabaseClient
            .from('annotazioni')
            .insert([{
                impianto_ann: impiantoCorrente,
                giorno_ann: giorno,
                mese_ann: mese,
                anno_ann: anno,
                tecnico_ann: tecnicoLoggato,
                tipo: tipo,
                note: note || null
            }])
            .select()
            .single();

        if (errorAnnotazione) {
            console.error('Errore inserimento annotazione:', errorAnnotazione);
            throw errorAnnotazione;
        }
        
        // 2. SE TIPO = 0, AGGIORNA PARCO_APP
      // Sostituisci tutta la sezione dell'update con:
if (tipo === '0') {
    console.log('🚀 AGGIORNAMENTO PARCO_APP - Impianto:', impiantoCorrente, 'Data:', dataFormattata);
    
    try {
        // Prima verifichiamo che l'impianto esista
        const { data: verificaImpianto, error: verificaError } = await supabaseClient
            .from('Parco_app')
            .select('impianto')
            .eq('impianto', impiantoCorrente)
            .single();
            
        if (verificaError) {
            console.error('Errore verifica impianto:', verificaError);
            throw new Error('Impianto non trovato nel database');
        }
        
        console.log('✅ Impianto verificato:', verificaImpianto);
        
        // Ora facciamo l'update
        const { data: updateResult, error: errorUpdate } = await supabaseClient
            .from('Parco_app')
            .update({ 
                ult_sem: dataFormattata
            })
            .eq('impianto', impiantoCorrente)
            .select();
            
        if (errorUpdate) {
            console.error('❌ Errore UPDATE:', errorUpdate);
            throw errorUpdate;
        }
        
        console.log('✅ Update completato:', updateResult);
        
        // Verifica che l'update sia andato a buon fine
        if (updateResult && updateResult.length > 0) {
            console.log('✅ Conferma: Record aggiornato:', updateResult[0]);
            
            // Aggiorna immediatamente l'UI
            if (datiImpianto) {
                datiImpianto.ult_sem = dataFormattata;
                const ultimaManutenzione = document.getElementById('ultima-manutenzione');
                ultimaManutenzione.textContent = dataFormattata;
                
                // Forza anche un aggiornamento nel localStorage per la pagina manutenzioni
                localStorage.setItem(`ultima_manut_${impiantoCorrente}`, dataFormattata);
                
                // Effetto visivo
                ultimaManutenzione.style.color = '#22c55e';
                ultimaManutenzione.style.fontWeight = '800';
                
                setTimeout(() => {
                    ultimaManutenzione.style.color = '';
                    ultimaManutenzione.style.fontWeight = '600';
                }, 1500);
            }
        } else {
            console.warn('⚠️ Update completato ma nessun record restituito');
        }
        
    } catch (updateErr) {
        console.error('❌ Errore durante l\'aggiornamento:', updateErr);
        throw updateErr;
    }
}
        
        // Aggiorna lista annotazioni
        annotazioniCaricate.unshift(nuovaAnnotazione);
        aggiornaListaAnnotazioni();
        aggiornaContatore();
        
        // Chiudi modal e mostra successo
        chiudiModal();
        
        // Messaggio di conferma specifico
        let messaggioSuccesso = 'Annotazione salvata con successo!';
        if (tipo === '0') {
            messaggioSuccesso = 'Manutenzione salvata e data aggiornata!';
        }
        
        mostraNotifica(messaggioSuccesso, 'successo');
        
    } catch (err) {
        console.error('Errore salvataggio annotazione:', err);
        
        let messaggioErrore = `Errore: ${err.message}`;
        if (err.message.includes('violates row-level security policy')) {
            messaggioErrore = 'Errore di permessi. Controlla le policy RLS di Supabase.';
        } else if (err.message.includes('updated_at')) {
            messaggioErrore = 'Errore tecnico. Riprova più tardi.';
        }
        
        mostraNotifica(messaggioErrore, 'errore');
    } finally {
        // Riabilita pulsante
        btnSalva.disabled = false;
        btnSalva.textContent = 'Salva Annotazione';
    }
}

// ====================
// FUNZIONI CANCELLAZIONE
// ====================

function mostraConfermaCancellazione(idAnnotazione, index) {
    annotazioneDaCancellare = { id: idAnnotazione, index: index };
    document.getElementById('modal-conferma-cancellazione').style.display = 'flex';
}

function chiudiModalCancellazione() {
    annotazioneDaCancellare = null;
    document.getElementById('modal-conferma-cancellazione').style.display = 'none';
}

async function confermaCancellazione() {
    if (!annotazioneDaCancellare) return;
    
    try {
        const { error } = await supabaseClient
            .from('annotazioni')
            .delete()
            .eq('id', annotazioneDaCancellare.id);

        if (error) throw error;
        
        // Rimuovi dalla lista locale
        annotazioniCaricate.splice(annotazioneDaCancellare.index, 1);
        
        // Aggiorna UI
        aggiornaListaAnnotazioni();
        aggiornaContatore();
        
        // Chiudi modal e mostra successo
        chiudiModalCancellazione();
        mostraNotifica('Annotazione cancellata', 'successo');
        
    } catch (err) {
        console.error('Errore cancellazione:', err);
        mostraNotifica(`Errore: ${err.message}`, 'errore');
    } finally {
        annotazioneDaCancellare = null;
    }
}

// ====================
// UTILITY
// ====================

function mostraNotifica(messaggio, tipo = 'info') {
    // Rimuovi notifica esistente
    const notificaEsistente = document.querySelector('.notifica');
    if (notificaEsistente) notificaEsistente.remove();
    
    // Crea nuova notifica
    const notifica = document.createElement('div');
    notifica.className = `notifica ${tipo}`;
    
    // Icona in base al tipo
    let icona = 'info';
    if (tipo === 'successo') icona = 'check_circle';
    if (tipo === 'errore') icona = 'error';
    
    notifica.innerHTML = `
        <span class="material-symbols-rounded">${icona}</span>
        <div style="font-weight: 600; font-size: 0.9rem;">${messaggio}</div>
    `;
    
    document.body.appendChild(notifica);
    
    // Rimuovi automaticamente dopo 3 secondi
    setTimeout(() => {
        if (notifica.parentNode) {
            notifica.style.opacity = '0';
            notifica.style.transform = 'translate(-50%, -20px)';
            notifica.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                if (notifica.parentNode) notifica.remove();
            }, 300);
        }
    }, 3000);
}

function mostraErrore(messaggio) {
    document.getElementById('main-content').innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <span class="material-symbols-rounded" style="font-size: 64px; color: #ef4444; margin-bottom: 20px;">error</span>
            <div style="font-weight: 800; color: #1e293b; font-size: 1.2rem; margin-bottom: 10px;">Errore</div>
            <div style="color: #64748b; margin-bottom: 30px;">${messaggio}</div>
            <button onclick="tornaIndietro()" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 12px; font-weight: 600; cursor: pointer;">
                Torna Indietro
            </button>
        </div>
    `;
}

// ====================
// GESTIONE PULL-TO-REFRESH
// ====================

let touchStartY = 0;
let touchEndY = 0;

document.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', e => {
    touchEndY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', async () => {
    const diff = touchStartY - touchEndY;
    const mainContent = document.getElementById('main-content');
    
    // Se lo scroll è in alto e si swipa verso il basso
    if (mainContent.scrollTop === 0 && diff < -50) {
        mostraNotifica('Aggiornamento in corso...', 'info');
        await caricaAnnotazioni();
    }
});