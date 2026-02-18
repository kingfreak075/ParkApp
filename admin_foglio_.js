// ============================================
// ADMIN FOGLI LAVORO - STILE FOGLIOLAVORO
// ============================================

console.log('🚀 ADMIN FOGLI - AVVIO');

// Variabili globali
let fogliList = [];
let fogliFiltrati = [];

// Utility
const foglioParseNum = (v) => v ? parseFloat(v.toString().replace(',', '.')) || 0 : 0;
const foglioFormatVal = (v, fz) => {
    if (v === undefined || v === null) return "0,00";
    if (v === 0) return (fz ? "0,00" : "");
    return v.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

// Festività italiane
const foglioGetFestivi = () => ["01-01", "06-01", "25-04", "01-05", "02-06", "15-08", "01-11", "08-12", "25-12", "26-12"];

// Descrizioni codici
const foglioDescCodici = {
    "072": "Assemblea", "073": "Sciopero", "075": "Ferie", "076": "Festività", "077": "Malattia", 
    "078": "Infortunio", "079": "Donazione Sangue", "080": "Allattamento", "081": "Congedo Matr.",
    "082": "Permesso Retr.", "083": "Permesso NON Retr.", "084": "Legge 104", "085": "Elettorale",
    "086": "Lutto", "087": "Sindacale", "088": "Studio", "089": "Volontariato", 
    "090": "Malattia Figlio <3", "091": "Malattia Figlio >3", "092": "Corso Formazione"
};

// ============================================
// CARICAMENTO DATI
// ============================================

async function caricaFogli() {
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

    } catch (error) {
        console.error('❌ Errore caricamento fogli:', error);
        mostraNotifica('Errore nel caricamento dei fogli lavoro', 'error');
    }
}

function popolaSelectTecnici() {
    const selectTecnico = document.getElementById('foglio-tecnico');
    if (!selectTecnico) return;
    
    const tecnici = [...new Set(fogliList.map(d => d.tecnico))].filter(Boolean).sort();
    
    let html = '<option value="">Seleziona tecnico</option>';
    tecnici.forEach(t => {
        html += `<option value="${t}">${t}</option>`;
    });
    
    selectTecnico.innerHTML = html;
}

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

// ============================================
// RENDERING VISTA MENSILE
// ============================================

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
        
        if (codR >= 72 && codR <= 91) {
            raggruppati[g].ass += oreR;
        } else {
            raggruppati[g].ord += oreR;
        }
        
        raggruppati[g].stra += foglioParseNum(r.ore_stra);
        raggruppati[g].vgg += foglioParseNum(r.ore_viaggio);
        
        const cKey = codR.toString().padStart(3, '0');
        if (foglioDescCodici[cKey]) {
            raggruppati[g].desc.add(foglioDescCodici[cKey] + ` (${cKey})`);
        }
        
        raggruppati[g].list.push(r);
    });
    
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
        
        const orePreviste = (isSabato || isDomenica || isFestivo) ? 0 : 8;
        totPreviste += orePreviste;
        
        const day = raggruppati[i] || { ord: 0, ass: 0, stra: 0, vgg: 0, desc: new Set(), list: [] };
        
        totLavorate += day.ord;
        totAssenze += day.ass;
        totStra += day.stra;
        totVgg += day.vgg;
        
        const totGiorno = day.ord + day.ass;
        
        let rowClass = isFestivo ? "bg-festivo" : (isDomenica ? "bg-domenica" : (isSabato ? "bg-sabato" : ""));
        let ordStyle = orePreviste > 0 ? (totGiorno === 8 ? "text-ok" : "text-anomaly") : (totGiorno > 0 ? "text-anomaly" : "");
        const fz = (orePreviste === 8 && totGiorno === 0);
        
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
    foglioAggiornaStatistiche(totLavorate, totAssenze, totStra, totVgg, totPreviste);
}

function foglioAggiornaStatistiche(lavorate, assenze, stra, vgg, previste) {
    document.getElementById('sumOrd').innerText = foglioFormatVal(lavorate);
    document.getElementById('sumAss').innerText = foglioFormatVal(assenze);
    document.getElementById('sumStra').innerText = foglioFormatVal(stra);
    document.getElementById('sumVgg').innerText = foglioFormatVal(vgg);
    
    const totale = lavorate + assenze;
    const ratioEl = document.getElementById('totalRatio');
    if (ratioEl) {
        ratioEl.innerText = `${foglioFormatVal(totale)} / ${foglioFormatVal(previste)}`;
        ratioEl.className = `text-sm font-black italic ${Math.abs(totale - previste) < 0.01 ? 'text-green-600' : 'text-red-600'}`;
    }
}

