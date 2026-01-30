// ================================
// FUNZIONI PER LA PAGINA LISTA SPESE
// ================================

// NOTA: chartInstance e tutteSpese sono dichiarati nell'HTML

// CARICA DATI E FILTRI
async function caricaDati() {
    try {
        mostraLoading();
        
        const supabase = getSupabaseClient();
        if (!supabase) {
            throw new Error('Database non configurato');
        }

        const tecnico = localStorage.getItem('tecnico_loggato');
        if (!tecnico) {
            throw new Error('Nessun tecnico loggato');
        }

        // ✅ USARE I NOMI CORRETTI DELLE COLONNE DAL DATABASE
        let query = supabase
            .from('note_spese')
            .select('*')
            .eq('tecnico', tecnico)
            .order('data', { ascending: false }); // Usa 'data' non 'data_spesa'

        const filtroAnno = document.getElementById('filtro-anno').value;
        const filtroMese = document.getElementById('filtro-mese').value;
        const filtroTipo = document.getElementById('filtro-tipo').value;
        const filtroLocalita = document.getElementById('filtro-localita').value;

        if (filtroAnno) {
            query = query.gte('data', `${filtroAnno}-01-01`)
                         .lte('data', `${filtroAnno}-12-31`);
        }

        if (filtroMese && filtroAnno) {
            const meseFormattato = filtroMese.padStart(2, '0');
            query = query.gte('data', `${filtroAnno}-${meseFormattato}-01`)
                         .lte('data', `${filtroAnno}-${meseFormattato}-31`);
        }

        if (filtroTipo) {
            if (filtroTipo === 'vitto') {
                // ✅ CORREGGERE I NOMI DELLE COLONNE
                query = query.or('pasti.gt.0,pernottamenti.gt.0,mezzi_trasp.gt.0,altre_spese.gt.0');
            } else if (filtroTipo === 'auto') {
                query = query.or('km_auto_propria.gt.0,ped_autostrad.gt.0,parcheggi.gt.0,lavaggio.gt.0,carbur_lubrif.gt.0');
            }
        }

        if (filtroLocalita) {
            if (filtroLocalita === 'In Sede') {
                // Verifica se esiste la colonna 'fuori_sede' o usa 'localita'
                query = query.eq('localita', 'In Sede');
            } else if (filtroLocalita === 'Fuori Sede') {
                query = query.neq('localita', 'In Sede');
            }
        }

        const { data: spese, error } = await query;

        if (error) throw error;

        tutteSpese = spese || [];
        
        // Aggiorna UI
        aggiornaStatistiche(tutteSpese);
        aggiornaGrafico(tutteSpese);
        renderListaSpese(tutteSpese);
        
        nascondiLoading();
        
    } catch (error) {
        console.error('Errore caricamento spese:', error);
        mostraNotifica('error', 'Errore nel caricamento delle spese');
        nascondiLoading();
    }
}

