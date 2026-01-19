// lista_spese.js
const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Carica dati spese
async function caricaDati() {
    mostraLoading();
    
    try {
        const tecnico = localStorage.getItem('tecnico_loggato');
        if (!tecnico) {
            window.location.href = 'index.html';
            return;
        }
        
        // Costruisci query con filtri
        let query = supabaseClient
            .from('note_spese')
            .select('*')
            .eq('tecnico', tecnico)
            .order('data', { ascending: false });
        
        // Applica filtri
        const anno = document.getElementById('filtro-anno').value;
        const mese = document.getElementById('filtro-mese').value;
        const tipo = document.getElementById('filtro-tipo').value;
        const localita = document.getElementById('filtro-localita').value;
        
        if (anno) query = query.eq('anno', parseInt(anno));
        if (mese) query = query.eq('mese', parseInt(mese));
        if (localita) query = query.eq('localita', localita);
        
        const { data: spese, error } = await query;
        
        if (error) throw error;
        
        tutteSpese = spese || [];
        
        // Aggiorna interfaccia
        aggiornaStatistiche(spese);
        aggiornaTabella(spese);
        aggiornaGrafico(spese);
        
    } catch (error) {
        console.error('Errore caricamento spese:', error);
        alert('Errore durante il caricamento delle spese: ' + error.message);
    } finally {
        nascondiLoading();
    }
}

// Aggiorna statistiche
function aggiornaStatistiche(spese) {
    if (!spese || spese.length === 0) {
        document.getElementById('stat-totale').textContent = '€0.00';
        document.getElementById('stat-vitto').textContent = '€0.00';
        document.getElementById('stat-auto').textContent = '€0.00';
        document.getElementById('stat-media').textContent = '€0.00';
        document.getElementById('stat-numero-spese').textContent = '0 spese';
        document.getElementById('stat-dettaglio-vitto').textContent = '0 pasti • 0 pernottamenti';
        document.getElementById('stat-dettaglio-auto').textContent = '0 km • €0 carburante';
        document.getElementById('stat-giorni').textContent = '0 giorni lavorativi';
        return;
    }
    
    // Calcola totali
    let totaleGenerale = 0;
    let totaleVitto = 0;
    let totaleAuto = 0;
    let totalePasti = 0;
    let totalePernottamenti = 0;
    let totaleKm = 0;
    let totaleCarburante = 0;
    let giorniUnici = new Set();
    
    spese.forEach(spesa => {
        totaleGenerale += parseFloat(spesa.totale_generale) || 0;
totaleVitto += parseFloat(spesa.totale_vitto) || 0;
totaleAuto += parseFloat(spesa.totale_auto) || 0;
        totalePasti += parseFloat(spesa.pasti) || 0;
        totalePernottamenti += parseFloat(spesa.pernottamenti) || 0;
        totaleKm += parseFloat(spesa.km_auto_propria) || 0;
        totaleCarburante += parseFloat(spesa.carbur_lubrif) || 0;
        giorniUnici.add(spesa.data);
    });
    
    // Calcola media giornaliera
    const mediaGiornaliera = giorniUnici.size > 0 ? totaleGenerale / giorniUnici.size : 0;
    
    // Aggiorna UI
    document.getElementById('stat-totale').textContent = formattaEuro(totaleGenerale);
    document.getElementById('stat-vitto').textContent = formattaEuro(totaleVitto);
    document.getElementById('stat-auto').textContent = formattaEuro(totaleAuto);
    document.getElementById('stat-media').textContent = formattaEuro(mediaGiornaliera);
    
    document.getElementById('stat-numero-spese').textContent = `${spese.length} spese`;
    document.getElementById('stat-dettaglio-vitto').textContent = 
        `${totalePasti} pasti • ${totalePernottamenti} pernottamenti`;
    document.getElementById('stat-dettaglio-auto').textContent = 
        `${totaleKm} km • ${formattaEuro(totaleCarburante)} carburante`;
    document.getElementById('stat-giorni').textContent = `${giorniUnici.size} giorni lavorativi`;
}

