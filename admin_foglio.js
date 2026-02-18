console.log('🚀 ADMIN FOGLI - AVVIO');

let fogliList = [];

const foglioParseNum = (v) => v ? parseFloat(v.toString().replace(',', '.')) || 0 : 0;
const foglioFormatVal = (v, fz) => {
    if (v === undefined || v === null) return "0,00";
    if (v === 0) return (fz ? "0,00" : "");
    return v.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

const foglioGetFestivi = () => ["01-01", "06-01", "25-04", "01-05", "02-06", "15-08", "01-11", "08-12", "25-12", "26-12"];

const foglioDescCodici = {
    "072": "Assemblea", "073": "Sciopero", "075": "Ferie", "076": "Festività", "077": "Malattia", 
    "078": "Infortunio", "079": "Donazione Sangue", "080": "Allattamento", "081": "Congedo Matr.",
    "082": "Permesso Retr.", "083": "Permesso NON Retr.", "084": "Legge 104", "085": "Elettorale",
    "086": "Lutto", "087": "Sindacale", "088": "Studio", "089": "Volontariato", 
    "090": "Malattia Figlio <3", "091": "Malattia Figlio >3", "092": "Corso Formazione"
};

function popolaTecnici() {
    const tecnici = [...new Set(fogliList.map(d => d.tecnico))].filter(Boolean).sort();
    const sel = document.getElementById('selectTecnico');
    if (!sel) return;
    
    sel.innerHTML = '<option value="">-- Seleziona Tecnico --</option>';
    tecnici.forEach(t => {
        const option = document.createElement('option');
        option.value = t;
        option.textContent = t;
        sel.appendChild(option);
    });
}

function renderVistaMensile() {
    console.log('📅 renderVistaMensile eseguita');
    
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    const tecnico = document.getElementById('selectTecnico')?.value;
    const mese = parseInt(document.getElementById('selectMese')?.value) || new Date().getMonth() + 1;
    const anno = parseInt(document.getElementById('selectAnno')?.value) || new Date().getFullYear();
    
    console.log('🔍 Filtri:', { tecnico, mese, anno });
    
    if (!tecnico) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div style="padding: 2rem; color: var(--text-muted);">
                        <span class="material-symbols-rounded" style="font-size: 3rem;">person_search</span>
                        <p style="margin-top: 1rem;">Seleziona un tecnico</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Filtra i dati per tecnico, mese e anno
    const datiFiltrati = fogliList.filter(f => 
        f.tecnico === tecnico && 
        f.mese === mese && 
        f.anno === anno
    );
    
    if (datiFiltrati.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div style="padding: 2rem; color: var(--text-muted);">
                        <span class="material-symbols-rounded" style="font-size: 3rem;">calendar_month</span>
                        <p>Nessun dato per questo periodo</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Raggruppa per giorno
    const raggruppati = {};
    datiFiltrati.forEach(r => {
        const g = r.giorno;
        if (!raggruppati[g]) {
            raggruppati[g] = { 
                ord: 0, ass: 0, stra: 0, vgg: 0, 
                desc: new Set(), 
                list: [] 
            };
        }
        
        const oreR = foglioParseNum(r.ore_ord);
        const codR = parseInt(r.codice);
        
        // Distingui tra lavoro e assenza
        if (codR >= 72 && codR <= 91) {
            raggruppati[g].ass += oreR;
        } else {
            raggruppati[g].ord += oreR;
        }
        
        raggruppati[g].stra += foglioParseNum(r.ore_stra);
        raggruppati[g].vgg += foglioParseNum(r.ore_viaggio);
        
        // Aggiungi descrizione codice
        const cKey = codR.toString().padStart(3, '0');
        if (foglioDescCodici[cKey]) {
            raggruppati[g].desc.add(foglioDescCodici[cKey] + ` (${cKey})`);
        }
        
        raggruppati[g].list.push(r);
    });
    
    // Costruisci tabella
    const festivi = foglioGetFestivi();
    const ultimoGiorno = new Date(anno, mese, 0).getDate();
    
    let html = '';
    let totLavorate = 0, totAssenze = 0, totStra = 0, totVgg = 0, totPreviste = 0;
    
    for (let i = 1; i <= ultimoGiorno; i++) {
        const dataC = new Date(anno, mese - 1, i);
        const giornoSettimana = dataC.getDay();
        const isSabato = giornoSettimana === 6;
        const isDomenica = giornoSettimana === 0;
        const dataStr = `${i.toString().padStart(2, '0')}-${mese.toString().padStart(2, '0')}`;
        const isFestivo = festivi.includes(dataStr);
        
        // Ore previste (8 per giorni feriali, 0 per weekend/festivi)
        const orePreviste = (isSabato || isDomenica || isFestivo) ? 0 : 8;
        totPreviste += orePreviste;
        
        const day = raggruppati[i] || { ord: 0, ass: 0, stra: 0, vgg: 0, desc: new Set(), list: [] };
        
        totLavorate += day.ord;
        totAssenze += day.ass;
        totStra += day.stra;
        totVgg += day.vgg;
        
        const totGiorno = day.ord + day.ass;
        
        // Classi CSS per colori
        let rowClass = '';
        if (isFestivo) rowClass = 'bg-festivo';
        else if (isDomenica) rowClass = 'bg-domenica';
        else if (isSabato) rowClass = 'bg-sabato';
        
        // Evidenzia anomalie
        let ordStyle = '';
        if (orePreviste > 0) {
            ordStyle = (totGiorno === 8) ? 'text-ok' : 'text-anomaly';
        } else {
            ordStyle = (totGiorno > 0) ? 'text-anomaly' : '';
        }
        
        const fz = (orePreviste === 8 && totGiorno === 0);
        
        // Formatta descrizione codici
        const descrizione = Array.from(day.desc).join(' / ');
        
        html += `
            <tr class="${rowClass} row-hover" onclick='openDettaglioGiorno(${JSON.stringify(day.list)}, "${dataC.toLocaleDateString('it-IT')}", "${tecnico}")'>
                <td class="text-slate-400 font-medium">${dataC.toLocaleDateString('it-IT')}</td>
                <td class="text-[10px] uppercase font-black text-slate-400 text-center">${dataC.toLocaleDateString('it-IT', {weekday: 'short'}).toUpperCase()}</td>
                <td class="text-center ${ordStyle}">${foglioFormatVal(totGiorno, fz)}</td>
                <td class="text-center font-medium">${foglioFormatVal(day.stra)}</td>
                <td class="text-center font-medium text-slate-500">${foglioFormatVal(day.vgg)}</td>
                <td class="text-left text-blue-700 font-bold text-[11px]">${descrizione}</td>
            </tr>
        `;
    }
    
    tbody.innerHTML = html;
    
    // Aggiorna statistiche
    foglioAggiornaStatistiche(totLavorate, totAssenze, totStra, totVgg, totPreviste);
}

window.caricaFogli = async function() {
    console.log('📥 Caricamento fogli lavoro...');
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;
        
        while(hasMore) {
            console.log(`📄 Caricamento pagina ${page + 1}...`);
            
            const { data, error } = await supabase
                .from('fogliolavoro')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1)
                .order('anno', { ascending: false })
                .order('mese', { ascending: false })
                .order('giorno', { ascending: false });
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                page++;
                
                if (data.length < pageSize) {
                    hasMore = false;
                    console.log(`✅ Ultima pagina raggiunta (${data.length} record)`);
                }
            } else {
                hasMore = false;
            }
        }
        
        fogliList = allData;
        fogliFiltrati = [...fogliList];
        
        console.log(`✅ Caricati TUTTI i ${fogliList.length} fogli lavoro`);

        // Popola la datalist degli impianti
        const impianti = [...new Set(fogliList.map(f => f.impianto).filter(Boolean))].sort();
        const datalist = document.getElementById('lista-impianti');
        if (datalist) {
            datalist.innerHTML = impianti.map(i => `<option value="${i}">`).join('');
        }
        
        // Popola select tecnici
        popolaTecnici();
        
        // Render iniziale
        renderVistaMensile();
        
        mostraNotifica(`Caricati ${fogliList.length} fogli lavoro`, 'success');

    } catch (error) {
        console.error('❌ Errore caricamento fogli:', error);
        mostraNotifica('Errore nel caricamento dei fogli lavoro', 'error');
    }
};
console.log('✅ Fine file');