// ============================================
// DETTAGLIO GIORNALIERO
// ============================================

function openDettaglioGiorno(interventi, dataStr, tecnico) {
    console.log('📅 openDettaglioGiorno', dataStr, tecnico);
    
    if (!interventi || interventi.length === 0) return;
    
    const configTipi = {
        "MONTAGGIO": { bg: "#f0f9ff", border: "#bae6fd", icon: "🔧", order: 2 },
        "ORDINARIA": { bg: "#f8fafc", border: "#e2e8f0", icon: "🟢", order: 1 },
        "ALTRO": { bg: "#f0fdf4", border: "#a7f3d0", icon: "📌", order: 4 },
        "REPERIBILITA": { bg: "#fef2f2", border: "#fecaca", icon: "🚨", order: 3 },
        "STRAORDINARIO": { bg: "#fff7ed", border: "#fed7aa", icon: "⏱️", order: 3 }
    };
    
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
    
    const interventiOrdinati = [...interventi].sort((a, b) => {
        const tipoA = a.ch_rep || 'ALTRO';
        const tipoB = b.ch_rep || 'ALTRO';
        const orderA = configTipi[tipoA]?.order || 4;
        const orderB = configTipi[tipoB]?.order || 4;
        return orderA - orderB;
    });
    
    let modal = document.getElementById('modal-dettaglio-giorno');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-dettaglio-giorno';
        modal.className = 'modal';
        modal.setAttribute('onclick', 'chiudiDettaglioGiorno()');
        modal.innerHTML = `
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3 id="modal-giorno-titolo">Dettaglio Giornata</h3>
                    <button class="btn-icon-small" onclick="chiudiDettaglioGiorno()">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
                <div class="modal-body" id="modal-giorno-body"></div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="chiudiDettaglioGiorno()">Chiudi</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
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
    
    let bodyHtml = '';
    interventiOrdinati.forEach((item, index) => {
        const tipo = String(item.ch_rep || "ALTRO").trim().toUpperCase();
        const style = configTipi[tipo] || { bg: "#f8fafc", border: "#e2e8f0", icon: "📄", order: 4 };
        
        const oreOrd = foglioParseNum(item.ore_ord);
        const oreStra = foglioParseNum(item.ore_stra);
        const oreVgg = foglioParseNum(item.ore_viaggio);
        
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
                ${index < interventiOrdinati.length - 1 ? '<div style="position: absolute; left: 19px; top: 30px; bottom: -20px; width: 2px; background: #e2e8f0;"></div>' : ''}
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
// FILTRO RICERCA
// ============================================

function filtraTabella() {
    const search = document.getElementById('search-fogli')?.value.toLowerCase() || '';
    
    if (!search) {
        renderVistaMensile();
        return;
    }
    
    const tecnico = document.getElementById('selectTecnico')?.value;
    const mese = parseInt(document.getElementById('selectMese')?.value);
    const anno = parseInt(document.getElementById('selectAnno')?.value);
    
    if (!tecnico) return;
    
    const rows = document.querySelectorAll('#tableBody tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

// ============================================
// NOTIFICHE
// ============================================

function mostraNotifica(messaggio, tipo = 'info') {
    const notificaEsistente = document.querySelector('.notifica-toast');
    if (notificaEsistente) notificaEsistente.remove();
    
    const notifica = document.createElement('div');
    notifica.className = 'notifica-toast';
    
    let icona = 'info';
    let colore = '#3B82F6';
    
    if (tipo === 'success') {
        icona = 'check_circle';
        colore = '#22c55e';
    } else if (tipo === 'error') {
        icona = 'error';
        colore = '#ef4444';
    } else if (tipo === 'warning') {
        icona = 'warning';
        colore = '#f59e0b';
    }
    
    notifica.innerHTML = `
        <span class="material-symbols-rounded" style="font-size: 20px;">${icona}</span>
        <span style="flex: 1; font-weight: 500;">${messaggio}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; opacity: 0.7;">
            <span class="material-symbols-rounded" style="font-size: 18px;">close</span>
        </button>
    `;
    
    notifica.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colore};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        max-width: 450px;
        z-index: 10000;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        animation: slideIn 0.3s ease;
        border-left: 4px solid rgba(255,255,255,0.3);
    `;
    
    document.body.appendChild(notifica);
    
    setTimeout(() => {
        if (notifica.parentNode) {
            notifica.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notifica.remove(), 300);
        }
    }, 4000);
}