// Aggiorna tabella
function aggiornaTabella(spese) {
    const tbody = document.getElementById('tabella-body');
    const emptyState = document.getElementById('empty-state');
    const tabella = document.getElementById('tabella-spese');
    const counter = document.getElementById('counter-spese');
    
    counter.textContent = `${spese.length} spese`;
    
    if (!spese || spese.length === 0) {
        emptyState.style.display = 'block';
        tabella.style.display = 'none';
        tbody.innerHTML = '';
        return;
    }
    
    emptyState.style.display = 'none';
    tabella.style.display = 'table';
    tbody.innerHTML = '';
    
    spese.forEach((spesa, index) => {
        const row = document.createElement('tr');
        
        // Determina tipo spesa
        const tipo = parseFloat(spesa.totale_vitto) > parseFloat(spesa.totale_auto) ? 'vitto' : 'auto';
        const badge = tipo === 'vitto' ? 
            '<span class="badge badge-vitto">Vitto</span>' : 
            '<span class="badge badge-auto">Auto</span>';
        
        // Foto preview
        let fotoHTML = '<div class="foto-cell">';
        if (spesa.foto_url && spesa.foto_url.length > 0) {
            spesa.foto_url.slice(0, 3).forEach((url, i) => {
                fotoHTML += `
                    <div class="foto-thumb" onclick="apriModaleFoto(${JSON.stringify(spesa.foto_url)}, 'Foto - ${formattaData(spesa.data)}')">
                        <img src="${url}" alt="Foto ${i+1}">
                        ${i === 2 && spesa.foto_url.length > 3 ? `<div style="position:absolute;bottom:0;background:rgba(0,0,0,0.7);color:white;font-size:10px;width:100%;text-align:center;">+${spesa.foto_url.length - 3}</div>` : ''}
                    </div>
                `;
            });
        } else {
            fotoHTML += '<span style="color:#94a3b8;">Nessuna foto</span>';
        }
        fotoHTML += '</div>';
        
        row.innerHTML = `
            <td><strong>${formattaData(spesa.data)}</strong></td>
            <td>${spesa.localita || 'N/D'}</td>
            <td>${badge}</td>
            <td>${formattaEuro(spesa.totale_vitto)}</td>
            <td>${formattaEuro(spesa.totale_auto)}</td>
            <td><strong style="color: var(--primary);">${formattaEuro(spesa.totale_generale)}</strong></td>
            <td>${fotoHTML}</td>
            <td>
                <button onclick="dettaglioSpesa(${index})" class="btn-secondary" style="padding: 5px 10px; font-size: 0.8rem;">
                    <span class="material-symbols-rounded" style="font-size: 16px;">visibility</span>
                </button>
                <button onclick="eliminaSpesa('${spesa.id}')" class="btn-danger" style="padding: 5px 10px; font-size: 0.8rem;">
                    <span class="material-symbols-rounded" style="font-size: 16px;">delete</span>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Aggiorna grafico
function aggiornaGrafico(spese) {
    const ctx = document.getElementById('graficoSpese').getContext('2d');
    
    // Distruggi grafico esistente
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    if (!spese || spese.length === 0) {
        // Grafico vuoto
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Nessun dato'],
                datasets: [{
                    label: 'Spese',
                    data: [0],
                    backgroundColor: '#e2e8f0'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Nessuna spesa disponibile per il periodo selezionato'
                    }
                }
            }
        });
        return;
    }
    
    // Raggruppa per mese
    const spesePerMese = {};
    spese.forEach(spesa => {
        const chiave = `${spesa.mese}/${spesa.anno}`;
        if (!spesePerMese[chiave]) {
            spesePerMese[chiave] = {
                vitto: 0,
                auto: 0,
                totale: 0
            };
        }
        spesePerMese[chiave].vitto += parseFloat(spesa.totale_vitto) || 0;
        spesePerMese[chiave].auto += parseFloat(spesa.totale_auto) || 0;
        spesePerMese[chiave].totale += parseFloat(spesa.totale_generale) || 0;
    });
    
    const mesi = Object.keys(spesePerMese);
    const datiVitto = mesi.map(mese => spesePerMese[mese].vitto);
    const datiAuto = mesi.map(mese => spesePerMese[mese].auto);
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: mesi,
            datasets: [
                {
                    label: 'Vitto/Trasporto',
                    data: datiVitto,
                    backgroundColor: '#22c55e',
                    borderColor: '#16a34a',
                    borderWidth: 1
                },
                {
                    label: 'Auto',
                    data: datiAuto,
                    backgroundColor: '#ef4444',
                    borderColor: '#dc2626',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribuzione Spese per Mese',
                    font: { size: 16, weight: 'bold' }
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
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '€' + value;
                        }
                    },
                    grid: {
                        color: '#e2e8f0'
                    }
                }
            }
        }
    });
}

// Dettaglio spesa
function dettaglioSpesa(index) {
    const spesa = tutteSpese[index];
    if (!spesa) return;
    
    let dettaglio = `
        <h3 style="color: var(--primary-dark); margin-bottom: 20px;">Dettaglio Spesa - ${formattaData(spesa.data)}</h3>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 5px;">Località</div>
                    <div style="font-weight: 700; font-size: 1.1rem;">${spesa.localita || 'N/D'}</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 5px;">Tipo</div>
                    <div>
                        ${parseFloat(spesa.totale_vitto) > 0 ? '<span class="badge badge-vitto" style="margin-right: 5px;">Vitto</span>' : ''}
                        ${parseFloat(spesa.totale_auto) > 0 ? '<span class="badge badge-auto">Auto</span>' : ''}
                    </div>
                </div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <!-- Vitto/Trasporto -->
            <div style="background: #f0fdf4; padding: 15px; border-radius: 10px; border-left: 4px solid #22c55e;">
                <div style="font-weight: 800; color: #166534; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                    <span class="material-symbols-rounded">restaurant</span>
                    VITTO/TRASPORTO
                </div>
                <div style="font-size: 2rem; font-weight: 900; color: #166534; margin-bottom: 10px;">
                    ${formattaEuro(spesa.totale_vitto)}
                </div>
                <div style="font-size: 0.9rem; color: #475569;">
                    <div>${spesa.pasti} pasti (€${(spesa.pasti * 12).toFixed(2)})</div>
                    <div>${spesa.pernottamenti} pernottamenti (€${(spesa.pernottamenti * 80).toFixed(2)})</div>
                    <div>Mezzi trasporto: ${formattaEuro(spesa.mezzi_trasp)}</div>
                    <div>Altre spese: ${formattaEuro(spesa.altre_spese)}</div>
                </div>
            </div>
            
            <!-- Auto -->
            <div style="background: #fef2f2; padding: 15px; border-radius: 10px; border-left: 4px solid #dc2626;">
                <div style="font-weight: 800; color: #991b1b; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                    <span class="material-symbols-rounded">directions_car</span>
                    AUTO
                </div>
                <div style="font-size: 2rem; font-weight: 900; color: #991b1b; margin-bottom: 10px;">
                    ${formattaEuro(spesa.totale_auto)}
                </div>
                <div style="font-size: 0.9rem; color: #475569;">
                    <div>${spesa.km_auto_propria} km (€${(spesa.km_auto_propria * 0.5).toFixed(2)})</div>
                    <div>Pedaggi: ${formattaEuro(spesa.ped_autostrad)}</div>
                    <div>Parcheggi: ${formattaEuro(spesa.parcheggi)}</div>
                    <div>Lavaggio: ${formattaEuro(spesa.lavaggio)}</div>
                    <div>Carburante: ${formattaEuro(spesa.carbur_lubrif)}</div>
                </div>
            </div>
        </div>
        
        <!-- Note -->
        ${spesa.note ? `
        <div style="background: #f0f9ff; padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #0ea5e9;">
            <div style="font-weight: 800; color: #0369a1; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-rounded">notes</span>
                NOTE
            </div>
            <div style="color: #475569;">${spesa.note}</div>
        </div>
        ` : ''}
        
        <!-- Foto -->
        <div style="background: #faf5ff; padding: 15px; border-radius: 10px; border-left: 4px solid #8b5cf6;">
            <div style="font-weight: 800; color: #7c3aed; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-rounded">photo_camera</span>
                FOTO RICEVUTE (${spesa.foto_url ? spesa.foto_url.length : 0})
            </div>
            ${spesa.foto_url && spesa.foto_url.length > 0 ? 
                `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px;">
                    ${spesa.foto_url.map(url => 
                        `<img src="${url}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="window.open('${url}', '_blank')">`
                    ).join('')}
                </div>` :
                '<div style="color: #94a3b8; text-align: center; padding: 20px;">Nessuna foto disponibile</div>'
            }
        </div>
    `;
    
    // Crea modale
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <button class="modal-close" onclick="this.parentElement.parentElement.remove()">×</button>
            ${dettaglio}
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn btn-secondary">
                    <span class="material-symbols-rounded">close</span>
                    Chiudi
                </button>
                <button onclick="window.print()" class="btn btn-primary">
                    <span class="material-symbols-rounded">print</span>
                    Stampa
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Chiudi cliccando fuori
    modal.onclick = function(e) {
        if (e.target === this) this.remove();
    };
}

// Elimina spesa
async function eliminaSpesa(id) {
    if (!confirm('Sei sicuro di voler eliminare questa spesa?\nQuesta azione non può essere annullata.')) {
        return;
    }
    
    mostraLoading();
    
    try {
        // Elimina eventuali foto dallo storage
        const { data: spesa, error: errorSpesa } = await supabaseClient
            .from('note_spese')
            .select('foto_url')
            .eq('id', id)
            .single();
        
        if (spesa && spesa.foto_url && spesa.foto_url.length > 0) {
            // Estrai nomi file dagli URL
            const fileNames = spesa.foto_url.map(url => {
                const parts = url.split('/');
                return parts[parts.length - 1];
            });
            
            // Elimina file dallo storage
            const { error: errorStorage } = await supabaseClient.storage
                .from('spese')
                .remove(fileNames);
            
            if (errorStorage) console.error('Errore eliminazione foto:', errorStorage);
        }
        
        // Elimina record dal database
        const { error } = await supabaseClient
            .from('note_spese')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        alert('Spesa eliminata con successo!');
        await caricaDati(); // Ricarica dati
        
    } catch (error) {
        console.error('Errore eliminazione:', error);
        alert('Errore durante l\'eliminazione: ' + error.message);
    } finally {
        nascondiLoading();
    }
}

// Export PDF
async function esportaPDF() {
    if (!tutteSpese || tutteSpese.length === 0) {
        alert('Nessuna spesa da esportare');
        return;
    }
    
    mostraLoading();
    
    try {
        // Crea PDF con jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        
        // Logo e intestazione
        doc.setFontSize(20);
        doc.setTextColor(56, 96, 178);
        doc.text('PARKAPP - NOTE SPESE', 20, 20);
        
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139);
        doc.text(`Tecnico: ${localStorage.getItem('tecnico_loggato')}`, 20, 30);
        doc.text(`Periodo: ${document.getElementById('filtro-anno').value || 'Tutti'} - ${document.getElementById('filtro-mese').value || 'Tutti i mesi'}`, 20, 37);
        doc.text(`Data esportazione: ${new Date().toLocaleDateString('it-IT')}`, 20, 44);
        
        // Linea separatrice
        doc.setDrawColor(56, 96, 178);
        doc.setLineWidth(0.5);
        doc.line(20, 48, 280, 48);
        
        // Intestazione tabella
        let y = 60;
        const headers = [['Data', 'Località', 'Vitto/Trasp.', 'Auto', 'Totale', 'Note']];
        const columnWidths = [30, 40, 40, 40, 40, 90];
        
        // Stile intestazione
        doc.setFillColor(56, 96, 178);
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        
        headers[0].forEach((header, i) => {
            doc.rect(20 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), y - 10, columnWidths[i], 10, 'F');
            doc.text(header, 22 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), y - 3);
        });
        
        // Dati tabella
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        
        tutteSpese.forEach((spesa, index) => {
            if (y > 180) {
                doc.addPage();
                y = 20;
            }
            
            const row = [
                formattaData(spesa.data),
                spesa.localita || '',
                formattaEuro(spesa.totale_vitto),
                formattaEuro(spesa.totale_auto),
                formattaEuro(spesa.totale_generale),
                spesa.note ? (spesa.note.length > 50 ? spesa.note.substring(0, 50) + '...' : spesa.note) : ''
            ];
            
            row.forEach((cell, i) => {
                doc.text(cell, 22 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), y);
            });
            
            y += 8;
        });
        
        // Totali
        y += 10;
        doc.setFont(undefined, 'bold');
        doc.text('TOTALI PERIODO:', 20, y);
        
        const totaleVitto = tutteSpese.reduce((sum, s) => sum + (parseFloat(s.totale_vitto) || 0), 0);
        const totaleAuto = tutteSpese.reduce((sum, s) => sum + (parseFloat(s.totale_auto) || 0), 0);
        const totaleGenerale = tutteSpese.reduce((sum, s) => sum + (parseFloat(s.totale_generale) || 0), 0);
        
        y += 8;
        doc.text(`Vitto/Trasporto: ${formattaEuro(totaleVitto)}`, 25, y);
        y += 6;
        doc.text(`Auto: ${formattaEuro(totaleAuto)}`, 25, y);
        y += 6;
        doc.setTextColor(56, 96, 178);
        doc.text(`TOTALE GENERALE: ${formattaEuro(totaleGenerale)}`, 25, y);
        
        // Salva PDF
        doc.save(`note_spese_${localStorage.getItem('tecnico_loggato')}_${Date.now()}.pdf`);
        
    } catch (error) {
        console.error('Errore esportazione PDF:', error);
        alert('Errore durante l\'esportazione PDF');
    } finally {
        nascondiLoading();
    }
}