function mostraNotifica(messaggio, tipo = 'info') {
    console.log(`🔔 ${tipo}: ${messaggio}`);
    alert(messaggio); // Temporaneo, poi lo sostituiremo con toast
}



function foglioAggiornaStatistiche(lavorate, assenze, stra, vgg, previste) {
    const sumOrd = document.getElementById('sumOrd');
    const sumAss = document.getElementById('sumAss');
    const sumStra = document.getElementById('sumStra');
    const sumVgg = document.getElementById('sumVgg');
    const totalRatio = document.getElementById('totalRatio');
    
    if (sumOrd) sumOrd.innerText = foglioFormatVal(lavorate);
    if (sumAss) sumAss.innerText = foglioFormatVal(assenze);
    if (sumStra) sumStra.innerText = foglioFormatVal(stra);
    if (sumVgg) sumVgg.innerText = foglioFormatVal(vgg);
    
    const totale = lavorate + assenze;
    if (totalRatio) {
        totalRatio.innerText = `${foglioFormatVal(totale)} / ${foglioFormatVal(previste)}`;
        totalRatio.className = `text-sm font-black italic ${Math.abs(totale - previste) < 0.01 ? 'text-green-600' : 'text-red-600'}`;
    }
}


// ============================================
// DETTAGLIO GIORNALIERO
// ============================================

