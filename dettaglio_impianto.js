// ============================================
// DETTAGLIO IMPIANTO - FUNZIONI CONDIVISE
// ============================================

// ✅ CLIENT CENTRALIZZATO
const supabaseClient = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;

// ✅ UTENTE CORRENTE
const utenteCorrente = typeof authGetUtente === 'function' ? authGetUtente() : null;
const tecnicoLoggato = utenteCorrente ? utenteCorrente.nome_completo : null;
const ruolo = utenteCorrente ? utenteCorrente.ruolo : null;

// ✅ VARIABILI GLOBALI
let impiantoId = null;
let schedaCorrente = null;

// ✅ NOTIFICHE
function mostraNotifica(messaggio, tipo = 'info') {
    // ... (stessa funzione delle altre pagine)
}

// ✅ CARICAMENTO DATI SCHEDA
async function caricaSchedaTecnica() {
    try {
        const { data, error } = await supabaseClient
            .from('dettaglio_tecnico_impianto')
            .select('*')
            .eq('impianto_id', impiantoId)
            .maybeSingle();
        
        if (error) throw error;
        
        schedaCorrente = data;
        return data;
        
    } catch (error) {
        console.error('❌ Errore caricamento scheda:', error);
        mostraNotifica('Errore nel caricamento della scheda', 'errore');
        return null;
    }
}