// ============================================
// FUNZIONI MODAL NUOVO/MODIFICA INTERVENTO
// ============================================

function mostraModalNuovoFoglio() {
    console.log('➕ mostraModalNuovoFoglio');
    
    popolaSelectTecnici();
    
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
    
    const tecnicoSelezionato = document.getElementById('selectTecnico')?.value;
    if (tecnicoSelezionato) {
        document.getElementById('foglio-tecnico').value = tecnicoSelezionato;
    }
    
    const radioOrd = document.querySelector('input[name="foglio-tipo-ore"][value="ORDINARIA"]');
    if (radioOrd) {
        radioOrd.checked = true;
        toggleTipoOreFoglio();
    }
    
    document.getElementById('modal-foglio').style.display = 'flex';
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

function chiudiModalFoglio() {
    document.getElementById('modal-foglio').style.display = 'none';
}

function toggleTipoOreFoglio() {
    const tipo = document.querySelector('input[name="foglio-tipo-ore"]:checked')?.value || 'ORDINARIA';
    const isOrdinaria = tipo === 'ORDINARIA' || tipo === 'ALTRO';
    
    const boxOreDirette = document.getElementById('foglio-box-ore-dirette');
    const boxOrari = document.getElementById('foglio-box-orari');
    
    if (boxOreDirette) boxOreDirette.style.display = isOrdinaria ? 'block' : 'none';
    if (boxOrari) boxOrari.style.display = isOrdinaria ? 'none' : 'block';
    
    if (tipo === 'ALTRO') {
        const toggle8h = document.getElementById('toggle-8h');
        if (toggle8h) {
            toggle8h.parentElement?.parentElement?.style.display = 'block';
        }
    }
}

function calcolaOreFoglio() {
    const inizio = document.getElementById('foglio-ora-inizio')?.value;
    const fine = document.getElementById('foglio-ora-fine')?.value;
    const dataVal = document.getElementById('foglio-data')?.value;
    const tipo = document.querySelector('input[name="foglio-tipo-ore"]:checked')?.value || 'ORDINARIA';
    
    if (!inizio || !fine || !dataVal) return;
    
    const res = processHours(inizio, fine, tipo, new Date(dataVal).getDay());
    
    const calcOrd = document.getElementById('foglio-calcolo-ord');
    const calcStra = document.getElementById('foglio-calcolo-stra');
    
    if (calcOrd) calcOrd.textContent = res.ord.toFixed(2);
    if (calcStra) calcStra.textContent = res.stra.toFixed(2);
}

function processHours(inizio, fine, tipo, dayOfWeek) {
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        const total = calculateTotalDiff(inizio, fine);
        return { ord: 0, stra: total };
    }
    
    if (tipo === 'REPERIBILITA') {
        const total = calculateTotalDiff(inizio, fine);
        return { ord: 0, stra: total };
    }
    
    let [hIn, mIn] = inizio.split(':').map(Number);
    let [hFi, mFi] = fine.split(':').map(Number);
    let startMin = hIn * 60 + mIn;
    let endMin = hFi * 60 + mFi;
    
    if (endMin < startMin) endMin += 1440;
    
    let ord = 0, stra = 0;
    for (let m = startMin; m < endMin; m++) {
        const hh = (m / 60) % 24;
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

function aggiornaTipoDaCodice() {
    const codice = document.getElementById('foglio-codice')?.value;
    const boxViaggio = document.getElementById('foglio-ore-viaggio')?.parentElement?.parentElement;
    const tipoOreContainer = document.querySelector('div[name="foglio-tipo-ore"]')?.parentElement;
    
    if (boxViaggio) boxViaggio.style.display = 'block';
    if (tipoOreContainer) tipoOreContainer.style.display = 'block';
    
    if (codice && codice >= '072' && codice <= '092') {
        console.log('📌 Codice assenza selezionato:', codice);
        
        const radioAltro = document.querySelector('input[name="foglio-tipo-ore"][value="ALTRO"]');
        if (radioAltro) {
            radioAltro.checked = true;
            toggleTipoOreFoglio();
        }
        
        const radioContainer = document.querySelector('div[name="foglio-tipo-ore"]')?.parentElement;
        if (radioContainer) {
            radioContainer.style.display = 'none';
        }
        
        if (boxViaggio) {
            boxViaggio.style.display = 'none';
        }
        
        const container = document.getElementById('foglio-box-ore-dirette');
        if (container) {
            if (!document.getElementById('toggle-8h')) {
                const toggleDiv = document.createElement('div');
                toggleDiv.style.marginTop = '10px';
                toggleDiv.style.padding = '10px';
                toggleDiv.style.background = '#f8fafc';
                toggleDiv.style.borderRadius = '8px';
                toggleDiv.style.border = '1px solid #e2e8f0';
                toggleDiv.innerHTML = `
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="toggle-8h" onchange="toggleGiornataIntera(this.checked)">
                        <span style="font-weight: 600;">Giornata intera (8 ore)</span>
                    </label>
                `;
                container.appendChild(toggleDiv);
            }
        }
        
    } else {
        const toggle8h = document.getElementById('toggle-8h');
        if (toggle8h) {
            toggle8h.parentElement?.parentElement?.remove();
        }
        
        if (boxViaggio) boxViaggio.style.display = 'block';
        if (tipoOreContainer) tipoOreContainer.style.display = 'block';
    }
}

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
            const { error } = await supabase
                .from('fogliolavoro')
                .update(payload)
                .eq('ID', id);
            
            if (error) throw error;
            mostraNotifica('Intervento aggiornato con successo', 'success');
        } else {
            const { error } = await supabase
                .from('fogliolavoro')
                .insert([payload]);
            
            if (error) throw error;
            mostraNotifica('Intervento salvato con successo', 'success');
        }
        
        chiudiModalFoglio();
        await caricaFogli();
        renderVistaMensile();
        
        if (id) {
            const dataGiorno = `${giorno.toString().padStart(2,'0')}/${mese.toString().padStart(2,'0')}/${anno}`;
            const interventiGiorno = fogliList.filter(f => 
                f.tecnico === tecnico && 
                f.anno === anno && 
                f.mese === mese && 
                f.giorno === giorno
            );
            
            if (interventiGiorno.length > 0) {
                openDettaglioGiorno(interventiGiorno, dataGiorno, tecnico);
            }
        }
        
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
        
        if (dataInterventoDaEliminare) {
            const [giorno, mese, anno] = dataInterventoDaEliminare.split('/').map(Number);
            const tecnico = document.getElementById('selectTecnico')?.value;
            
            if (tecnico) {
                const interventiGiorno = fogliList.filter(f => 
                    f.tecnico === tecnico && 
                    f.anno === anno && 
                    f.mese === mese && 
                    f.giorno === giorno
                );
                
                if (interventiGiorno.length > 0) {
                    openDettaglioGiorno(interventiGiorno, dataInterventoDaEliminare, tecnico);
                }
            }
        }
        
        mostraNotifica('Intervento eliminato con successo', 'success');
        
    } catch (error) {
        console.error('❌ Errore eliminazione:', error);
        mostraNotifica(`Errore: ${error.message}`, 'error');
    } finally {
        interventoDaEliminare = null;
        dataInterventoDaEliminare = null;
    }
}