function openDettaglioGiorno(interventi, dataStr, tecnico) {
    console.log('📅 openDettaglioGiorno', dataStr, tecnico);
    
    if (!interventi || interventi.length === 0) return;
    
    // Configurazione tipi con colori
    const configTipi = {
        "MONTAGGIO": { bg: "#f0f9ff", border: "#bae6fd", icon: "🔧" },
        "ORDINARIA": { bg: "#f8fafc", border: "#e2e8f0", icon: "🟢" },
        "ALTRO": { bg: "#f0fdf4", border: "#a7f3d0", icon: "📌" },
        "REPERIBILITA": { bg: "#fef2f2", border: "#fecaca", icon: "🚨" },
        "STRAORDINARIO": { bg: "#fff7ed", border: "#fed7aa", icon: "⏱️" }
    };
    
    // Calcola totali
    let totOrd = 0, totStra = 0, totVgg = 0;
    interventi.forEach(i => {
        const codNum = parseInt(i.codice);
        if (codNum >= 72 && codNum <= 92) {
            totOrd += foglioParseNum(i.ore_ord);
        } else {
            if (i.ch_rep === 'ORDINARIA') {
                totOrd += foglioParseNum(i.ore_ord) + foglioParseNum(i.ore_stra);
            } else {
                totStra += foglioParseNum(i.ore_stra);
                totOrd += foglioParseNum(i.ore_ord);
            }
        }
        totVgg += foglioParseNum(i.ore_viaggio);
    });
    const totGiorno = totOrd + totStra;
    
    // Crea modal se non esiste
    let modal = document.getElementById('modal-dettaglio-giorno');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-dettaglio-giorno';
        modal.className = 'modal';
        modal.setAttribute('onclick', 'chiudiDettaglioGiorno()');
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3 id="modal-giorno-titolo">Dettaglio Giornata</h3>
                    <button class="btn-icon-small" onclick="chiudiDettaglioGiorno()">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
                <div class="modal-body" id="modal-giorno-body" style="max-height: 60vh; overflow-y: auto;"></div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="chiudiDettaglioGiorno()">Chiudi</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Header con totali
    const headerHtml = `
        <div style="width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0;">${dataStr}</h2>
                    <p style="font-size: 0.75rem; color: #64748b; margin: 0;">${tecnico}</p>
                </div>
                <div style="padding: 0.5rem 1rem; background: #1e293b; color: white; border-radius: 16px;">
                    <p style="font-size: 0.65rem; margin: 0;">Totale Giorno</p>
                    <p style="font-size: 1.25rem; font-weight: 800; margin: 0;">${foglioFormatVal(totGiorno)}</p>
                </div>
            </div>
            <div style="display: flex; gap: 1rem; padding: 0.5rem; background: #f8fafc; border-radius: 8px; margin-top: 0.5rem;">
                <div><span style="font-size: 0.7rem; color: #64748b;">ORDINARIE</span><br><span style="font-size: 1.1rem; font-weight: 700;">${foglioFormatVal(totOrd)}</span></div>
                <div><span style="font-size: 0.7rem; color: #64748b;">STRAORD.</span><br><span style="font-size: 1.1rem; font-weight: 700; color: #f97316;">${foglioFormatVal(totStra)}</span></div>
                <div><span style="font-size: 0.7rem; color: #64748b;">VIAGGIO</span><br><span style="font-size: 1.1rem; font-weight: 700; color: #3b82f6;">${foglioFormatVal(totVgg)}</span></div>
            </div>
        </div>
    `;
    
    // Body con timeline
    let bodyHtml = '';
    interventi.forEach((item, index) => {
        const tipo = String(item.ch_rep || "ALTRO").trim().toUpperCase();
        const style = configTipi[tipo] || { bg: "#f8fafc", border: "#e2e8f0", icon: "📄" };
        
        const oreOrd = foglioParseNum(item.ore_ord);
        const oreStra = foglioParseNum(item.ore_stra);
        const oreVgg = foglioParseNum(item.ore_viaggio);
        
        // Formatta orario
        let orarioHtml = '';
        if (item.inizio_int && item.fine_int) {
            const inizio = item.inizio_int.split(':').slice(0,2).join(':');
            const fine = item.fine_int.split(':').slice(0,2).join(':');
            if (inizio !== '00:00' && fine !== '00:00') {
                orarioHtml = `<p style="margin: 0.25rem 0 0 0; font-size: 0.8rem;">🕒 ${inizio} - ${fine}</p>`;
            }
        }
        
        bodyHtml += `
            <div style="position: relative; padding-left: 40px; margin-bottom: 20px;">
                ${index < interventi.length - 1 ? '<div style="position: absolute; left: 19px; top: 30px; bottom: -20px; width: 2px; background: #e2e8f0;"></div>' : ''}
                <div style="position: absolute; left: 0; top: 0; width: 40px; height: 40px; background: white; border: 2px solid #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <span>${style.icon}</span>
                </div>
                
                <div style="background: ${style.bg}; border: 2px solid ${style.border}; border-radius: 16px; padding: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <span style="font-size: 0.7rem; font-weight: 800; padding: 0.25rem 0.5rem; background: white; border-radius: 4px;">${tipo}</span>
                            <h3 style="margin: 0.5rem 0 0 0; font-size: 1rem;">${item.impianto || '---'}</h3>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem;">📍 ${item.indirizzo || '---'}</p>
                        </div>
                        <div style="text-align: right;">

<!-- PENNA E CESTINO AGGIUNTI QUI -->
<div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-bottom: 0.25rem;">
    <button onclick="event.stopPropagation(); modificaIntervento('${item.ID}')" 
            style="background: none; border: none; cursor: pointer; color: #3b82f6; padding: 2px;">
        <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
    </button>
    <button onclick="event.stopPropagation(); eliminaIntervento('${item.ID}', '${dataStr}')" 
            style="background: none; border: none; cursor: pointer; color: #ef4444; padding: 2px;">
        <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
    </button>
</div>


                            <span style="background: #1e293b; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem;">Cod. ${item.codice}</span>
                            ${orarioHtml}
                        </div>
                    </div>
                    
                    ${item.note ? `
                    <div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(255,255,255,0.7); border-radius: 8px;">
                        <p style="margin: 0; font-size: 0.85rem; font-style: italic;">"${item.note}"</p>
                    </div>
                    ` : ''}
                    
                    <div style="display: flex; gap: 1.5rem; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px dashed rgba(0,0,0,0.1);">
                        <div>
                            <span style="font-size: 0.65rem; color: #64748b;">ORD</span>
                            <br><span style="font-size: 1.1rem; font-weight: 600;">${foglioFormatVal(oreOrd, true)}</span>
                        </div>
                        <div>
                            <span style="font-size: 0.65rem; color: #64748b;">STRA</span>
                            <br><span style="font-size: 1.1rem; font-weight: 600; color: #f97316;">${foglioFormatVal(oreStra, true)}</span>
                        </div>
                        <div>
                            <span style="font-size: 0.65rem; color: #64748b;">VIAG</span>
                            <br><span style="font-size: 1.1rem; font-weight: 600; color: #3b82f6;">${foglioFormatVal(oreVgg, true)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    document.getElementById('modal-giorno-titolo').innerHTML = headerHtml;
    document.getElementById('modal-giorno-body').innerHTML = bodyHtml;
    modal.style.display = 'flex';
}

function chiudiDettaglioGiorno() {
    const modal = document.getElementById('modal-dettaglio-giorno');
    if (modal) modal.style.display = 'none';
}

// ============================================
// TOGGLE GIORNATA INTERA (per assenze)
// ============================================

function toggleGiornataIntera(checked) {
    const oreInput = document.getElementById('foglio-ore-ord');
    if (!oreInput) return;
    
    if (checked) {
        oreInput.value = '8';
        oreInput.disabled = true;
    } else {
        oreInput.value = '0';
        oreInput.disabled = false;
    }
}
// ============================================
// SALVA INTERVENTO (INSERIMENTO/MODIFICA)
// ============================================

async function salvaFoglio() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const id = document.getElementById('foglio-id')?.value;
        const tecnico = document.getElementById('foglio-tecnico')?.value;
        const codice = document.getElementById('foglio-codice')?.value;
        const dataInput = document.getElementById('foglio-data')?.value;
        const impianto = document.getElementById('foglio-impianto')?.value;
        const indirizzo = document.getElementById('foglio-indirizzo')?.value;
        const tipo = document.querySelector('input[name="foglio-tipo-ore"]:checked')?.value;
        const note = document.getElementById('foglio-note')?.value;
        const oreViaggio = parseFloat(document.getElementById('foglio-ore-viaggio')?.value) || 0;
        
        // Validazioni
        if (!tecnico) {
            mostraNotifica('Seleziona un tecnico', 'error');
            return;
        }
        if (!codice) {
            mostraNotifica('Seleziona un codice', 'error');
            return;
        }
        if (!dataInput) {
            mostraNotifica('Inserisci una data', 'error');
            return;
        }
        if (!tipo) {
            mostraNotifica('Seleziona un tipo ore', 'error');
            return;
        }
        
        const data = new Date(dataInput);
        const giorno = data.getDate();
        const mese = data.getMonth() + 1;
        const anno = data.getFullYear();
        
        let oreOrd = 0, oreStra = 0, oreTotali = 0;
        let inizioInt = null, fineInt = null;
        
        if (tipo === 'ORDINARIA' || tipo === 'ALTRO') {
            oreOrd = parseFloat(document.getElementById('foglio-ore-ord')?.value) || 0;
            oreTotali = oreOrd;
        } else {
            inizioInt = document.getElementById('foglio-ora-inizio')?.value;
            fineInt = document.getElementById('foglio-ora-fine')?.value;
            
            if (!inizioInt || !fineInt) {
                mostraNotifica('Inserisci ora inizio e fine', 'error');
                return;
            }
            
            const res = processHours(inizioInt, fineInt, tipo, data.getDay());
            oreOrd = res.ord;
            oreStra = res.stra;
            oreTotali = oreOrd + oreStra;
        }
        
        if (oreTotali <= 0 && oreViaggio <= 0) {
            mostraNotifica('Inserisci almeno un\'ora di lavoro o viaggio', 'error');
            return;
        }
        
        const payload = {
            tecnico,
            giorno,
            mese,
            anno,
            codice: parseInt(codice) || codice,
            impianto,
            indirizzo,
            ch_rep: tipo,
            inizio_int: inizioInt,
            fine_int: fineInt,
            ore_ord: oreOrd,
            ore_stra: oreStra,
            ore: oreTotali,
            ore_viaggio: oreViaggio,
            note,
            data: `${giorno}/${mese}/${anno} 08:00`,
            "Data/ora creazione": new Date().toLocaleString('it-IT')
        };
        
        if (id) {
            // Update
            const { error } = await supabase
                .from('fogliolavoro')
                .update(payload)
                .eq('ID', id);
            
            if (error) throw error;
            mostraNotifica('Intervento aggiornato con successo', 'success');
        } else {
            // Insert
            const { error } = await supabase
                .from('fogliolavoro')
                .insert([payload]);
            
            if (error) throw error;
            mostraNotifica('Intervento salvato con successo', 'success');
        }
        
        // Chiudi modal
        chiudiModalFoglio();
        
        // Ricarica i dati
        await caricaFogli();
        
        // Aggiorna la vista
        renderVistaMensile();
        
    } catch (error) {
        console.error('❌ Errore salvataggio:', error);
        mostraNotifica(`Errore: ${error.message}`, 'error');
    }
}


// ============================================
// FUNZIONI ELIMINAZIONE INTERVENTO
// ============================================

let interventoDaEliminare = null;
let dataInterventoDaEliminare = null;

function eliminaIntervento(id, dataStr) {
    console.log('🗑️ eliminaIntervento', id, dataStr);
    
    // Chiudi il modal giornaliero
    const modalGiornaliero = document.getElementById('modal-dettaglio-giorno');
    if (modalGiornaliero) {
        modalGiornaliero.style.display = 'none';
    }
    
    // Salva i dati per la conferma
    interventoDaEliminare = id;
    dataInterventoDaEliminare = dataStr;
    
    // Mostra il modal di conferma
    const modal = document.getElementById('modal-conferma-cancellazione-ann');
    if (modal) {
        modal.style.display = 'flex';
    }
}

async function confermaCancellazioneIntervento() {
    if (!interventoDaEliminare) return;
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { error } = await supabase
            .from('fogliolavoro')
            .delete()
            .eq('ID', interventoDaEliminare);
        
        if (error) throw error;
        
        chiudiModalCancellazioneIntervento();
        await caricaFogli();
        renderVistaMensile();
        
        mostraNotifica('Intervento eliminato con successo', 'success');
        
    } catch (error) {
        console.error('❌ Errore eliminazione:', error);
        mostraNotifica(`Errore: ${error.message}`, 'error');
    }
}

function chiudiModalCancellazioneIntervento() {
    interventoDaEliminare = null;
    dataInterventoDaEliminare = null;
    
    const modal = document.getElementById('modal-conferma-cancellazione-ann');
    if (modal) modal.style.display = 'none';
}


function modificaIntervento(id) {
    console.log('✏️ modificaIntervento', id);
    
    const modalGiornaliero = document.getElementById('modal-dettaglio-giorno');
    if (modalGiornaliero) {
        modalGiornaliero.style.display = 'none';
    }
    
    popolaSelectTecnici();
    
    const intervento = fogliList.find(f => f.ID == id);
    if (!intervento) {
        console.error('Intervento non trovato', id);
        return;
    }
    
    document.getElementById('modal-foglio-titolo').textContent = 'Modifica Intervento';
    document.getElementById('foglio-id').value = intervento.ID;
    document.getElementById('foglio-tecnico').value = intervento.tecnico || '';
    document.getElementById('foglio-codice').value = intervento.codice?.toString() || '';
    
    if (intervento.anno && intervento.mese && intervento.giorno) {
        const data = `${intervento.anno}-${intervento.mese.toString().padStart(2,'0')}-${intervento.giorno.toString().padStart(2,'0')}`;
        document.getElementById('foglio-data').value = data;
    }
    
    document.getElementById('foglio-impianto').value = intervento.impianto || '';
    document.getElementById('foglio-indirizzo').value = intervento.indirizzo || '';
    
    const tipoOre = intervento.ch_rep || 'ORDINARIA';
    const radio = document.querySelector(`input[name="foglio-tipo-ore"][value="${tipoOre}"]`);
    if (radio) {
        radio.checked = true;
    }
    toggleTipoOreFoglio();
    
    document.getElementById('foglio-ore-ord').value = intervento.ore_ord || 0;
    document.getElementById('foglio-ore-viaggio').value = intervento.ore_viaggio || 0;
    document.getElementById('foglio-ora-inizio').value = intervento.inizio_int || '';
    document.getElementById('foglio-ora-fine').value = intervento.fine_int || '';
    
    if (intervento.inizio_int && intervento.fine_int) {
        calcolaOreFoglio();
    }
    
    document.getElementById('foglio-note').value = intervento.note || '';
    
    document.getElementById('modal-foglio').style.display = 'flex';
}


function eliminaIntervento(id, dataStr) {
    console.log('🗑️ eliminaIntervento', id, dataStr);
    
    const modalGiornaliero = document.getElementById('modal-dettaglio-giorno');
    if (modalGiornaliero) {
        modalGiornaliero.style.display = 'none';
    }
    
    const intervento = fogliList.find(f => f.ID == id);
    
    let descrizione = '';
    if (intervento) {
        const tipo = intervento.ch_rep || 'GENERICO';
        const codice = intervento.codice || 'N/D';
        const impianto = intervento.impianto || 'N/D';
        const oreTotali = (parseFloat(intervento.ore_ord || 0) + parseFloat(intervento.ore_stra || 0)).toFixed(2);
        
        descrizione = `
            <div style="text-align: left; background: #f8fafc; padding: 0.75rem; border-radius: 8px; margin: 0.5rem 0;">
                <div><strong>Codice:</strong> ${codice} (${tipo})</div>
                <div><strong>Impianto:</strong> ${impianto}</div>
                <div><strong>Ore:</strong> ${oreTotali}h</div>
                ${intervento.note ? `<div><strong>Note:</strong> ${intervento.note.substring(0, 50)}${intervento.note.length > 50 ? '...' : ''}</div>` : ''}
            </div>
        `;
    } else {
        descrizione = '<div style="color: #ef4444;">Intervento non trovato</div>';
    }
    
    const msgEl = document.querySelector('#modal-conferma-cancellazione-ann .modal-body');
    if (msgEl) {
        msgEl.innerHTML = `
            <span class="material-symbols-rounded" style="font-size: 48px; color: #ef4444; margin-bottom: 1rem;">warning</span>
            <h3 style="margin: 0 0 0.5rem 0;">Conferma cancellazione</h3>
            ${descrizione}
            <p style="color: #64748b; margin: 1rem 0;">Sei sicuro di voler cancellare questo intervento?</p>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary" style="flex: 1;" onclick="chiudiModalCancellazioneIntervento()">Annulla</button>
                <button class="btn btn-danger" style="flex: 1;" onclick="confermaCancellazioneIntervento()">Cancella</button>
            </div>
        `;
    }
    
    interventoDaEliminare = id;
    dataInterventoDaEliminare = dataStr;
    
    const modal = document.getElementById('modal-conferma-cancellazione-ann');
    if (modal) {
        modal.style.display = 'flex';
    }
}


function popolaSelectTecnici() {
    console.log('👤 popolaSelectTecnici');
    const selectTecnico = document.getElementById('foglio-tecnico');
    if (!selectTecnico) return;
    
    const tecnici = [...new Set(fogliList.map(d => d.tecnico))].filter(Boolean).sort();
    
    let html = '<option value="">Seleziona tecnico</option>';
    tecnici.forEach(t => {
        html += `<option value="${t}">${t}</option>`;
    });
    
    selectTecnico.innerHTML = html;
    console.log(`✅ Popolati ${tecnici.length} tecnici`);
}

function toggleTipoOreFoglio() {
    console.log('🔄 toggleTipoOreFoglio');
    const tipo = document.querySelector('input[name="foglio-tipo-ore"]:checked')?.value || 'ORDINARIA';
    const isOrdinaria = tipo === 'ORDINARIA' || tipo === 'ALTRO';
    
    const boxOreDirette = document.getElementById('foglio-box-ore-dirette');
    const boxOrari = document.getElementById('foglio-box-orari');
    
    if (boxOreDirette) boxOreDirette.style.display = isOrdinaria ? 'block' : 'none';
    if (boxOrari) boxOrari.style.display = isOrdinaria ? 'none' : 'block';
    
    console.log('→ tipo:', tipo, 'isOrdinaria:', isOrdinaria);
}

function calcolaOreFoglio() {
    console.log('🧮 calcolaOreFoglio');
    const inizio = document.getElementById('foglio-ora-inizio')?.value;
    const fine = document.getElementById('foglio-ora-fine')?.value;
    const dataVal = document.getElementById('foglio-data')?.value;
    const tipo = document.querySelector('input[name="foglio-tipo-ore"]:checked')?.value || 'ORDINARIA';
    
    if (!inizio || !fine || !dataVal) return;
    
    // Per ora usiamo una funzione semplice, poi aggiungeremo processHours
    let [h1, m1] = inizio.split(':').map(Number);
    let [h2, m2] = fine.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 1440;
    const oreTotali = diff / 60;
    
    const calcOrd = document.getElementById('foglio-calcolo-ord');
    const calcStra = document.getElementById('foglio-calcolo-stra');
    
    if (calcOrd) calcOrd.textContent = tipo === 'ORDINARIA' ? oreTotali.toFixed(2) : '0.00';
    if (calcStra) calcStra.textContent = tipo !== 'ORDINARIA' ? oreTotali.toFixed(2) : '0.00';
}

function aggiornaTipoDaCodice() {
    console.log('📌 aggiornaTipoDaCodice');
    const codice = document.getElementById('foglio-codice')?.value;
    const boxViaggio = document.getElementById('foglio-ore-viaggio')?.parentElement?.parentElement;
    const impiantoField = document.getElementById('foglio-impianto');
    const indirizzoField = document.getElementById('foglio-indirizzo');
    
    // Troviamo tutti i radio button
    const radioButtons = document.querySelectorAll('input[name="foglio-tipo-ore"]');
    const radioContainer = radioButtons[0]?.parentElement?.parentElement;
    
    // Reset: mostra e abilita tutto
    if (boxViaggio) boxViaggio.style.display = 'block';
    if (radioContainer) {
        radioContainer.style.display = 'block';
        radioButtons.forEach(rb => {
            rb.disabled = false;
            rb.parentElement.style.display = 'inline-block'; // o 'flex' a seconda del layout
        });
    }
    
    // Riabilita campi impianto/indirizzo
    if (impiantoField) {
        impiantoField.disabled = false;
        impiantoField.placeholder = 'Codice impianto o commessa';
    }
    if (indirizzoField) {
        indirizzoField.disabled = false;
        indirizzoField.placeholder = 'Via, città...';
    }
    
    // Rimuovi toggle 8h se esiste
    const toggle8h = document.getElementById('toggle-8h');
    if (toggle8h) {
        toggle8h.parentElement?.parentElement?.remove();
    }
    
    // GESTIONE IN BASE AL CODICE
    if (codice && codice >= '072' && codice <= '092') {
        // ASSENZE
        console.log('📌 Codice assenza:', codice);
        
        // Nascondi tutti i radio tranne ALTRO
        radioButtons.forEach(rb => {
            if (rb.value !== 'ALTRO') {
                rb.parentElement.style.display = 'none';
            } else {
                rb.checked = true;
            }
        });
        
        // Nascondi ore viaggio
        if (boxViaggio) boxViaggio.style.display = 'none';
        
        // Impianto vuoto e disabilitato
        if (impiantoField) {
            impiantoField.value = '';
            impiantoField.disabled = true;
        }
        
        // Indirizzo con descrizione assenza
        if (indirizzoField) {
            indirizzoField.value = foglioDescCodici[codice] || 'Assenza';
            indirizzoField.disabled = true;
        }
        
        // Aggiungi toggle 8h
        const container = document.getElementById('foglio-box-ore-dirette');
        if (container && !document.getElementById('toggle-8h')) {
            const toggleDiv = document.createElement('div');
            toggleDiv.style.marginTop = '10px';
            toggleDiv.style.padding = '10px';
            toggleDiv.style.background = '#f8fafc';
            toggleDiv.style.borderRadius = '8px';
            toggleDiv.style.border = '1px solid #e2e8f0';
            toggleDiv.id = 'toggle-8h-container';
            toggleDiv.innerHTML = `
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <input type="checkbox" id="toggle-8h" onchange="toggleGiornataIntera(this.checked)">
                    <span style="font-weight: 600;">Giornata intera (8 ore)</span>
                </label>
            `;
            container.appendChild(toggleDiv);
        }
        
    } else if (['001', '007'].includes(codice)) {
        // MONTAGGI
        console.log('📌 Codice montaggio:', codice);
        
        // Nascondi REPERIBILITA
        radioButtons.forEach(rb => {
            if (rb.value === 'REPERIBILITA') {
                rb.parentElement.style.display = 'none';
            } else {
                rb.parentElement.style.display = 'inline-block';
            }
        });
        
        // Se non c'è nessun radio selezionato, seleziona ORDINARIA
        const selected = Array.from(radioButtons).find(rb => rb.checked);
        if (!selected) {
            const ordRadio = document.querySelector('input[name="foglio-tipo-ore"][value="ORDINARIA"]');
            if (ordRadio) ordRadio.checked = true;
        }
        
    } else if (['21', '22', '24', '13', '10'].includes(codice)) {
        // LAVORI
        console.log('📌 Codice lavoro:', codice);
        
        // Mostra tutti i radio
        radioButtons.forEach(rb => {
            rb.parentElement.style.display = 'inline-block';
        });
    }
    
    // Chiama toggleTipoOreFoglio per aggiornare la UI in base al tipo selezionato
    toggleTipoOreFoglio();
}

async function cercaIndirizzoImpianto() {
    console.log('🔍 cercaIndirizzoImpianto - INIZIO');
    const impiantoInput = document.getElementById('foglio-impianto')?.value.trim();
    const codiceSelect = document.getElementById('foglio-codice')?.value;
    const indirizzoField = document.getElementById('foglio-indirizzo');
    
    console.log('1️⃣ Valori letti:', { 
        impianto: impiantoInput, 
        codice: codiceSelect,
        indirizzoFieldEsiste: !!indirizzoField 
    });
    
    if (!impiantoInput || !codiceSelect || !indirizzoField) {
        console.log('2️⃣ ❌ Dati mancanti - esco');
        return;
    }
    
    indirizzoField.placeholder = 'Ricerca in corso...';
    console.log('3️⃣ Placeholder cambiato');
    
    try {
        const supabase = getSupabaseClient();
        console.log('4️⃣ Supabase client:', supabase ? 'OK' : 'NULL');
        if (!supabase) throw new Error('DB non configurato');
        
        let indirizzoTrovato = '';
        console.log('5️⃣ Codice selezionato:', codiceSelect);
        
        // Codici lavoro
        if (['21', '22', '24', '13', '10'].includes(codiceSelect)) {
            console.log('6️⃣ Cerco in Parco_app per impianto:', impiantoInput);
            
            const { data, error } = await supabase
                .from('Parco_app')
                .select('Indirizzo, localit, prov')
                .eq('impianto', impiantoInput)
                .maybeSingle();
            
            console.log('7️⃣ Risultato query Parco_app:', { data, error });
            
            if (error) throw error;
            
            if (data) {
                console.log('8️⃣ Dati trovati:', data);
                const parti = [];
                if (data.Indirizzo) parti.push(data.Indirizzo);
                if (data.localit) parti.push(data.localit);
                if (data.prov) parti.push(data.prov);
                indirizzoTrovato = parti.join(' - ');
                console.log('9️⃣ Indirizzo composto:', indirizzoTrovato);
            } else {
                console.log('8️⃣ Nessun dato trovato in Parco_app');
            }
            
        // Codici montaggio
        } else if (['001', '007'].includes(codiceSelect)) {
            console.log('6️⃣ Cerco in montaggi per impianto:', impiantoInput);
            
            const { data, error } = await supabase
                .from('montaggi')
                .select('Indirizzo')
                .eq('impianto', impiantoInput)
                .maybeSingle();
            
            console.log('7️⃣ Risultato query montaggi:', { data, error });
            
            if (error) throw error;
            
            if (data && data.Indirizzo) {
                console.log('8️⃣ Indirizzo trovato:', data.Indirizzo);
                indirizzoTrovato = data.Indirizzo;
            } else {
                console.log('8️⃣ Nessun dato trovato in montaggi');
            }
        } else {
            console.log('6️⃣ Codice non riconosciuto per ricerca impianti');
        }
        
        if (indirizzoTrovato) {
            console.log('🔟 Aggiorno campo indirizzo con:', indirizzoTrovato);
            indirizzoField.value = indirizzoTrovato;
            mostraNotifica('Indirizzo trovato e compilato', 'success');
        } else {
            console.log('🔟 Indirizzo non trovato');
            mostraNotifica('Impianto non trovato', 'warning');
        }
        
    } catch (error) {
        console.error('❌ ERRORE ricerca impianto:', error);
        mostraNotifica('Errore nella ricerca dell\'impianto', 'error');
    } finally {
        console.log('1️⃣1️⃣ Ripristino placeholder');
        indirizzoField.placeholder = 'Via, città...';
    }
    
    console.log('🔍 cercaIndirizzoImpianto - FINE');
}

function processHours(inizio, fine, tipo, dayOfWeek) {
    console.log('⏱️ processHours', { inizio, fine, tipo, dayOfWeek });
    
    // Weekend: tutto straordinario
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        const total = calculateTotalDiff(inizio, fine);
        return { ord: 0, stra: total };
    }
    
    // Reperibilità: tutto straordinario
    if (tipo === 'REPERIBILITA') {
        const total = calculateTotalDiff(inizio, fine);
        return { ord: 0, stra: total };
    }
    
    // Calcolo fasce orarie
    let [hIn, mIn] = inizio.split(':').map(Number);
    let [hFi, mFi] = fine.split(':').map(Number);
    let startMin = hIn * 60 + mIn;
    let endMin = hFi * 60 + mFi;
    
    if (endMin < startMin) endMin += 1440; // attraversa mezzanotte
    
    let ord = 0, stra = 0;
    for (let m = startMin; m < endMin; m++) {
        const hh = (m / 60) % 24;
        
        // Fasce ordinarie: 8-12 e 13-17
        const isOrd = (hh >= 8 && hh < 12) || (hh >= 13 && hh < 17);
        
        if (isOrd) ord++;
        else stra++;
    }
    
    return { ord: ord / 60, stra: stra / 60 };
}

function calculateTotalDiff(i, f) {
    if (!i || !f) return 0;
    let [h1, m1] = i.split(':').map(Number);
    let [h2, m2] = f.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    return (diff < 0 ? diff + 1440 : diff) / 60;
}

function filtraTabella() {
    console.log('🔍 filtraTabella');
    const search = document.getElementById('search-fogli')?.value.toLowerCase() || '';
    
    if (!search) {
        renderVistaMensile();
        return;
    }
    
    const rows = document.querySelectorAll('#tableBody tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}







function mostraModalNuovoFoglio() {
    console.log('➕ mostraModalNuovoFoglio');
    
    // Popola select tecnici
    popolaSelectTecnici();
    
    // Pulisci il form
    document.getElementById('modal-foglio-titolo').textContent = 'Nuovo Intervento';
    document.getElementById('foglio-id').value = '';
    document.getElementById('foglio-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('foglio-ore-ord').value = '0';
    document.getElementById('foglio-ore-viaggio').value = '0';
    document.getElementById('foglio-note').value = '';
    document.getElementById('foglio-ora-inizio').value = '';
    document.getElementById('foglio-ora-fine').value = '';
    document.getElementById('foglio-impianto').value = '';
    document.getElementById('foglio-indirizzo').value = '';
    
    // Seleziona default tecnico (se presente nei filtri)
    const tecnicoSelezionato = document.getElementById('selectTecnico')?.value;
    if (tecnicoSelezionato) {
        document.getElementById('foglio-tecnico').value = tecnicoSelezionato;
    }
    
    // Reset radio
    const radioOrd = document.querySelector('input[name="foglio-tipo-ore"][value="ORDINARIA"]');
    if (radioOrd) {
        radioOrd.checked = true;
        toggleTipoOreFoglio();
    }
    
    // Rimuovi toggle 8h se presente
    const toggle8h = document.getElementById('toggle-8h');
    if (toggle8h) {
        toggle8h.parentElement?.parentElement?.remove();
    }
    
    document.getElementById('modal-foglio').style.display = 'flex';
}

function chiudiModalFoglio() {
    document.getElementById('modal-foglio').style.display = 'none';
}






// ============================================
// ESPOSIZIONE GLOBALE
// ============================================

window.caricaFogli = caricaFogli;
window.renderVistaMensile = renderVistaMensile;
window.openDettaglioGiorno = openDettaglioGiorno;
window.chiudiDettaglioGiorno = chiudiDettaglioGiorno;
window.filtraTabella = filtraTabella;
window.mostraModalNuovoFoglio = mostraModalNuovoFoglio;
window.chiudiModalFoglio = chiudiModalFoglio;
window.toggleTipoOreFoglio = toggleTipoOreFoglio;
window.calcolaOreFoglio = calcolaOreFoglio;
window.aggiornaTipoDaCodice = aggiornaTipoDaCodice;
window.popolaSelectTecnici = popolaSelectTecnici;
window.toggleTipoOreFoglio = toggleTipoOreFoglio;
window.calcolaOreFoglio = calcolaOreFoglio;
window.aggiornaTipoDaCodice = aggiornaTipoDaCodice;
window.aggiornaTipoDaCodice = aggiornaTipoDaCodice;
window.cercaIndirizzoImpianto = cercaIndirizzoImpianto;



// CRUD
window.salvaFoglio = salvaFoglio;
window.modificaIntervento = modificaIntervento;
window.eliminaIntervento = eliminaIntervento;
window.confermaCancellazioneIntervento = confermaCancellazioneIntervento;
window.chiudiModalCancellazioneIntervento = chiudiModalCancellazioneIntervento;

// Utility
window.popolaSelectTecnici = popolaSelectTecnici;
window.processHours = processHours;
window.calculateTotalDiff = calculateTotalDiff;
window.cercaIndirizzoImpianto = cercaIndirizzoImpianto;
window.toggleGiornataIntera = toggleGiornataIntera;
window.mostraNotifica = mostraNotifica;

console.log('✅ Funzioni globali registrate');
console.log('📋 Funzioni disponibili:', Object.keys(window).filter(k => 
    k.includes('Fogli') || k.includes('foglio') || 
    k.includes('Intervento') || k.includes('modal')
));