// ✅ SALVATAGGIO SCHEDA
async function salvaScheda(dati) {
    try {
        const utente = utenteCorrente;
        const now = new Date().toISOString();
        
        const datiCompleti = {
            ...dati,
            impianto_id: impiantoId,
            aggiornato_il: now,
            aggiornato_da: utente.nome_completo
        };
        
        if (schedaCorrente?.id) {
            // AGGIORNAMENTO
            const { error } = await supabaseClient
                .from('dettaglio_tecnico_impianto')
                .update(datiCompleti)
                .eq('id', schedaCorrente.id);
            
            if (error) throw error;
            mostraNotifica('Scheda aggiornata', 'successo');
            
        } else {
            // NUOVO INSERIMENTO
            datiCompleti.creato_il = now;
            datiCompleti.creato_da = utente.nome_completo;
            
            const { error } = await supabaseClient
                .from('dettaglio_tecnico_impianto')
                .insert([datiCompleti]);
            
            if (error) throw error;
            mostraNotifica('Scheda creata', 'successo');
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Errore salvataggio:', error);
        mostraNotifica('Errore nel salvataggio', 'errore');
        return false;
    }
}

// ✅ ELIMINAZIONE SCHEDA (solo supervisori/admin)
async function eliminaScheda() {
    if (ruolo !== 'supervisore' && ruolo !== 'admin') {
        mostraNotifica('Non hai i permessi per eliminare', 'errore');
        return false;
    }
    
    if (!confirm('Eliminare definitivamente questa scheda tecnica?')) return false;
    
    try {
        const { error } = await supabaseClient
            .from('dettaglio_tecnico_impianto')
            .delete()
            .eq('id', schedaCorrente.id);
        
        if (error) throw error;
        
        mostraNotifica('Scheda eliminata', 'successo');
        return true;
        
    } catch (error) {
        console.error('❌ Errore eliminazione:', error);
        mostraNotifica('Errore nell\'eliminazione', 'errore');
        return false;
    }
}

// ✅ FUNZIONI DI FORMATTAZIONE
function formattaData(data) {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('it-IT');
}

function formattaBooleano(valore) {
    return valore ? '✓ Presente' : '✗ Assente';
}

async function caricaDatiImpianto() {
    try {
        const { data, error } = await supabaseClient
            .from('Parco_app')
            .select('impianto, Indirizzo, localit, prov')
            .eq('impianto', impiantoId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('impianto-codice').textContent = data.impianto;
        
        let indirizzo = '';
        if (data.Indirizzo) indirizzo += data.Indirizzo;
        if (data.localit) indirizzo += (indirizzo ? ' - ' : '') + data.localit;
        if (data.prov) indirizzo += (indirizzo ? ' (' : '') + data.prov + (indirizzo ? ')' : '');
        
        document.getElementById('impianto-indirizzo').textContent = indirizzo || 'Indirizzo non disponibile';
        
    } catch (error) {
        console.error('Errore caricamento impianto:', error);
        document.getElementById('impianto-codice').textContent = impiantoId;
        document.getElementById('impianto-indirizzo').textContent = 'Impianto non trovato in anagrafica';
    }
}





function popolaDatiTecnici(scheda) {
    const content = document.getElementById('dati-tecnici-content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="info-item">
            <span class="info-label">Costruttore</span>
            <span class="info-value">${scheda.costruttore || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Modello</span>
            <span class="info-value">${scheda.modello_impianto || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Anno installazione</span>
            <span class="info-value">${scheda.anno_installazione || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Piani serviti</span>
            <span class="info-value">${scheda.piani_serviti || '-'}</span>
        </div>
    `;
}

function popolaMeccanica(scheda) {
    const content = document.getElementById('meccanica-content');
    if (!content) return;
    
    let tipoMeccanico = scheda.tipo_meccanico || '-';
    if (scheda.tipo_meccanico === 'altro' && scheda.tipo_meccanico_altro) {
        tipoMeccanico = scheda.tipo_meccanico_altro;
    }
    
    content.innerHTML = `
        <div class="info-item">
            <span class="info-label">Tipo</span>
            <span class="info-value">${tipoMeccanico}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Produttore</span>
            <span class="info-value">${scheda.produttore_meccanico || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Modello</span>
            <span class="info-value">${scheda.modello_meccanico || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Potenza</span>
            <span class="info-value">${scheda.potenza_kw ? scheda.potenza_kw + ' kW' : '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Anno installazione</span>
            <span class="info-value">${scheda.anno_meccanico || '-'}</span>
        </div>
    `;
}

function popolaFuni(scheda) {
    const content = document.getElementById('funi-content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="info-item">
            <span class="info-label">Tipo</span>
            <span class="info-value">${scheda.tipo_funi || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Numero</span>
            <span class="info-value">${scheda.numero_funi || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Diametro</span>
            <span class="info-value">${scheda.diametro_funi ? scheda.diametro_funi + ' mm' : '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Anno installazione</span>
            <span class="info-value">${scheda.anno_funi || '-'}</span>
        </div>
    `;
}

function popolaLimitatore(scheda) {
    const content = document.getElementById('limitatore-content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="info-item">
            <span class="info-label">Produttore</span>
            <span class="info-value">${scheda.produttore_limitatore || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Modello</span>
            <span class="info-value">${scheda.modello_limitatore || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Matricola</span>
            <span class="info-value">${scheda.matricola_limitatore || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Anno installazione</span>
            <span class="info-value">${scheda.anno_limitatore || '-'}</span>
        </div>
    `;
}

function popolaElettrica(scheda) {
    const content = document.getElementById('elettrica-content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="info-item">
            <span class="info-label">Quadro</span>
            <span class="info-value">${scheda.quadro || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Marca</span>
            <span class="info-value">${scheda.marca_quadro || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Modello</span>
            <span class="info-value">${scheda.modello_quadro || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Anno installazione</span>
            <span class="info-value">${scheda.anno_quadro || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Bottoniere</span>
            <span class="info-value">${scheda.bottoniere || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Emergenza</span>
            <span class="info-value">${scheda.emergenza || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Combinatore</span>
            <span class="info-value">${scheda.combinatore || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Batterie</span>
            <span class="info-value">${scheda.batterie || '-'}</span>
        </div>
    `;
}

function popolaPorte(scheda) {
    const content = document.getElementById('porte-content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="info-item">
            <span class="info-label">Tipo Porte</span>
            <span class="info-value">${scheda.tipo_porte || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Apertura</span>
            <span class="info-value">${scheda.apertura_porte || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Luce Cabina</span>
            <span class="info-value">${scheda.luce_cabina || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Luce Emergenza</span>
            <span class="info-value">${scheda.luce_emergenza || '-'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Bottoniera</span>
            <span class="info-value">${scheda.bottoniera_cabina || '-'}</span>
        </div>
    `;
}

function popolaAccessori(scheda) {
    const content = document.getElementById('accessori-content');
    if (!content) return;
    
    let html = '<div class="accessori-grid">';
    
    if (scheda.specchio) {
        html += '<span class="accessorio-item presente"><span class="material-symbols-rounded">check</span> Specchio</span>';
    }
    if (scheda.tappeto) {
        html += '<span class="accessorio-item presente"><span class="material-symbols-rounded">check</span> Tappeto</span>';
    }
    if (scheda.telefono) {
        html += '<span class="accessorio-item presente"><span class="material-symbols-rounded">check</span> Telefono</span>';
    }
    
    html += '</div>';
    
    if (scheda.altri_accessori) {
        html += `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">
            <strong>Altri accessori:</strong> ${scheda.altri_accessori}
        </div>`;
    }
    
    content.innerHTML = html || '<p class="info-value">Nessun accessorio registrato</p>';
}

function popolaAccesso(scheda) {
    const content = document.getElementById('accesso-content');
    if (!content) return;
    
    let html = '';
    
    if (scheda.locale_macchina) {
        html += `
            <div class="contatto-item">
                <div class="contatto-icona"><span class="material-symbols-rounded">location_on</span></div>
                <div class="contatto-dettagli">
                    <div class="contatto-nome">Locale Macchina</div>
                    <div class="contatto-indirizzo">${scheda.locale_macchina}</div>
                </div>
            </div>
        `;
    }
    
    if (scheda.ubicazione_chiavi) {
        html += `
            <div class="contatto-item">
                <div class="contatto-icona"><span class="material-symbols-rounded">vpn_key</span></div>
                <div class="contatto-dettagli">
                    <div class="contatto-nome">Ubicazione chiavi</div>
                    <div class="contatto-indirizzo">${scheda.ubicazione_chiavi}</div>
                </div>
            </div>
        `;
    }
    
    if (scheda.referente) {
        html += `
            <div class="contatto-item">
                <div class="contatto-icona"><span class="material-symbols-rounded">person</span></div>
                <div class="contatto-dettagli">
                    <div class="contatto-nome">${scheda.referente}</div>
                    ${scheda.telefono_referente ? `<div class="contatto-telefono">${scheda.telefono_referente}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html || '<p class="info-value">Nessuna informazione su accesso e chiavi</p>';
}

function popolaEnti(scheda) {
    const content = document.getElementById('enti-content');
    if (!content) return;
    
    content.innerHTML = `
        <div class="info-item info-full">
            <span class="info-label">Ente</span>
            <span class="info-value">${scheda.ente || '-'}</span>
        </div>
        <div class="info-item info-full">
            <span class="info-label">Ultima verifica</span>
            <span class="info-value">${scheda.ultima_verifica ? new Date(scheda.ultima_verifica).toLocaleDateString('it-IT') : '-'}</span>
        </div>
    `;
}

function popolaFoto(scheda) {
    const content = document.getElementById('foto-content');
    if (!content) return;
    
    const fotoUrls = scheda.foto_urls || [];
    
    if (fotoUrls.length === 0) {
        content.innerHTML = Array(6).fill(0).map(() => `
            <div class="foto-placeholder">
                <span class="material-symbols-rounded">image</span>
            </div>
        `).join('');
        return;
    }
    
    let html = '';
    for (let i = 0; i < 6; i++) {
        if (i < fotoUrls.length) {
            html += `
                <div class="foto-item">
                    <img src="${fotoUrls[i]}" alt="Foto tecnica" onclick="window.open('${fotoUrls[i]}', '_blank')">
                </div>
            `;
        } else {
            html += `
                <div class="foto-placeholder">
                    <span class="material-symbols-rounded">image</span>
                </div>
            `;
        }
    }
    
    content.innerHTML = html;
}

function popolaNote(scheda) {
    const content = document.getElementById('note-content');
    if (!content) return;
    
    content.innerHTML = scheda.note_generali || 'Nessuna nota presente';
}

function popolaUltimaModifica(scheda) {
    const content = document.getElementById('ultima-modifica');
    if (!content) return;
    
    const dataModifica = scheda.aggiornato_il ? new Date(scheda.aggiornato_il).toLocaleDateString('it-IT') : '-';
    const tecnico = scheda.aggiornato_da || '-';
    
    content.innerHTML = `
        <span class="material-symbols-rounded" style="font-size: 0.8rem;">history</span>
        Ultima modifica: ${dataModifica} - 
        <span class="material-symbols-rounded" style="font-size: 0.8rem;">person</span>
        ${tecnico}
    `;
}

// Contatore caratteri per note generali
document.getElementById('note_generali')?.addEventListener('input', function() {
    document.getElementById('conta-caratteri').textContent = this.value.length;
});

// In dettaglio_impianto.js
function mostraNotifica(messaggio, tipo = 'info') {
    // Rimuovi notifica esistente
    const notificaEsistente = document.querySelector('.notifica');
    if (notificaEsistente) notificaEsistente.remove();
    
    const notifica = document.createElement('div');
    notifica.className = `notifica ${tipo}`;
    
    let icona = 'info';
    if (tipo === 'successo') icona = 'check_circle';
    if (tipo === 'errore') icona = 'error';
    
    notifica.innerHTML = `
        <span class="material-symbols-rounded" style="font-size: 14px;">${icona}</span>
        <span>${messaggio}</span>
    `;
    
    document.body.appendChild(notifica);
    
    setTimeout(() => {
        if (notifica.parentNode) {
            notifica.style.opacity = '0';
            notifica.style.transform = 'translateX(-50%) translateY(-5px)';
            notifica.style.transition = 'all 0.15s ease';
            
            setTimeout(() => {
                if (notifica.parentNode) notifica.remove();
            }, 150);
        }
    }, 2000);
}

// ============================================
// FUNZIONI DI LOADING (CONDIVISE)
// ============================================

function mostraLoading(messaggio = 'Salvataggio in corso...') {
    let loading = document.getElementById('loading-overlay');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading-overlay';
        loading.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.9);
            z-index: 2000;
            display: none;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 1rem;
        `;
        loading.innerHTML = `
            <div style="width: 50px; height: 50px; border: 4px solid var(--primary-light); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="font-weight: 800; color: var(--primary);" id="loading-messaggio">${messaggio}</div>
        `;
        document.body.appendChild(loading);
    } else {
        document.getElementById('loading-messaggio').textContent = messaggio;
    }
    loading.style.display = 'flex';
}

function nascondiLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) loading.style.display = 'none';
}

// Aggiungi anche lo stile per l'animazione
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);



// ✅ ESPORTA FUNZIONI
window.mostraNotifica = mostraNotifica;
window.caricaSchedaTecnica = caricaSchedaTecnica;
window.salvaScheda = salvaScheda;
window.eliminaScheda = eliminaScheda;
window.formattaData = formattaData;
window.formattaBooleano = formattaBooleano;