// Export Excel
async function esportaExcel() {
    if (!tutteSpese || tutteSpese.length === 0) {
        alert('Nessuna spesa da esportare');
        return;
    }
    
    mostraLoading();
    
    try {
        // Prepara dati
        const dati = tutteSpese.map(spesa => ({
            Data: formattaData(spesa.data),
            Località: spesa.localita || '',
            'Pasti (n)': spesa.pasti,
            'Pasti (€)': (spesa.pasti * 12).toFixed(2),
            'Pernottamenti (n)': spesa.pernottamenti,
            'Pernottamenti (€)': (spesa.pernottamenti * 80).toFixed(2),
            'Mezzi Trasporto (€)': parseFloat(spesa.mezzi_trasp).toFixed(2),
            'Altre Spese (€)': parseFloat(spesa.altre_spese).toFixed(2),
            'KM Auto': spesa.km_auto_propria,
            'KM Auto (€)': (spesa.km_auto_propria * 0.5).toFixed(2),
            'Pedaggi (€)': parseFloat(spesa.ped_autostrad).toFixed(2),
            'Parcheggi (€)': parseFloat(spesa.parcheggi).toFixed(2),
            'Lavaggio (€)': parseFloat(spesa.lavaggio).toFixed(2),
            'Carburante (€)': parseFloat(spesa.carbur_lubrif).toFixed(2),
            'Totale Vitto/Trasporto (€)': parseFloat(spesa.totale_vitto).toFixed(2),
            'Totale Auto (€)': parseFloat(spesa.totale_auto).toFixed(2),
            'Totale Generale (€)': parseFloat(spesa.totale_generale).toFixed(2),
            Note: spesa.note || '',
            'Numero Foto': spesa.foto_url ? spesa.foto_url.length : 0
        }));
        
        // Crea worksheet
        const ws = XLSX.utils.json_to_sheet(dati);
        
        // Aggiungi totali
        const totaliVitto = tutteSpese.reduce((sum, s) => sum + (parseFloat(s.totale_vitto) || 0), 0);
        const totaliAuto = tutteSpese.reduce((sum, s) => sum + (parseFloat(s.totale_auto) || 0), 0);
        const totaliGenerale = tutteSpese.reduce((sum, s) => sum + (parseFloat(s.totale_generale) || 0), 0);
        
        const righeTotali = [
            {},
            {
                Data: 'TOTALI PERIODO:',
                'Totale Vitto/Trasporto (€)': totaliVitto.toFixed(2),
                'Totale Auto (€)': totaliAuto.toFixed(2),
                'Totale Generale (€)': totaliGenerale.toFixed(2)
            }
        ];
        
        XLSX.utils.sheet_add_json(ws, righeTotali, {
            origin: -1,
            skipHeader: true
        });
        
        // Crea workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Note Spese');
        
        // Salva file
        XLSX.writeFile(wb, `note_spese_${localStorage.getItem('tecnico_loggato')}_${Date.now()}.xlsx`);
        
    } catch (error) {
        console.error('Errore esportazione Excel:', error);
        alert('Errore durante l\'esportazione Excel');
    } finally {
        nascondiLoading();
    }
}