function chiudiModalCancellazioneIntervento() {
    interventoDaEliminare = null;
    dataInterventoDaEliminare = null;
    
    const msgEl = document.querySelector('#modal-conferma-cancellazione-ann .modal-body');
    if (msgEl) {
        msgEl.innerHTML = `
            <span class="material-symbols-rounded" style="font-size: 48px; color: #ef4444; margin-bottom: 1rem;">warning</span>
            <h3 style="margin: 0 0 0.5rem 0;">Conferma cancellazione</h3>
            <p style="color: #64748b; margin-bottom: 1.5rem;">Sei sicuro di voler cancellare questo intervento?</p>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary" style="flex: 1;" onclick="chiudiModalCancellazioneIntervento()">Annulla</button>
                <button class="btn btn-danger" style="flex: 1;" onclick="confermaCancellazioneIntervento()">Cancella</button>
            </div>
        `;
    }
    
    const modal = document.getElementById('modal-conferma-cancellazione-ann');
    if (modal) modal.style.display = 'none';
}

async function cercaIndirizzoImpianto() {
    const impiantoInput = document.getElementById('foglio-impianto')?.value.trim();
    const codiceSelect = document.getElementById('foglio-codice')?.value;
    const indirizzoField = document.getElementById('foglio-indirizzo');
    
    if (!impiantoInput || !codiceSelect || !indirizzoField) return;
    
    indirizzoField.placeholder = 'Ricerca in corso...';
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        let indirizzoTrovato = '';
        
        if (['21', '22', '24', '13', '10'].includes(codiceSelect)) {
            const { data, error } = await supabase
                .from('Parco_app')
                .select('Indirizzo, localit, prov')
                .eq('impianto', impiantoInput)
                .maybeSingle();
            
            if (error) throw error;
            
            if (data) {
                const parti = [];
                if (data.Indirizzo) parti.push(data.Indirizzo);
                if (data.localit) parti.push(data.localit);
                if (data.prov) parti.push(data.prov);
                indirizzoTrovato = parti.join(' - ');
            }
            
        } else if (['001', '007'].includes(codiceSelect)) {
            const { data, error } = await supabase
                .from('montaggi')
                .select('Indirizzo')
                .eq('impianto', impiantoInput)
                .maybeSingle();
            
            if (error) throw error;
            
            if (data && data.Indirizzo) {
                indirizzoTrovato = data.Indirizzo;
            }
        }
        
        if (indirizzoTrovato) {
            indirizzoField.value = indirizzoTrovato;
            mostraNotifica('Indirizzo trovato e compilato', 'success');
        } else {
            mostraNotifica('Impianto non trovato', 'warning');
        }
        
    } catch (error) {
        console.error('❌ Errore ricerca impianto:', error);
        mostraNotifica('Errore nella ricerca dell\'impianto', 'error');
    } finally {
        indirizzoField.placeholder = 'Via, città...';
    }
}