// AGGIORNA STATISTICHE
function aggiornaStatistiche(spese) {
    let totale = 0;
    let totaleVitto = 0;
    let totaleAuto = 0;
    let numeroSpese = spese.length;
    let numeroVitto = 0;
    let numeroAuto = 0;
    
    // Calcola giorni lavorativi unici
    const giorniUnici = new Set();
    
    spese.forEach(spesa => {
        // ✅ GESTIRE DATI MANCANTI O NULL
        if (!spesa.data) {
            console.warn('Data mancante per spesa:', spesa.id);
            return; // Salta questa spesa
        }
        
        try {
            const data = new Date(spesa.data);
            if (isNaN(data.getTime())) {
                console.warn('Data non valida per spesa:', spesa.id, spesa.data);
                return; // Salta questa spesa
            }
            
            const giornoKey = data.toISOString().split('T')[0];
            giorniUnici.add(giornoKey);
            
            // ✅ USARE I NOMI CORRETTI DELLE COLONNE
            const vitto = (parseFloat(spesa.pasti) || 0) + 
                         (parseFloat(spesa.pernottamenti) || 0) +
                         (parseFloat(spesa.mezzi_trasp) || 0) + // Nota: mezzi_trasp non mezzi_trasporto
                         (parseFloat(spesa.altre_spese) || 0);
            
            const auto = (parseFloat(spesa.km_auto_propria) || 0) + // Nota: km_auto_propria non km_auto
                        (parseFloat(spesa.ped_autostrad) || 0) +   // Nota: ped_autostrad non pedaggi
                        (parseFloat(spesa.parcheggi) || 0) +
                        (parseFloat(spesa.lavaggio) || 0) +
                        (parseFloat(spesa.carbur_lubrif) || 0); // Nota: carbur_lubrif non carburante
            
            totaleVitto += vitto;
            totaleAuto += auto;
            totale += vitto + auto;
            
            if (vitto > 0) numeroVitto++;
            if (auto > 0) numeroAuto++;
            
        } catch (error) {
            console.error('Errore elaborazione spesa:', spesa.id, error);
        }
    });
    
    const giorniLavorativi = giorniUnici.size;
    const mediaGiornaliera = giorniLavorativi > 0 ? totale / giorniLavorativi : 0;
    
    // Aggiorna elementi
    aggiornaElementoSeEsiste('stat-totale', formattaEuro(totale));
    aggiornaElementoSeEsiste('stat-totale-mobile', formattaEuro(totale));
    aggiornaElementoSeEsiste('stat-numero-spese', `${numeroSpese} spese`);
    
    aggiornaElementoSeEsiste('stat-vitto', formattaEuro(totaleVitto));
    aggiornaElementoSeEsiste('stat-dettaglio-vitto', `${numeroVitto} spese vitto`);
    
    aggiornaElementoSeEsiste('stat-auto', formattaEuro(totaleAuto));
    aggiornaElementoSeEsiste('stat-dettaglio-auto', `${numeroAuto} spese auto`);
    
    aggiornaElementoSeEsiste('stat-media', formattaEuro(mediaGiornaliera));
    aggiornaElementoSeEsiste('stat-giorni', `${giorniLavorativi} giorni lavorativi`);
    
    aggiornaElementoSeEsiste('counter-spese', `${numeroSpese} spese`);
    
    // Aggiorna statistiche mobile
    if (typeof renderStatsMobile === 'function') {
        renderStatsMobile({
            totale,
            numero_spese: numeroSpese,
            totale_vitto: totaleVitto,
            numero_vitto: numeroVitto,
            totale_auto: totaleAuto,
            numero_auto: numeroAuto,
            media_giornaliera: mediaGiornaliera,
            giorni_lavorativi: giorniLavorativi
        });
    }
}

// FUNZIONE AUSILIARIA: aggiorna solo se l'elemento esiste
function aggiornaElementoSeEsiste(id, valore) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = valore;
    }
}

// RENDER LISTA SPESE (adattato per entrambe le visualizzazioni)
function renderListaSpese(spese) {
    // Render card per mobile (sempre)
    if (typeof renderCardSpese === 'function') {
        renderCardSpese(spese);
    }
    
    // Se esiste ancora la tabella desktop (per compatibilità)
    const tabellaBody = document.getElementById('tabellaBodyDesktop');
    if (tabellaBody && typeof renderTabellaDesktop === 'function') {
        renderTabellaDesktop(spese);
    }
    
    // Mostra/nascondi stato vuoto
    const statoVuoto = document.getElementById('statoVuoto');
    const containerCard = document.getElementById('containerCardSpese');
    
    if (spese.length === 0) {
        if (statoVuoto) statoVuoto.style.display = 'block';
        if (containerCard) containerCard.innerHTML = '';
    } else {
        if (statoVuoto) statoVuoto.style.display = 'none';
    }
}

