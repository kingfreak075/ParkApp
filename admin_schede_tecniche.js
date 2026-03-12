// ============================================
// ADMIN SCHEDE TECNICHE - GESTIONE COMPLETA
// ============================================

let schedeList = [];
let schedaCorrente = null;

// CARICAMENTO SCHEDE
async function caricaSchedeTecniche() {
    try {
        const supabase = getSupabaseClient();
        
        const { data, error } = await supabase
            .from('dettaglio_tecnico_impianto')
            .select('*')
            .order('aggiornato_il', { ascending: false });
        
        if (error) throw error;
        
        schedeList = data || [];
        renderTabellaSchede();
        aggiornaStatisticheSchede();
        
    } catch (error) {
        console.error('❌ Errore caricamento schede:', error);
        mostraNotifica('Errore nel caricamento', 'errore');
    }
}

// RENDER TABELLA
function renderTabellaSchede() {
    const tbody = document.getElementById('tabella-schede-body');
    if (!tbody) return;
    
    if (schedeList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center">
                    Nessuna scheda tecnica trovata
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    schedeList.forEach(scheda => {
        const dataMod = scheda.aggiornato_il ? new Date(scheda.aggiornato_il).toLocaleDateString('it-IT') : '-';
        const fotoCount = scheda.foto_urls?.length || 0;
        
        html += `
            <tr data-id="${scheda.id}">
                <td>
                    <input type="checkbox" class="select-scheda" value="${scheda.id}" onchange="aggiornaSelezione()">
                </td>
                <td><strong>${scheda.impianto_id}</strong></td>
                <td>${scheda.tipo_impianto || '-'}</td>
                <td>${scheda.costruttore || '-'}</td>
                <td>${scheda.anno_installazione || '-'}</td>
                <td>${scheda.piani_serviti || '-'}</td>
                <td>
                    <span class="badge ${fotoCount > 0 ? 'badge-success' : 'badge-secondary'}">
                        ${fotoCount} foto
                    </span>
                </td>
                <td>${dataMod}</td>
                <td>
                    <div style="display: flex; gap: 0.25rem;">
                        <button class="btn-icon-small" onclick="apriDettaglioScheda('${scheda.id}')" title="Dettaglio">
                            <span class="material-symbols-rounded">visibility</span>
                        </button>
                        <button class="btn-icon-small" onclick="modificaScheda('${scheda.id}')" title="Modifica">
                            <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="btn-icon-small" style="color: #ef4444;" onclick="eliminaScheda('${scheda.id}')" title="Elimina">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// STATISTICHE
function aggiornaStatisticheSchede() {
    let totaleFoto = 0;
    schedeList.forEach(s => {
        totaleFoto += s.foto_urls?.length || 0;
    });
    
    const ultimaMod = schedeList[0]?.aggiornato_il 
        ? new Date(schedeList[0].aggiornato_il).toLocaleDateString('it-IT') 
        : '-';
    
    document.getElementById('stat-totale-schede').textContent = schedeList.length;
    document.getElementById('stat-impianti-con-scheda').textContent = schedeList.length;
    document.getElementById('stat-totale-foto').textContent = totaleFoto;
    document.getElementById('stat-ultima-modifica').textContent = ultimaMod;
}

// DETTAGLIO MODALE
let fotoCorrente = [];
let fotoIndex = 0;

function apriDettaglioScheda(id) {
    schedaCorrente = schedeList.find(s => s.id == id);
    if (!schedaCorrente) return;
    
    // Prepara array foto
    fotoCorrente = schedaCorrente.foto_urls || [];
    
    // Funzione per formattare valori
    const format = (val) => val || '-';
    const siNo = (val) => val ? '✓' : '✗';
    
    // Sezione TIPO IMPIANTO
    let tipoImpianto = schedaCorrente.tipo_impianto || '-';
    if (schedaCorrente.tipo_impianto === 'altro' && schedaCorrente.tipo_impianto_altro) {
        tipoImpianto = schedaCorrente.tipo_impianto_altro;
    }
    
    // Sezione MECCANICA
    let tipoMeccanico = schedaCorrente.tipo_meccanico || '-';
    if (schedaCorrente.tipo_meccanico === 'altro' && schedaCorrente.tipo_meccanico_altro) {
        tipoMeccanico = schedaCorrente.tipo_meccanico_altro;
    }
    
    let html = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <!-- INTESTAZIONE -->
            <div style="background: linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%); border-radius: 12px; padding: 1.5rem; color: white;">
                <div style="font-size: 2rem; font-weight: 900;">${schedaCorrente.impianto_id}</div>
                <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 0.25rem;">${tipoImpianto}</div>
            </div>
            
            <!-- DATI TECNICI -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">description</span> Dati Tecnici
                </h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div><strong>Costruttore:</strong> ${format(schedaCorrente.costruttore)}</div>
                    <div><strong>Modello:</strong> ${format(schedaCorrente.modello_impianto)}</div>
                    <div><strong>Anno:</strong> ${format(schedaCorrente.anno_installazione)}</div>
                    <div><strong>Piani:</strong> ${format(schedaCorrente.piani_serviti)}</div>
                </div>
            </div>
            
            <!-- PARTE MECCANICA -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">precision_manufacturing</span> Parte Meccanica
                </h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div><strong>Tipo:</strong> ${tipoMeccanico}</div>
                    <div><strong>Produttore:</strong> ${format(schedaCorrente.produttore_meccanico)}</div>
                    <div><strong>Modello:</strong> ${format(schedaCorrente.modello_meccanico)}</div>
                    <div><strong>Potenza:</strong> ${schedaCorrente.potenza_kw ? schedaCorrente.potenza_kw + ' kW' : '-'}</div>
                    <div><strong>Anno:</strong> ${format(schedaCorrente.anno_meccanico)}</div>
                </div>
            </div>
            
            <!-- FUNI / CINGHIE -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">settings</span> Funi / Cinghie
                </h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div><strong>Tipo:</strong> ${format(schedaCorrente.tipo_funi)}</div>
                    <div><strong>Numero:</strong> ${format(schedaCorrente.numero_funi)}</div>
                    <div><strong>Diametro:</strong> ${schedaCorrente.diametro_funi ? schedaCorrente.diametro_funi + ' mm' : '-'}</div>
                    <div><strong>Anno:</strong> ${format(schedaCorrente.anno_funi)}</div>
                </div>
            </div>
            
            <!-- LIMITATORE VELOCITÀ -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">speed</span> Limitatore Velocità
                </h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div><strong>Produttore:</strong> ${format(schedaCorrente.produttore_limitatore)}</div>
                    <div><strong>Modello:</strong> ${format(schedaCorrente.modello_limitatore)}</div>
                    <div><strong>Matricola:</strong> ${format(schedaCorrente.matricola_limitatore)}</div>
                    <div><strong>Anno:</strong> ${format(schedaCorrente.anno_limitatore)}</div>
                </div>
            </div>
            
            <!-- PARTE ELETTRICA -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">electrical_services</span> Parte Elettrica
                </h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div><strong>Quadro:</strong> ${format(schedaCorrente.quadro)}</div>
                    <div><strong>Marca:</strong> ${format(schedaCorrente.marca_quadro)}</div>
                    <div><strong>Modello:</strong> ${format(schedaCorrente.modello_quadro)}</div>
                    <div><strong>Anno:</strong> ${format(schedaCorrente.anno_quadro)}</div>
                    <div><strong>Bottoniere:</strong> ${format(schedaCorrente.bottoniere)}</div>
                    <div><strong>Emergenza:</strong> ${format(schedaCorrente.emergenza)}</div>
                    <div><strong>Combinatore:</strong> ${format(schedaCorrente.combinatore)}</div>
                    <div><strong>Batterie:</strong> ${format(schedaCorrente.batterie)}</div>
                </div>
            </div>
            
            <!-- PORTE E CABINA -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">door_front</span> Porte e Cabina
                </h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div><strong>Tipo Porte:</strong> ${format(schedaCorrente.tipo_porte)}</div>
                    <div><strong>Apertura:</strong> ${format(schedaCorrente.apertura_porte)}</div>
                    <div><strong>Luce Cabina:</strong> ${format(schedaCorrente.luce_cabina)}</div>
                    <div><strong>Luce Emergenza:</strong> ${format(schedaCorrente.luce_emergenza)}</div>
                    <div><strong>Bottoniera:</strong> ${format(schedaCorrente.bottoniera_cabina)}</div>
                </div>
            </div>
            
            <!-- ACCESSORI CABINA -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">checklist</span> Accessori Cabina
                </h4>
                <div style="display: flex; gap: 2rem; margin-bottom: 0.5rem;">
                    <div><strong>Specchio:</strong> ${siNo(schedaCorrente.specchio)}</div>
                    <div><strong>Tappeto:</strong> ${siNo(schedaCorrente.tappeto)}</div>
                    <div><strong>Telefono:</strong> ${siNo(schedaCorrente.telefono)}</div>
                </div>
                <div><strong>Altri:</strong> ${format(schedaCorrente.altri_accessori)}</div>
            </div>
            
            <!-- ACCESSO E CHIAVI -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">key</span> Accesso e Chiavi
                </h4>
                <div><strong>Locale Macchina:</strong> ${format(schedaCorrente.locale_macchina)}</div>
                <div><strong>Ubicazione chiavi:</strong> ${format(schedaCorrente.ubicazione_chiavi)}</div>
                <div><strong>Referente:</strong> ${format(schedaCorrente.referente)}</div>
                <div><strong>Telefono:</strong> ${format(schedaCorrente.telefono_referente)}</div>
            </div>
            
            <!-- ENTI NOTIFICATI -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">account_balance</span> Enti Notificati
                </h4>
                <div><strong>Ente:</strong> ${format(schedaCorrente.ente)}</div>
                <div><strong>Ultima verifica:</strong> ${schedaCorrente.ultima_verifica ? new Date(schedaCorrente.ultima_verifica).toLocaleDateString('it-IT') : '-'}</div>
            </div>
            
            <!-- NOTE GENERALI -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">notes</span> Note Generali
                </h4>
                <div style="white-space: pre-wrap;">${format(schedaCorrente.note_generali)}</div>
            </div>
            
            <!-- METADATI -->
            <div style="background: #f1f5f9; border-radius: 12px; padding: 1rem; font-size: 0.8rem; color: #64748b;">
                <div><strong>Creato il:</strong> ${schedaCorrente.creato_il ? new Date(schedaCorrente.creato_il).toLocaleString('it-IT') : '-'}</div>
                <div><strong>Creato da:</strong> ${format(schedaCorrente.creato_da)}</div>
                <div><strong>Ultima modifica:</strong> ${schedaCorrente.aggiornato_il ? new Date(schedaCorrente.aggiornato_il).toLocaleString('it-IT') : '-'}</div>
                <div><strong>Modificato da:</strong> ${format(schedaCorrente.aggiornato_da)}</div>
            </div>
            
            <!-- FOTO -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">photo_camera</span> Foto (${fotoCorrente.length})
                </h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
    `;
    
    // Aggiungi foto
    if (fotoCorrente.length > 0) {
        fotoCorrente.forEach((url, index) => {
            html += `
                <div style="aspect-ratio: 1; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid var(--border);" onclick="apriFotoFullscreen(${index})">
                    <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
            `;
        });
    } else {
        html += `<div style="grid-column: span 3; text-align: center; padding: 2rem; color: var(--text-muted);">Nessuna foto disponibile</div>`;
    }
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('dettaglio-scheda-content').innerHTML = html;
    document.getElementById('modal-dettaglio-scheda-admin').style.display = 'flex';
}

// FUNZIONI PER IL VISUALIZZATORE FOTO
function apriFotoFullscreen(index) {
    fotoIndex = index;
    aggiornaFotoFullscreen();
    document.getElementById('modal-foto-fullscreen').style.display = 'flex';
}

function aggiornaFotoFullscreen() {
    const img = document.getElementById('foto-fullscreen-img');
    const counter = document.getElementById('foto-counter');
    
    img.src = fotoCorrente[fotoIndex];
    counter.textContent = `${fotoIndex + 1} / ${fotoCorrente.length}`;
}

function fotoPrecedente() {
    if (fotoIndex > 0) {
        fotoIndex--;
        aggiornaFotoFullscreen();
    }
}

function fotoSuccessiva() {
    if (fotoIndex < fotoCorrente.length - 1) {
        fotoIndex++;
        aggiornaFotoFullscreen();
    }
}

function chiudiFotoFullscreen() {
    document.getElementById('modal-foto-fullscreen').style.display = 'none';
}

function modificaSchedaCorrente() {
    if (!schedaCorrente) return;
    window.open(`modifica_tecnico_impianto.html?id=${schedaCorrente.impianto_id}`, '_blank');
    chiudiModaleScheda();
}

function chiudiModaleScheda() {
    document.getElementById('modal-dettaglio-scheda-admin').style.display = 'none';
}

// FUNZIONI DI SUPPORTO
function mostraFiltriSchede() {
    const filtri = document.getElementById('filtri-schede');
    filtri.style.display = filtri.style.display === 'none' ? 'block' : 'none';
}

function resetFiltriSchede() {
    document.getElementById('filtro-impianto-scheda').value = '';
    document.getElementById('filtro-costruttore').value = '';
    document.getElementById('filtro-tipo-impianto').value = '';
    document.getElementById('filtro-anno').value = '';
    caricaSchedeTecniche();
}

function applicaFiltriSchede() {
    // Logica filtri (opzionale)
    caricaSchedeTecniche();
}

function modificaScheda(id) {
    const scheda = schedeList.find(s => s.id == id);
    if (!scheda) return;
    window.open(`modifica_tecnico_impianto.html?id=${scheda.impianto_id}`, '_blank');
}

function modificaSchedaCorrente() {
    if (!schedaCorrente) return;
    window.open(`modifica_tecnico_impianto.html?id=${schedaCorrente.impianto_id}`, '_blank');
    chiudiModaleScheda();
}

async function eliminaScheda(id) {
    if (!confirm('Eliminare definitivamente questa scheda tecnica?')) return;
    
    try {
        const supabase = getSupabaseClient();
        const { error } = await supabase
            .from('dettaglio_tecnico_impianto')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        mostraNotifica('Scheda eliminata', 'successo');
        caricaSchedeTecniche();
        
    } catch (error) {
        console.error('Errore eliminazione:', error);
        mostraNotifica('Errore', 'errore');
    }
}

function selezionaTutteSchede() {
    const tutte = document.getElementById('select-all-schede').checked;
    document.querySelectorAll('.select-scheda').forEach(cb => cb.checked = tutte);
}

function esportaSchedeCSV() {
    // Funzione per esportare tutte le schede in CSV
    alert('Esportazione CSV in sviluppo');
}

function esportaSchedeSelezionate() {
    // Funzione per esportare solo quelle selezionate
    alert('Esportazione selezionate in sviluppo');
}

function eliminaSchedeSelezionate() {
    // Funzione per eliminare multiple
    alert('Eliminazione multipla in sviluppo');
}

function chiudiModaleScheda() {
    document.getElementById('modal-dettaglio-scheda-admin').style.display = 'none';
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    // Carica dati se il tab è attivo
    if (document.getElementById('tab-schede_tecniche')?.classList.contains('active')) {
        caricaSchedeTecniche();
    }
});