function popolaSelectTecnici() {
    const selectTecnico = document.getElementById('foglio-tecnico');
    if (!selectTecnico) return;
    
    const tecnici = [...new Set(fogliList.map(d => d.tecnico))].filter(Boolean).sort();
    
    let html = '<option value="">Seleziona tecnico</option>';
    tecnici.forEach(t => {
        html += `<option value="${t}">${t}</option>`;
    });
    
    selectTecnico.innerHTML = html;
}

function processHours(inizio, fine, tipo, dayOfWeek) {
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        const total = calculateTotalDiff(inizio, fine);
        return { ord: 0, stra: total };
    }
    
    if (tipo === 'REPERIBILITA') {
        const total = calculateTotalDiff(inizio, fine);
        return { ord: 0, stra: total };
    }
    
    let [hIn, mIn] = inizio.split(':').map(Number);
    let [hFi, mFi] = fine.split(':').map(Number);
    let startMin = hIn * 60 + mIn;
    let endMin = hFi * 60 + mFi;
    
    if (endMin < startMin) endMin += 1440;
    
    let ord = 0, stra = 0;
    for (let m = startMin; m < endMin; m++) {
        const hh = (m / 60) % 24;
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

async function cercaIndirizzoImpianto() {
    const impiantoInput = document.getElementById('foglio-impianto')?.value.trim();
    const codiceSelect = document.getElementById('foglio-codice')?.value;
    const indirizzoField = document.getElementById('foglio-indirizzo');
    
    if (!impiantoInput || !codiceSelect || !indirizzoField) return;
    
    indirizzoField.placeholder = 'Ricerca in corso...';
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        let indirizzoTrovato = '';
        
        if (['21', '22', '24', '13', '10'].includes(codiceSelect)) {
            const { data, error } = await supabase
                .from('Parco_app')
                .select('Indirizzo, localit, prov')
                .eq('impianto', impiantoInput)
                .maybeSingle();
            
            if (error) throw error;
            
            if (data) {
                const parti = [];
                if (data.Indirizzo) parti.push(data.Indirizzo);
                if (data.localit) parti.push(data.localit);
                if (data.prov) parti.push(data.prov);
                indirizzoTrovato = parti.join(' - ');
            }
            
        } else if (['001', '007'].includes(codiceSelect)) {
            const { data, error } = await supabase
                .from('montaggi')
                .select('Indirizzo')
                .eq('impianto', impiantoInput)
                .maybeSingle();
            
            if (error) throw error;
            
            if (data && data.Indirizzo) {
                indirizzoTrovato = data.Indirizzo;
            }
        }
        
        if (indirizzoTrovato) {
            indirizzoField.value = indirizzoTrovato;
            mostraNotifica('Indirizzo trovato e compilato', 'success');
        } else {
            mostraNotifica('Impianto non trovato', 'warning');
        }
        
    } catch (error) {
        console.error('❌ Errore ricerca impianto:', error);
        mostraNotifica('Errore nella ricerca dell\'impianto', 'error');
    } finally {
        indirizzoField.placeholder = 'Via, città...';
    }
}