// RENDER CARD SPESE (versione aggiornata)
function renderCardSpese(spese) {
    const container = document.getElementById('containerCardSpese');
    const statoVuoto = document.getElementById('statoVuoto');
    
    container.innerHTML = '';
    
    if (spese.length === 0) {
        if (statoVuoto) statoVuoto.style.display = 'block';
        return;
    }
    
    if (statoVuoto) statoVuoto.style.display = 'none';
    
    spese.forEach(spesa => {
        const card = document.createElement('div');
        card.className = 'spesa-card';
        
        // Usa i totali già calcolati dal database
        const totaleVitto = parseFloat(spesa.totale_vitto) || 0;
        const totaleAuto = parseFloat(spesa.totale_auto) || 0;
        const totale = parseFloat(spesa.totale_generale) || 0;
        
        // Gestisci array foto
        const fotoUrls = spesa.foto_url || [];
        const hasFoto = Array.isArray(fotoUrls) ? fotoUrls.length > 0 : false;
        const fotoUrlsArray = Array.isArray(fotoUrls) ? fotoUrls : (fotoUrls ? [fotoUrls] : []);
        
        card.innerHTML = `
            <div class="spesa-header">
                <div>
                    <div class="spesa-data">${formattaData(spesa.data)}</div>
                    <span class="spesa-localita">${spesa.localita || 'In Sede'}</span>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted);">
                    ${spesa.tecnico || ''}
                </div>
            </div>
            
            <div class="spesa-dettagli">
                <div class="dettaglio-item">
                    <span class="dettaglio-label">Vitto/Trasporto</span>
                    <span class="dettaglio-valore">${formattaEuro(totaleVitto)}</span>
                </div>
                <div class="dettaglio-item">
                    <span class="dettaglio-label">Spese Auto</span>
                    <span class="dettaglio-valore">${formattaEuro(totaleAuto)}</span>
                </div>
                <div class="dettaglio-item" style="grid-column: 1 / -1;">
                    <span class="dettaglio-label">TOTALE</span>
                    <span class="dettaglio-valore" style="color: var(--primary); font-size: 1.1rem;">
                        ${formattaEuro(totale)}
                    </span>
                </div>
            </div>
            
            ${spesa.note ? `
            <div class="spesa-note">
                <strong>Note:</strong> ${spesa.note}
            </div>
            ` : ''}
            
            <div class="spesa-footer">
                <div class="icona-foto-container">
                    ${hasFoto ? `
                    <button class="btn-foto" onclick="apriPopupFoto(${JSON.stringify(fotoUrlsArray).replace(/"/g, '&quot;')})">
                        <span class="material-symbols-rounded">photo_camera</span>
                        Foto
                        ${fotoUrlsArray.length > 1 ? `<span class="contatore-foto">${fotoUrlsArray.length}</span>` : ''}
                    </button>
                    ` : ''}
                </div>
                <div class="spesa-azioni">
                    <button class="btn-icon-mobile elimina" onclick="eliminaSpesa('${spesa.id}')" title="Elimina spesa">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}


// FUNZIONI PER IL POPUP FOTO (aggiunte nuove)
function apriPopupFoto(urls) {
    if (!urls || urls.length === 0) return;
    
    // Se urls è una stringa, converti in array
    const fotoUrls = Array.isArray(urls) ? urls : [urls];
    if (fotoUrls.length === 0) return;
    
    // Salva nelle variabili globali (dichiarate nell'HTML)
    window.fotoUrls = fotoUrls;
    window.fotoCorrente = 0;
    
    // Trova gli elementi del popup
    const popup = document.getElementById('popupFoto');
    const img = document.getElementById('popupFotoImg');
    const contatore = document.getElementById('popupContatore');
    
    if (!popup || !img || !contatore) {
        console.error('Elementi popup non trovati');
        return;
    }
    
    // Carica la prima immagine
    img.src = fotoUrls[0];
    contatore.textContent = `1/${fotoUrls.length}`;
    
    // Mostra popup
    popup.style.display = 'flex';
    document.body.classList.add('body-no-scroll');
}

// Queste funzioni sono richiamate dall'HTML
function fotoPrecedente() {
    if (!window.fotoUrls || window.fotoUrls.length <= 1) return;
    
    window.fotoCorrente = (window.fotoCorrente - 1 + window.fotoUrls.length) % window.fotoUrls.length;
    aggiornaPopupFoto();
}

function fotoSuccessiva() {
    if (!window.fotoUrls || window.fotoUrls.length <= 1) return;
    
    window.fotoCorrente = (window.fotoCorrente + 1) % window.fotoUrls.length;
    aggiornaPopupFoto();
}

function aggiornaPopupFoto() {
    const img = document.getElementById('popupFotoImg');
    const contatore = document.getElementById('popupContatore');
    
    if (img && contatore && window.fotoUrls && window.fotoUrls[window.fotoCorrente]) {
        img.src = window.fotoUrls[window.fotoCorrente];
        contatore.textContent = `${window.fotoCorrente + 1}/${window.fotoUrls.length}`;
    }
}

function chiudiPopupFoto() {
    const popup = document.getElementById('popupFoto');
    if (popup) {
        popup.style.display = 'none';
        document.body.classList.remove('body-no-scroll');
        window.fotoUrls = [];
        window.fotoCorrente = 0;
    }
}

// RENDER TABELLA DESKTOP
function renderTabellaDesktop(spese) {
    const tbody = document.getElementById('tabellaBodyDesktop');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    spese.forEach(spesa => {
        const totaleVitto = parseFloat(spesa.totale_vitto) || 0;
        const totaleAuto = parseFloat(spesa.totale_auto) || 0;
        const totale = parseFloat(spesa.totale_generale) || 0;
        
        const dataSpesa = spesa.data ? formattaData(spesa.data) : 'Data non valida';
        const localita = spesa.localita || 'In Sede';
        const fotoUrls = spesa.foto_url || [];
        const hasFoto = Array.isArray(fotoUrls) ? fotoUrls.length > 0 : false;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 0.875rem 1rem;">${dataSpesa}</td>
            <td style="padding: 0.875rem 1rem;">${localita}</td>
            <td style="padding: 0.875rem 1rem;">
                <span class="badge-tipo ${totaleVitto > totaleAuto ? 'badge-vitto' : 'badge-auto'}" 
                      style="display: inline-block; padding: 0.25rem 0.5rem; font-size: 0.7rem;">
                    ${totaleVitto > totaleAuto ? 'Vitto' : 'Auto'}
                </span>
            </td>
            <td style="padding: 0.875rem 1rem;">${formattaEuro(totaleVitto)}</td>
            <td style="padding: 0.875rem 1rem;">${formattaEuro(totaleAuto)}</td>
            <td style="padding: 0.875rem 1rem; font-weight: 800; color: var(--primary);">
                ${formattaEuro(totale)}
            </td>
            <td style="padding: 0.875rem 1rem;">
                ${hasFoto ? 
                    `<div class="foto-thumb" onclick="apriPopupFoto(${JSON.stringify(fotoUrls).replace(/"/g, '&quot;')})" style="width: 32px; height: 32px; border-radius: 6px; overflow: hidden; cursor: pointer;">
                        <img src="${fotoUrls[0]}" alt="Ricevuta" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>` 
                    : 'No foto'}
            </td>
            <td style="padding: 0.875rem 1rem;">
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-icon-mobile elimina" onclick="eliminaSpesa('${spesa.id}')" 
                            style="background: #fee2e2; color: #ef4444;">
                        <span class="material-symbols-rounded" style="font-size: 1rem;">delete</span>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// AGGIORNA GRAFICO
function aggiornaGrafico(spese) {
    const ctx = document.getElementById('graficoSpese');
    if (!ctx) return;
    
    // Calcola dati per grafico
    const datiMensili = {};
    const tipi = ['Vitto/Trasporto', 'Auto'];
    const colori = ['#22c55e', '#ef4444'];
    
    spese.forEach(spesa => {
        if (!spesa.data) return;
        
        try {
            const data = new Date(spesa.data);
            if (isNaN(data.getTime())) return;
            
            const meseAnno = `${data.getFullYear()}-${(data.getMonth() + 1).toString().padStart(2, '0')}`;
            
            if (!datiMensili[meseAnno]) {
                datiMensili[meseAnno] = [0, 0];
            }
            
            // ✅ USARE I NOMI CORRETTI DELLE COLONNE
            const vitto = (parseFloat(spesa.pasti) || 0) + 
                         (parseFloat(spesa.pernottamenti) || 0) +
                         (parseFloat(spesa.mezzi_trasp) || 0) +
                         (parseFloat(spesa.altre_spese) || 0);
            
            const auto = (parseFloat(spesa.km_auto_propria) || 0) +
                        (parseFloat(spesa.ped_autostrad) || 0) +
                        (parseFloat(spesa.parcheggi) || 0) +
                        (parseFloat(spesa.lavaggio) || 0) +
                        (parseFloat(spesa.carbur_lubrif) || 0);
            
            datiMensili[meseAnno][0] += vitto;
            datiMensili[meseAnno][1] += auto;
            
        } catch (error) {
            console.error('Errore elaborazione dati grafico:', error);
        }
    });
    
    // Ordina per data
    const mesiOrdinati = Object.keys(datiMensili).sort();
    const labels = mesiOrdinati.map(mese => {
        const [anno, meseNum] = mese.split('-');
        const nomiMesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        return `${nomiMesi[parseInt(meseNum) - 1]} ${anno}`;
    });
    
    const datasets = tipi.map((tipo, index) => ({
        label: tipo,
        data: mesiOrdinati.map(mese => datiMensili[mese][index]),
        backgroundColor: colori[index] + '80',
        borderColor: colori[index],
        borderWidth: 2,
        borderRadius: 6
    }));
    
    // Distruggi grafico esistente
    if (window.chartInstance) {
        window.chartInstance.destroy();
    }
    
    // Crea nuovo grafico
    window.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            family: 'Inter',
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formattaEuro(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '€' + value.toFixed(0);
                        },
                        font: {
                            family: 'Inter',
                            size: 11,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Inter',
                            size: 11,
                            weight: '600'
                        }
                    }
                }
            }
        }
    });
}

// ELIMINA SPESA
async function eliminaSpesa(id) {
    if (!confirm('Sei sicuro di voler eliminare questa spesa?')) return;
    
    try {
        mostraLoading();
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Database non configurato');
        
        // Prima elimina le foto dallo storage (se esiste)
        const { data: spesa } = await supabase
            .from('note_spese')
            .select('foto_url')
            .eq('id', id)
            .single();
        
        if (spesa && spesa.foto_url) {
            try {
                const path = spesa.foto_url.split('/').pop();
                await supabase.storage
                    .from('ricevute_spese')
                    .remove([path]);
            } catch (storageError) {
                console.warn('Errore eliminazione foto:', storageError);
                // Continua comunque con l'eliminazione della spesa
            }
        }
        
        // Poi elimina la spesa dal database
        const { error } = await supabase
            .from('note_spese')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        // Ricarica dati
        await caricaDati();
        mostraNotifica('success', 'Spesa eliminata con successo');
        
    } catch (error) {
        console.error('Errore eliminazione spesa:', error);
        mostraNotifica('error', 'Errore nell\'eliminazione della spesa');
    } finally {
        nascondiLoading();
    }
}

// ESPORTA PDF (aggiornata per le nuove colonne)
async function esportaPDF() {
    try {
        mostraLoading();
        
        if (tutteSpese.length === 0) {
            mostraNotifica('warning', 'Nessuna spesa da esportare');
            nascondiLoading();
            return;
        }
        
        const tecnico = localStorage.getItem('tecnico_loggato') || 'Tecnico';
        const filtroAnno = document.getElementById('filtro-anno').value;
        const filtroMese = document.getElementById('filtro-mese').value;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Titolo
        doc.setFontSize(20);
        doc.setTextColor(37, 99, 235);
        doc.text('Report Spese - ParkApp', 20, 20);
        
        // Dati tecnico e periodo
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Tecnico: ${tecnico}`, 20, 35);
        
        let periodo = 'Tutto il periodo';
        if (filtroAnno) {
            periodo = filtroMese ? `Mese ${filtroMese}/${filtroAnno}` : `Anno ${filtroAnno}`;
        }
        doc.text(`Periodo: ${periodo}`, 20, 42);
        
        // Statistiche
        let totale = 0;
        let totaleVitto = 0;
        let totaleAuto = 0;
        
        tutteSpese.forEach(spesa => {
            const vitto = (parseFloat(spesa.pasti) || 0) + 
                         (parseFloat(spesa.pernottamenti) || 0) +
                         (parseFloat(spesa.mezzi_trasp) || 0) +
                         (parseFloat(spesa.altre_spese) || 0);
            
            const auto = (parseFloat(spesa.km_auto_propria) || 0) +
                        (parseFloat(spesa.ped_autostrad) || 0) +
                        (parseFloat(spesa.parcheggi) || 0) +
                        (parseFloat(spesa.lavaggio) || 0) +
                        (parseFloat(spesa.carbur_lubrif) || 0);
            
            totaleVitto += vitto;
            totaleAuto += auto;
            totale += vitto + auto;
        });
        
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Statistiche:', 20, 55);
        
        doc.setFontSize(11);
        doc.text(`Totale Spese: ${formattaEuro(totale)}`, 30, 65);
        doc.text(`Vitto/Trasporto: ${formattaEuro(totaleVitto)}`, 30, 72);
        doc.text(`Spese Auto: ${formattaEuro(totaleAuto)}`, 30, 79);
        doc.text(`Numero spese: ${tutteSpese.length}`, 30, 86);
        
        // Tabella spese
        let yPos = 100;
        
        if (tutteSpese.length > 0) {
            doc.setFontSize(12);
            doc.text('Elenco Dettagliato:', 20, yPos);
            yPos += 10;
            
            // Intestazione tabella
            doc.setFillColor(37, 99, 235);
            doc.setTextColor(255, 255, 255);
            doc.rect(20, yPos, 170, 8, 'F');
            
            doc.setFontSize(10);
            doc.text('Data', 22, yPos + 6);
            doc.text('Località', 45, yPos + 6);
            doc.text('Tipo', 80, yPos + 6);
            doc.text('Vitto', 100, yPos + 6);
            doc.text('Auto', 125, yPos + 6);
            doc.text('Totale', 150, yPos + 6);
            
            yPos += 10;
            
            // Dati tabella
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            
            tutteSpese.forEach((spesa, index) => {
                if (yPos > 280) {
                    doc.addPage();
                    yPos = 20;
                }
                
                const vitto = (parseFloat(spesa.pasti) || 0) + 
                             (parseFloat(spesa.pernottamenti) || 0) +
                             (parseFloat(spesa.mezzi_trasp) || 0) +
                             (parseFloat(spesa.altre_spese) || 0);
                
                const auto = (parseFloat(spesa.km_auto_propria) || 0) +
                            (parseFloat(spesa.ped_autostrad) || 0) +
                            (parseFloat(spesa.parcheggi) || 0) +
                            (parseFloat(spesa.lavaggio) || 0) +
                            (parseFloat(spesa.carbur_lubrif) || 0);
                
                const totaleSpesa = vitto + auto;
                const tipo = vitto > auto ? 'Vitto' : 'Auto';
                const localita = spesa.localita || 'In Sede';
                const data = spesa.data ? formattaData(spesa.data) : 'Data non valida';
                
                doc.text(data, 22, yPos);
                doc.text(localita, 45, yPos);
                doc.text(tipo, 80, yPos);
                doc.text(formattaEuro(vitto), 100, yPos);
                doc.text(formattaEuro(auto), 125, yPos);
                doc.text(formattaEuro(totaleSpesa), 150, yPos);
                
                yPos += 7;
                
                // Alterna colore righe
                if (index % 2 === 0) {
                    doc.setFillColor(240, 240, 240);
                    doc.rect(20, yPos - 7, 170, 7, 'F');
                }
            });
        }
        
        // Data generazione
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const dataGenerazione = new Date().toLocaleDateString('it-IT');
        doc.text(`Generato il: ${dataGenerazione}`, 20, 290);
        
        // Salva PDF
        const nomeFile = `spese_${tecnico.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(nomeFile);
        
        mostraNotifica('success', 'PDF esportato con successo');
        nascondiLoading();
        
    } catch (error) {
        console.error('Errore esportazione PDF:', error);
        mostraNotifica('error', 'Errore nell\'esportazione PDF');
        nascondiLoading();
    }
}

// ESPORTA EXCEL (aggiornata per le nuove colonne)
async function esportaExcel() {
    try {
        mostraLoading();
        
        if (tutteSpese.length === 0) {
            mostraNotifica('warning', 'Nessuna spesa da esportare');
            nascondiLoading();
            return;
        }
        
        // Prepara dati
        const datiExcel = tutteSpese.map(spesa => {
            const vitto = (parseFloat(spesa.pasti) || 0) + 
                         (parseFloat(spesa.pernottamenti) || 0) +
                         (parseFloat(spesa.mezzi_trasp) || 0) +
                         (parseFloat(spesa.altre_spese) || 0);
            
            const auto = (parseFloat(spesa.km_auto_propria) || 0) +
                        (parseFloat(spesa.ped_autostrad) || 0) +
                        (parseFloat(spesa.parcheggi) || 0) +
                        (parseFloat(spesa.lavaggio) || 0) +
                        (parseFloat(spesa.carbur_lubrif) || 0);
            
            return {
                'Data': spesa.data ? formattaData(spesa.data) : '',
                'Località': spesa.localita || 'In Sede',
                'Pasti (€)': parseFloat(spesa.pasti) || 0,
                'Pernottamenti (€)': parseFloat(spesa.pernottamenti) || 0,
                'Trasporto (€)': parseFloat(spesa.mezzi_trasp) || 0,
                'Altre Spese (€)': parseFloat(spesa.altre_spese) || 0,
                'KM Auto (€)': parseFloat(spesa.km_auto_propria) || 0,
                'Pedaggi (€)': parseFloat(spesa.ped_autostrad) || 0,
                'Parcheggi (€)': parseFloat(spesa.parcheggi) || 0,
                'Lavaggio (€)': parseFloat(spesa.lavaggio) || 0,
                'Carburante (€)': parseFloat(spesa.carbur_lubrif) || 0,
                'Totale Vitto/Trasporto (€)': vitto,
                'Totale Auto (€)': auto,
                'TOTALE (€)': vitto + auto,
                'Note': spesa.note || ''
            };
        });
        
        // Crea workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datiExcel);
        
        // Stile larghezza colonne
        const wscols = [
            { wch: 12 }, // Data
            { wch: 15 }, // Località
            { wch: 10 }, // Pasti
            { wch: 12 }, // Pernottamenti
            { wch: 10 }, // Trasporto
            { wch: 12 }, // Altre Spese
            { wch: 10 }, // KM Auto
            { wch: 10 }, // Pedaggi
            { wch: 10 }, // Parcheggi
            { wch: 10 }, // Lavaggio
            { wch: 12 }, // Carburante
            { wch: 15 }, // Totale Vitto
            { wch: 12 }, // Totale Auto
            { wch: 12 }, // TOTALE
            { wch: 25 }  // Note
        ];
        ws['!cols'] = wscols;
        
        // Aggiungi foglio
        XLSX.utils.book_append_sheet(wb, ws, 'Spese');
        
        // Salva file
        const tecnico = localStorage.getItem('tecnico_loggato') || 'Tecnico';
        const nomeFile = `spese_${tecnico.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, nomeFile);
        
        mostraNotifica('success', 'Excel esportato con successo');
        nascondiLoading();
        
    } catch (error) {
        console.error('Errore esportazione Excel:', error);
        mostraNotifica('error', 'Errore nell\'esportazione Excel');
        nascondiLoading();
    }
}

// FUNZIONI UTILITY
function formattaData(dataString) {
    if (!dataString) return 'Data non valida';
    
    try {
        const data = new Date(dataString);
        if (isNaN(data.getTime())) return 'Data non valida';
        
        return data.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        console.error('Errore formattazione data:', dataString, error);
        return 'Data non valida';
    }
}

function formattaEuro(valore) {
    return '€' + parseFloat(valore).toFixed(2);
}

function mostraLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) loading.style.display = 'flex';
}

function nascondiLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) loading.style.display = 'none';
}

function mostraNotifica(tipo, messaggio) {
    let container = document.getElementById('notifiche-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notifiche-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 90%;
            width: 400px;
        `;
        document.body.appendChild(container);
    }
    
    const notifica = document.createElement('div');
    notifica.style.cssText = `
        background: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        border-left: 4px solid;
        animation: slideDown 0.3s ease-out;
    `;
    
    let colore = '#2563eb';
    let icona = 'info';
    
    switch (tipo) {
        case 'success':
            colore = '#22c55e';
            icona = 'check_circle';
            break;
        case 'error':
            colore = '#ef4444';
            icona = 'error';
            break;
        case 'warning':
            colore = '#f59e0b';
            icona = 'warning';
            break;
    }
    
    notifica.style.borderLeftColor = colore;
    
    notifica.innerHTML = `
        <span class="material-symbols-rounded" style="color: ${colore};">${icona}</span>
        <span style="flex: 1; font-weight: 600; color: #1e293b;">${messaggio}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: #64748b; cursor: pointer;">
            <span class="material-symbols-rounded">close</span>
        </button>
    `;
    
    container.insertBefore(notifica, container.firstChild);
    
    setTimeout(() => {
        if (notifica.parentElement) {
            notifica.remove();
        }
    }, 5000);
}

// RESET FILTRI
function resetFiltri() {
    document.getElementById('filtro-anno').value = new Date().getFullYear();
    document.getElementById('filtro-mese').value = '';
    document.getElementById('filtro-tipo').value = '';
    document.getElementById('filtro-localita').value = '';
    caricaDati();
}

// APRI MODALE FOTO (per compatibilità con le funzioni nell'HTML)
function apriModaleFoto(fotoUrls, titolo) {
    // Se siamo in modalità mobile, usa la funzione mobile
    if (window.innerWidth < 768 && typeof apriModalFotoMobile === 'function') {
        apriModalFotoMobile(fotoUrls, titolo);
        return;
    }
    
    // Altrimenti implementazione di fallback
    if (fotoUrls && fotoUrls.length > 0) {
        window.open(fotoUrls[0], '_blank');
    }
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    const tecnico = localStorage.getItem('tecnico_loggato');
    const nomeTecnico = document.getElementById('tecnico-nome');
    if (nomeTecnico && tecnico) {
        nomeTecnico.textContent = tecnico;
    }
});