function modificaIntervento(id) {
    console.log('✏️ modificaIntervento', id);
    
    // Chiudi il modal giornaliero
    const modalGiornaliero = document.getElementById('modal-dettaglio-giorno');
    if (modalGiornaliero) {
        modalGiornaliero.style.display = 'none';
    }
    
    // Popola select tecnici
    popolaSelectTecnici();
    
    // Trova l'intervento
    const intervento = fogliList.find(f => f.ID == id);
    if (!intervento) {
        console.error('Intervento non trovato', id);
        return;
    }
    
    // Popola il form
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

function mostraNotifica(messaggio, tipo = 'info') {
    // Rimuovi notifiche esistenti
    const notificaEsistente = document.querySelector('.notifica-toast');
    if (notificaEsistente) notificaEsistente.remove();
    
    const notifica = document.createElement('div');
    notifica.className = 'notifica-toast';
    
    let icona = 'info';
    let colore = '#3B82F6';
    
    if (tipo === 'success') {
        icona = 'check_circle';
        colore = '#22c55e';
    } else if (tipo === 'error') {
        icona = 'error';
        colore = '#ef4444';
    } else if (tipo === 'warning') {
        icona = 'warning';
        colore = '#f59e0b';
    }
    
    notifica.innerHTML = `
        <span class="material-symbols-rounded" style="font-size: 20px;">${icona}</span>
        <span style="flex: 1; font-weight: 500;">${messaggio}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; opacity: 0.7;">
            <span class="material-symbols-rounded" style="font-size: 18px;">close</span>
        </button>
    `;
    
    notifica.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colore};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        max-width: 450px;
        z-index: 10000;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        animation: slideIn 0.3s ease;
        border-left: 4px solid rgba(255,255,255,0.3);
    `;
    
    document.body.appendChild(notifica);
    
    setTimeout(() => {
        if (notifica.parentNode) {
            notifica.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notifica.remove(), 300);
        }
    }, 4000);
}


// ============================================
// ESPOSIZIONE GLOBALE
// ============================================
window.popolaSelectTecnici = popolaSelectTecnici;
window.processHours = processHours;
window.calculateTotalDiff = calculateTotalDiff;
window.cercaIndirizzoImpianto = cercaIndirizzoImpianto;
window.modificaIntervento = modificaIntervento;
window.salvaFoglio = salvaFoglio;
window.eliminaIntervento = eliminaIntervento;
window.confermaCancellazioneIntervento = confermaCancellazioneIntervento;
window.chiudiModalCancellazioneIntervento = chiudiModalCancellazioneIntervento;
window.toggleGiornataIntera = toggleGiornataIntera;
window.mostraNotifica = mostraNotifica;
window.caricaFogli = caricaFogli;
window.renderVistaMensile = renderVistaMensile;
window.openDettaglioGiorno = openDettaglioGiorno;
window.chiudiDettaglioGiorno = chiudiDettaglioGiorno;
window.filtraTabella = filtraTabella;
window.mostraModalNuovoFoglio = mostraModalNuovoFoglio;
window.modificaIntervento = modificaIntervento;
window.chiudiModalFoglio = chiudiModalFoglio;
window.toggleTipoOreFoglio = toggleTipoOreFoglio;
window.calcolaOreFoglio = calcolaOreFoglio;
window.aggiornaTipoDaCodice = aggiornaTipoDaCodice;
window.salvaFoglio = salvaFoglio;
window.eliminaIntervento = eliminaIntervento;
window.confermaCancellazioneIntervento = confermaCancellazioneIntervento;
window.chiudiModalCancellazioneIntervento = chiudiModalCancellazioneIntervento;
window.cercaIndirizzoImpianto = cercaIndirizzoImpianto;
window.toggleGiornataIntera = toggleGiornataIntera;
window.mostraNotifica = mostraNotifica;
window.popolaSelectTecnici = popolaSelectTecnici;
window.processHours = processHours;
window.calculateTotalDiff = calculateTotalDiff;

console.log('✅ Funzioni globali registrate');