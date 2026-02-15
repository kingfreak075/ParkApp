// ============================================
// ADMIN FOGLI LAVORO - FLOX ADMIN
// GESTIONE COMPLETA FOGLI LAVORO CON RIEPILOGHI
// ============================================

console.log('🚀 ADMIN FOGLI - CARICAMENTO IN CORSO');

// Variabili globali
let fogliList = [];
let fogliFiltrati = [];
let foglioTecniciList = [];  // <-- RINOMINATO
let foglioCodiciList = [];    // <-- RINOMINATO
let fogliSelezionati = new Set();
let vistaCorrente = 'riepilogo';
let tipoRiepilogoCorrente = 'mensile';

// ============================================
// ESPOSIZIONE FUNZIONI GLOBALI IMMEDIATA
// ============================================

// DICHIARAZIONE FUNZIONI VUOTE (verranno sovrascritte dopo)




console.log('✅ Funzioni globali placeholder registrate');
// Mappe colori
const coloriCodice = {
    // Lavori (blu)
    '21': { bg: '#3B82F620', text: '#1E40AF' },
    '22': { bg: '#3B82F620', text: '#1E40AF' },
    '24': { bg: '#3B82F620', text: '#1E40AF' },
    '13': { bg: '#3B82F620', text: '#1E40AF' },
    '10': { bg: '#3B82F620', text: '#1E40AF' },
    // Montaggi (viola)
    '001': { bg: '#8B5CF620', text: '#6B21A8' },
    '007': { bg: '#8B5CF620', text: '#6B21A8' },
    // Assenze (arancione)
    '072': { bg: '#F59E0B20', text: '#92400E' },
    '073': { bg: '#F59E0B20', text: '#92400E' },
    '075': { bg: '#F59E0B20', text: '#92400E' },
    '076': { bg: '#F59E0B20', text: '#92400E' },
    '077': { bg: '#F59E0B20', text: '#92400E' },
    '078': { bg: '#F59E0B20', text: '#92400E' },
    '079': { bg: '#F59E0B20', text: '#92400E' },
    '080': { bg: '#F59E0B20', text: '#92400E' },
    '081': { bg: '#F59E0B20', text: '#92400E' },
    '082': { bg: '#F59E0B20', text: '#92400E' },
    '083': { bg: '#F59E0B20', text: '#92400E' },
    '084': { bg: '#F59E0B20', text: '#92400E' },
    '085': { bg: '#F59E0B20', text: '#92400E' },
    '086': { bg: '#F59E0B20', text: '#92400E' },
    '087': { bg: '#F59E0B20', text: '#92400E' },
    '088': { bg: '#F59E0B20', text: '#92400E' },
    '089': { bg: '#F59E0B20', text: '#92400E' },
    '090': { bg: '#F59E0B20', text: '#92400E' },
    '091': { bg: '#F59E0B20', text: '#92400E' },
    '092': { bg: '#F59E0B20', text: '#92400E' }
};

const coloriTipo = {
    'ORDINARIA': { bg: '#22C55E20', text: '#166534' },
    'STRAORDINARIO': { bg: '#F9731620', text: '#9A3412' },
    'REPERIBILITA': { bg: '#EF444420', text: '#991B1B' },
    'MONTAGGIO': { bg: '#8B5CF620', text: '#6B21A8' },
    'ALTRO': { bg: '#F59E0B20', text: '#92400E' }
};

// ============================================
// INIZIALIZZAZIONE
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Inizializzazione Admin Fogli Lavoro...');
    
    // Imposta date di default per i filtri (ultimi 30 giorni)
    const oggi = new Date().toISOString().split('T')[0];
    const trentaGiorniFa = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    document.getElementById('filtro-data-da').value = trentaGiorniFa;
    document.getElementById('filtro-data-a').value = oggi;
    
    // Setup drop zone per CSV
    setupDropZoneFogli();
    
    // Event listener per file input
    document.getElementById('file-fogli-csv').addEventListener('change', handleFileSelectFogli);
    
    console.log('✅ Admin Fogli Lavoro inizializzato');
});

// ============================================
// CARICAMENTO DATI
// ============================================

async function caricaFogli() {
    try {
        console.log('📥 Caricamento fogli lavoro...');
        
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { data, error } = await supabase
            .from('fogliolavoro')
            .select('*')
            .order('anno', { ascending: false })
            .order('mese', { ascending: false })
            .order('giorno', { ascending: false });
        
        if (error) throw error;
        
        fogliList = data || [];
        fogliFiltrati = [...fogliList];
        
        console.log(`✅ Caricati ${fogliList.length} fogli lavoro`);
        
        // Estrai tecnici e codici unici
        aggiornaListeUniche();
        
        // Aggiorna UI
        aggiornaStatisticheFogli();
        aggiornaFiltriFogli();
        
        if (vistaCorrente === 'riepilogo') {
            aggiornaRiepilogo();
        } else {
            renderizzaTabellaFogli();
        }
        
    } catch (error) {
        console.error('❌ Errore caricamento fogli:', error);
        mostraNotifica('Errore nel caricamento dei fogli lavoro', 'error');
    }
}

function aggiornaListeUniche() {
    const tecniciSet = new Set();
    const codiciSet = new Set();
    
    fogliList.forEach(f => {
        if (f.tecnico && f.tecnico.trim() !== '') {
            tecniciSet.add(f.tecnico);
        }
        if (f.codice) {
            codiciSet.add(f.codice.toString());
        }
    });
    
    foglioTecniciList = Array.from(tecniciSet).sort();
    foglioCodiciList = Array.from(codiciSet).sort((a, b) => {
        // Ordina: numeri prima, poi lettere
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        if (!isNaN(aNum)) return -1;
        if (!isNaN(bNum)) return 1;
        return a.localeCompare(b);
    });
}

function aggiornaStatisticheFogli() {
    // Totale fogli
    document.getElementById('stat-totale-fogli').textContent = fogliList.length;
    
    // Ore totali
    const oreTotali = fogliList.reduce((sum, f) => {
        return sum + (parseFloat(f.ore) || 0);
    }, 0);
    document.getElementById('stat-ore-totali').textContent = formatOre(oreTotali);
    
    // Tecnici attivi (ultimi 30 giorni)
    const trentaGiorniFa = new Date();
    trentaGiorniFa.setDate(trentaGiorniFa.getDate() - 30);
    
    const tecniciAttivi = new Set();
    fogliList.forEach(f => {
        const dataFoglio = new Date(f.anno, f.mese - 1, f.giorno);
        if (dataFoglio >= trentaGiorniFa && f.tecnico) {
            tecniciAttivi.add(f.tecnico);
        }
    });
    document.getElementById('stat-tecnici-attivi').textContent = tecniciAttivi.size;
    
    // Ore oggi
    const oggi = new Date();
    const oggiStr = `${oggi.getDate()}/${oggi.getMonth()+1}/${oggi.getFullYear()}`;
    const oreOggi = fogliList.reduce((sum, f) => {
        if (f.giorno === oggi.getDate() && 
            f.mese === oggi.getMonth() + 1 && 
            f.anno === oggi.getFullYear()) {
            return sum + (parseFloat(f.ore) || 0);
        }
        return sum;
    }, 0);
    document.getElementById('stat-oggi').textContent = formatOre(oreOggi);
}

function aggiornaFiltriFogli() {
    // Filtro tecnico
    const selectTecnico = document.getElementById('filtro-tecnico-fogli');
    let htmlTecnico = '<option value="">Tutti</option>';
    foglioTecniciList.forEach(t => {
        htmlTecnico += `<option value="${t}">${t}</option>`;
    });
    selectTecnico.innerHTML = htmlTecnico;
    
    // Filtro codice
    const selectCodice = document.getElementById('filtro-codice-fogli');
    let htmlCodice = '<option value="">Tutti</option>';
    foglioCodiciList.forEach(c => {
        let descrizione = getDescrizioneCodice(c);
        htmlCodice += `<option value="${c}">${c} - ${descrizione}</option>`;
    });
    selectCodice.innerHTML = htmlCodice;
    
    // Select tecnico nel modal
    const modalTecnico = document.getElementById('foglio-tecnico');
    let htmlModalTecnico = '<option value="">Seleziona tecnico</option>';
    foglioTecniciList.forEach(t => {
        htmlModalTecnico += `<option value="${t}">${t}</option>`;
    });
    modalTecnico.innerHTML = htmlModalTecnico;
}

function getDescrizioneCodice(codice) {
    const descrizioni = {
        '21': 'Manutenzione',
        '22': 'Chiamata',
        '24': 'Enti',
        '13': 'Riparazione',
        '10': 'Q2SA',
        '001': 'Montaggio',
        '007': 'Montaggio',
        '072': 'Assemblea',
        '073': 'Sciopero',
        '075': 'Ferie',
        '076': 'Festività',
        '077': 'Malattia',
        '078': 'Infortunio',
        '079': 'Donazione Sangue',
        '080': 'Allattamento',
        '081': 'Congedo Matrimoniale',
        '082': 'Permesso Retribuito',
        '083': 'Permesso NON Retribuito',
        '084': 'Permesso Legge 104',
        '085': 'Permesso Elettorale',
        '086': 'Permesso Lutto',
        '087': 'Permesso Sindacale',
        '088': 'Permesso Studio',
        '089': 'Permesso Volontariato',
        '090': 'Spese Generali',
        '091': 'Altro Retribuito',
        '092': 'Addestramento'
    };
    return descrizioni[codice] || 'Altro';
}

// ============================================
// FUNZIONI VISTA
// ============================================

function switchVistaFogli(vista) {
    vistaCorrente = vista;
    
    // Aggiorna bottoni
    document.getElementById('btn-vista-riepilogo').classList.toggle('active', vista === 'riepilogo');
    document.getElementById('btn-vista-dettaglio').classList.toggle('active', vista === 'dettaglio');
    
    // Mostra/nascondi viste
    document.getElementById('vista-riepilogo-fogli').style.display = vista === 'riepilogo' ? 'block' : 'none';
    document.getElementById('vista-dettaglio-fogli').style.display = vista === 'dettaglio' ? 'block' : 'none';
    
    // Aggiorna contenuto
    if (vista === 'riepilogo') {
        aggiornaRiepilogo();
    } else {
        renderizzaTabellaFogli();
    }
}

function switchTipoRiepilogo(tipo) {
    tipoRiepilogoCorrente = tipo;
    
    document.getElementById('btn-riep-mensile').classList.toggle('active', tipo === 'mensile');
    document.getElementById('btn-riep-giornaliero').classList.toggle('active', tipo === 'giornaliero');
    
    document.getElementById('riepilogo-mensile').style.display = tipo === 'mensile' ? 'block' : 'none';
    document.getElementById('riepilogo-giornaliero').style.display = tipo === 'giornaliero' ? 'block' : 'none';
    
    aggiornaRiepilogo();
}

function filtraFogli() {
    const tecnico = document.getElementById('filtro-tecnico-fogli').value;
    const dataDa = document.getElementById('filtro-data-da').value;
    const dataA = document.getElementById('filtro-data-a').value;
    const codice = document.getElementById('filtro-codice-fogli').value;
    const tipo = document.getElementById('filtro-tipo-fogli').value;
    const search = document.getElementById('search-fogli')?.value.toLowerCase() || '';
    
    fogliFiltrati = fogliList.filter(f => {
        // Filtro tecnico
        if (tecnico && f.tecnico !== tecnico) return false;
        
        // Filtro codice
        if (codice && f.codice?.toString() !== codice) return false;
        
        // Filtro tipo
        if (tipo && f.ch_rep !== tipo) return false;
        
        // Filtro data
        if (dataDa || dataA) {
            const dataF = new Date(f.anno, f.mese - 1, f.giorno);
            if (dataDa) {
                const dataDaObj = new Date(dataDa);
                if (dataF < dataDaObj) return false;
            }
            if (dataA) {
                const dataAObj = new Date(dataA);
                if (dataF > dataAObj) return false;
            }
        }
        
        // Filtro ricerca
        if (search) {
            const searchable = [
                f.impianto || '',
                f.indirizzo || '',
                f.note || ''
            ].join(' ').toLowerCase();
            return searchable.includes(search);
        }
        
        return true;
    });
    
    if (vistaCorrente === 'riepilogo') {
        aggiornaRiepilogo();
    } else {
        renderizzaTabellaFogli();
    }
}

// ============================================
// FUNZIONI RIEPILOGO
// ============================================

function aggiornaRiepilogo() {
    if (tipoRiepilogoCorrente === 'mensile') {
        aggiornaRiepilogoMensile();
    } else {
        aggiornaRiepilogoGiornaliero();
    }
}

function aggiornaRiepilogoMensile() {
    const riepilogo = {};
    
    fogliFiltrati.forEach(f => {
        const key = `${f.tecnico}|${f.mese}|${f.anno}`;
        
        if (!riepilogo[key]) {
            riepilogo[key] = {
                tecnico: f.tecnico,
                mese: f.mese,
                anno: f.anno,
                oreOrd: 0,
                oreStra: 0,
                oreViaggio: 0,
                totaleOre: 0,
                interventi: 0
            };
        }
        
        riepilogo[key].oreOrd += parseFloat(f.ore_ord) || 0;
        riepilogo[key].oreStra += parseFloat(f.ore_stra) || 0;
        riepilogo[key].oreViaggio += parseFloat(f.ore_viaggio) || 0;
        riepilogo[key].totaleOre += parseFloat(f.ore) || 0;
        riepilogo[key].interventi++;
    });
    
    const riepilogoArray = Object.values(riepilogo).sort((a, b) => {
 // Gestisci null
    const tecnicoA = a.tecnico || '';
    const tecnicoB = b.tecnico || '';
    
    if (tecnicoA !== tecnicoB) return tecnicoA.localeCompare(tecnicoB);
    if (a.anno !== b.anno) return b.anno - a.anno;
    return b.mese - a.mese;
});
    
    renderizzaRiepilogoMensile(riepilogoArray);
}

function aggiornaRiepilogoGiornaliero() {
    const riepilogo = {};
    
    fogliFiltrati.forEach(f => {
        const key = `${f.tecnico}|${f.anno}|${f.mese}|${f.giorno}`;
        
        if (!riepilogo[key]) {
            riepilogo[key] = {
                tecnico: f.tecnico,
                giorno: f.giorno,
                mese: f.mese,
                anno: f.anno,
                data: new Date(f.anno, f.mese - 1, f.giorno),
                oreOrd: 0,
                oreStra: 0,
                oreViaggio: 0,
                totaleOre: 0,
                interventi: 0
            };
        }
        
        riepilogo[key].oreOrd += parseFloat(f.ore_ord) || 0;
        riepilogo[key].oreStra += parseFloat(f.ore_stra) || 0;
        riepilogo[key].oreViaggio += parseFloat(f.ore_viaggio) || 0;
        riepilogo[key].totaleOre += parseFloat(f.ore) || 0;
        riepilogo[key].interventi++;
    });
    
    const riepilogoArray = Object.values(riepilogo).sort((a, b) => {
        if (a.tecnico !== b.tecnico) return a.tecnico.localeCompare(b.tecnico);
        return b.data - a.data;
    });
    
    renderizzaRiepilogoGiornaliero(riepilogoArray);
}

function renderizzaRiepilogoMensile(dati) {
    const tbody = document.getElementById('riepilogo-mensile-body');
    
    if (dati.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center">
                    <div style="padding: 2rem; color: var(--text-muted);">
                        <span class="material-symbols-rounded">info</span>
                        <p>Nessun dato disponibile</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    dati.forEach(item => {
        const meseNome = new Date(item.anno, item.mese - 1, 1).toLocaleString('it-IT', { month: 'long' });
        
        html += `
            <tr>
                <td><strong>${item.tecnico}</strong></td>
                <td>${meseNome}</td>
                <td>${item.anno}</td>
                <td>${formatOre(item.oreOrd)}</td>
                <td>${formatOre(item.oreStra)}</td>
                <td>${formatOre(item.oreViaggio)}</td>
                <td><strong>${formatOre(item.totaleOre)}</strong></td>
                <td>${item.interventi}</td>
                <td>
                    <button class="btn-icon-small" onclick="filtraPerTecnicoEMese('${item.tecnico}', ${item.mese}, ${item.anno})" title="Vedi dettagli">
                        <span class="material-symbols-rounded">visibility</span>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function renderizzaRiepilogoGiornaliero(dati) {
    const tbody = document.getElementById('riepilogo-giornaliero-body');
    
    if (dati.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <div style="padding: 2rem; color: var(--text-muted);">
                        <span class="material-symbols-rounded">info</span>
                        <p>Nessun dato disponibile</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    dati.forEach(item => {
        const dataFormattata = `${item.giorno.toString().padStart(2,'0')}/${item.mese.toString().padStart(2,'0')}/${item.anno}`;
        
        html += `
            <tr>
                <td><strong>${item.tecnico}</strong></td>
                <td>${dataFormattata}</td>
                <td>${formatOre(item.oreOrd)}</td>
                <td>${formatOre(item.oreStra)}</td>
                <td>${formatOre(item.oreViaggio)}</td>
                <td><strong>${formatOre(item.totaleOre)}</strong></td>
                <td>${item.interventi}</td>
                <td>
                    <button class="btn-icon-small" onclick="filtraPerTecnicoEGiorno('${item.tecnico}', ${item.giorno}, ${item.mese}, ${item.anno})" title="Vedi dettagli">
                        <span class="material-symbols-rounded">visibility</span>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function filtraPerTecnicoEMese(tecnico, mese, anno) {
    document.getElementById('filtro-tecnico-fogli').value = tecnico;
    
    const dataDa = new Date(anno, mese - 1, 1);
    const dataA = new Date(anno, mese, 0);
    
    document.getElementById('filtro-data-da').value = dataDa.toISOString().split('T')[0];
    document.getElementById('filtro-data-a').value = dataA.toISOString().split('T')[0];
    
    switchVistaFogli('dettaglio');
    filtraFogli();
}

function filtraPerTecnicoEGiorno(tecnico, giorno, mese, anno) {
    document.getElementById('filtro-tecnico-fogli').value = tecnico;
    
    const data = new Date(anno, mese - 1, giorno);
    document.getElementById('filtro-data-da').value = data.toISOString().split('T')[0];
    document.getElementById('filtro-data-a').value = data.toISOString().split('T')[0];
    
    switchVistaFogli('dettaglio');
    filtraFogli();
}

// ============================================
// RENDERING TABELLA DETTAGLIO
// ============================================

function renderizzaTabellaFogli() {
    const tbody = document.getElementById('tabella-fogli-body');
    
    if (fogliFiltrati.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" class="text-center">
                    <div style="padding: 2rem; color: var(--text-muted);">
                        <span class="material-symbols-rounded">info</span>
                        <p>Nessun foglio lavoro trovato</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    fogliFiltrati.forEach((f, index) => {
        const selezionato = fogliSelezionati.has(f.ID) ? 'checked' : '';
        const dataFormattata = `${f.giorno.toString().padStart(2,'0')}/${f.mese.toString().padStart(2,'0')}/${f.anno}`;
        
        const coloreCodice = coloriCodice[f.codice?.toString()] || { bg: '#64748b20', text: '#334155' };
        const coloreTipo = coloriTipo[f.ch_rep] || { bg: '#64748b20', text: '#334155' };
        
        html += `
            <tr>
                <td>
                    <input type="checkbox" class="select-foglio" value="${f.ID}" ${selezionato} onchange="toggleSelezionaFoglio('${f.ID}')">
                </td>
                <td>${dataFormattata}</td>
                <td><strong>${f.tecnico || ''}</strong></td>
                <td>
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 12px; background: ${coloreCodice.bg}; color: ${coloreCodice.text}; font-weight: 600;">
                        ${f.codice || ''}
                    </span>
                </td>
                <td>
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 12px; background: ${coloreTipo.bg}; color: ${coloreTipo.text}; font-weight: 600;">
                        ${f.ch_rep || ''}
                    </span>
                </td>
                <td>${f.impianto || ''}</td>
                <td>${f.indirizzo || ''}</td>
                <td>${formatOre(f.ore_ord)}</td>
                <td>${formatOre(f.ore_stra)}</td>
                <td>${formatOre(f.ore_viaggio)}</td>
                <td><strong>${formatOre(f.ore)}</strong></td>
                <td>
                    ${f.note ? `<span class="material-symbols-rounded" title="${f.note}" style="color: #64748b; cursor: help;">info</span>` : ''}
                </td>
                <td>
                    <button class="btn-icon-small" onclick="mostraModalModificaFoglio('${f.ID}')" title="Modifica">
                        <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button class="btn-icon-small" onclick="mostraConfermaCancellazioneFoglio('${f.ID}')" title="Elimina">
                        <span class="material-symbols-rounded">delete</span>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Aggiorna checkbox "seleziona tutti"
    const selectAll = document.getElementById('select-all-fogli');
    if (selectAll) {
        const tuttiSelezionati = fogliFiltrati.length > 0 && 
            fogliFiltrati.every(f => fogliSelezionati.has(f.ID));
        selectAll.checked = tuttiSelezionati;
        selectAll.indeterminate = !tuttiSelezionati && 
            fogliFiltrati.some(f => fogliSelezionati.has(f.ID));
    }
}

// ============================================
// FUNZIONI SELEZIONE MULTIPLA
// ============================================

function selezionaTuttiFogli() {
    const selectAll = document.getElementById('select-all-fogli');
    const checkboxes = document.querySelectorAll('.select-foglio');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        if (selectAll.checked) {
            fogliSelezionati.add(cb.value);
        } else {
            fogliSelezionati.delete(cb.value);
        }
    });
}

function toggleSelezionaFoglio(id) {
    if (fogliSelezionati.has(id)) {
        fogliSelezionati.delete(id);
    } else {
        fogliSelezionati.add(id);
    }
    
    const selectAll = document.getElementById('select-all-fogli');
    if (selectAll) {
        const tuttiSelezionati = fogliFiltrati.length > 0 && 
            fogliFiltrati.every(f => fogliSelezionati.has(f.ID));
        selectAll.checked = tuttiSelezionati;
        selectAll.indeterminate = !tuttiSelezionati && 
            fogliFiltrati.some(f => fogliSelezionati.has(f.ID));
    }
}

// ============================================
// FUNZIONI MODAL
// ============================================

function mostraModalNuovoFoglio() {
    document.getElementById('modal-foglio-titolo').textContent = 'Nuovo Foglio Lavoro';
    document.getElementById('foglio-id').value = '';
    document.getElementById('foglio-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('foglio-ore-ord').value = '0';
    document.getElementById('foglio-ore-viaggio').value = '0';
    document.getElementById('foglio-note').value = '';
    document.getElementById('foglio-ora-inizio').value = '';
    document.getElementById('foglio-ora-fine').value = '';
    
    // Reset radio
    document.querySelector('input[name="foglio-tipo-ore"][value="ORDINARIA"]').checked = true;
    toggleTipoOreFoglio();
    
    document.getElementById('modal-foglio').style.display = 'flex';
}

async function mostraModalModificaFoglio(id) {
    try {
        let foglio = fogliList.find(f => f.ID == id);
        
        if (!foglio) {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('fogliolavoro')
                .select('*')
                .eq('ID', id)
                .single();
            
            if (error) throw error;
            foglio = data;
        }
        
        document.getElementById('modal-foglio-titolo').textContent = 'Modifica Foglio Lavoro';
        document.getElementById('foglio-id').value = foglio.ID;
        document.getElementById('foglio-tecnico').value = foglio.tecnico || '';
        document.getElementById('foglio-codice').value = foglio.codice?.toString() || '';
        
        // Data
        const data = `${foglio.anno}-${foglio.mese.toString().padStart(2,'0')}-${foglio.giorno.toString().padStart(2,'0')}`;
        document.getElementById('foglio-data').value = data;
        
        document.getElementById('foglio-impianto').value = foglio.impianto || '';
        document.getElementById('foglio-indirizzo').value = foglio.indirizzo || '';
        
        // Tipo ore
        const tipoOre = foglio.ch_rep || 'ORDINARIA';
        const radio = document.querySelector(`input[name="foglio-tipo-ore"][value="${tipoOre}"]`);
        if (radio) {
            radio.checked = true;
        }
        toggleTipoOreFoglio();
        
        // Ore
        document.getElementById('foglio-ore-ord').value = foglio.ore_ord || 0;
        document.getElementById('foglio-ore-viaggio').value = foglio.ore_viaggio || 0;
        document.getElementById('foglio-ora-inizio').value = foglio.inizio_int || '';
        document.getElementById('foglio-ora-fine').value = foglio.fine_int || '';
        
        if (foglio.inizio_int && foglio.fine_int) {
            calcolaOreFoglio();
        }
        
        document.getElementById('foglio-note').value = foglio.note || '';
        
        document.getElementById('modal-foglio').style.display = 'flex';
        
    } catch (error) {
        console.error('❌ Errore caricamento foglio:', error);
        mostraNotifica('Errore nel caricamento dei dati', 'error');
    }
}

function chiudiModalFoglio() {
    document.getElementById('modal-foglio').style.display = 'none';
}

function toggleTipoOreFoglio() {
    const tipo = document.querySelector('input[name="foglio-tipo-ore"]:checked').value;
    const isOrdinaria = tipo === 'ORDINARIA' || tipo === 'ALTRO';
    
    document.getElementById('foglio-box-ore-dirette').style.display = isOrdinaria ? 'block' : 'none';
    document.getElementById('foglio-box-orari').style.display = isOrdinaria ? 'none' : 'block';
}

function calcolaOreFoglio() {
    const inizio = document.getElementById('foglio-ora-inizio').value;
    const fine = document.getElementById('foglio-ora-fine').value;
    const dataVal = document.getElementById('foglio-data').value;
    const tipo = document.querySelector('input[name="foglio-tipo-ore"]:checked').value;
    
    if (!inizio || !fine || !dataVal) return;
    
    const res = processHours(inizio, fine, tipo, new Date(dataVal).getDay());
    
    document.getElementById('foglio-calcolo-ord').textContent = res.ord.toFixed(2);
    document.getElementById('foglio-calcolo-stra').textContent = res.stra.toFixed(2);
}

function processHours(inizio, fine, tipo, dayOfWeek) {
    // Weekend: tutto straordinario
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        const total = calculateTotalDiff(inizio, fine);
        return { ord: 0, stra: total };
    }
    
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
    let [h1, m1] = i.split(':').map(Number);
    let [h2, m2] = f.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    return (diff < 0 ? diff + 1440 : diff) / 60;
}

function aggiornaTipoDaCodice() {
    const codice = document.getElementById('foglio-codice').value;
    
    // Se è un'assenza, forza tipo ALTRO
    if (codice >= '072' && codice <= '092') {
        const radio = document.querySelector('input[name="foglio-tipo-ore"][value="ALTRO"]');
        if (radio) {
            radio.checked = true;
            toggleTipoOreFoglio();
        }
    }
}

async function salvaFoglio() {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const id = document.getElementById('foglio-id').value;
        const tecnico = document.getElementById('foglio-tecnico').value;
        const codice = document.getElementById('foglio-codice').value;
        const dataInput = document.getElementById('foglio-data').value;
        const impianto = document.getElementById('foglio-impianto').value;
        const indirizzo = document.getElementById('foglio-indirizzo').value;
        const tipo = document.querySelector('input[name="foglio-tipo-ore"]:checked').value;
        const note = document.getElementById('foglio-note').value;
        const oreViaggio = parseFloat(document.getElementById('foglio-ore-viaggio').value) || 0;
        
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
        
        const data = new Date(dataInput);
        const giorno = data.getDate();
        const mese = data.getMonth() + 1;
        const anno = data.getFullYear();
        
        let oreOrd = 0, oreStra = 0, oreTotali = 0;
        let inizioInt = null, fineInt = null;
        
        if (tipo === 'ORDINARIA' || tipo === 'ALTRO') {
            oreOrd = parseFloat(document.getElementById('foglio-ore-ord').value) || 0;
            oreTotali = oreOrd;
        } else {
            inizioInt = document.getElementById('foglio-ora-inizio').value;
            fineInt = document.getElementById('foglio-ora-fine').value;
            
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
            mostraNotifica('Foglio aggiornato con successo', 'success');
        } else {
            // Insert
            const { error } = await supabase
                .from('fogliolavoro')
                .insert([payload]);
            
            if (error) throw error;
            mostraNotifica('Foglio salvato con successo', 'success');
        }
        
        chiudiModalFoglio();
        await caricaFogli();
        
    } catch (error) {
        console.error('❌ Errore salvataggio:', error);
        mostraNotifica(`Errore: ${error.message}`, 'error');
    }
}

// ============================================
// FUNZIONI CANCELLAZIONE
// ============================================

let foglioDaCancellare = null;

function mostraConfermaCancellazioneFoglio(id) {
    foglioDaCancellare = id;
    document.getElementById('modal-conferma-cancellazione-ann').style.display = 'flex';
}

async function confermaCancellazioneFoglio() {
    if (!foglioDaCancellare) return;
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const { error } = await supabase
            .from('fogliolavoro')
            .delete()
            .eq('ID', foglioDaCancellare);
        
        if (error) throw error;
        
        fogliSelezionati.delete(foglioDaCancellare);
        chiudiModalCancellazioneAnn();
        await caricaFogli();
        
        mostraNotifica('Foglio eliminato', 'success');
        
    } catch (error) {
        console.error('❌ Errore cancellazione:', error);
        mostraNotifica(`Errore: ${error.message}`, 'error');
    }
}

async function eliminaSelezionatiFogli() {
    if (fogliSelezionati.size === 0) {
        mostraNotifica('Nessun foglio selezionato', 'warning');
        return;
    }
    
    if (!confirm(`Eliminare ${fogliSelezionati.size} fogli selezionati?`)) {
        return;
    }
    
    try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('DB non configurato');
        
        const ids = Array.from(fogliSelezionati);
        
        const { error } = await supabase
            .from('fogliolavoro')
            .delete()
            .in('ID', ids);
        
        if (error) throw error;
        
        mostraNotifica(`${fogliSelezionati.size} fogli eliminati`, 'success');
        fogliSelezionati.clear();
        await caricaFogli();
        
    } catch (error) {
        console.error('❌ Errore eliminazione multipla:', error);
        mostraNotifica(`Errore: ${error.message}`, 'error');
    }
}

function chiudiModalCancellazioneAnn() {
    foglioDaCancellare = null;
    document.getElementById('modal-conferma-cancellazione-ann').style.display = 'none';
}

// ============================================
// FUNZIONI EXPORT CSV
// ============================================

function esportaCSVFogli() {
    try {
        const datiDaEsportare = fogliFiltrati.length > 0 ? fogliFiltrati : fogliList;
        
        if (datiDaEsportare.length === 0) {
            mostraNotifica('Nessun dato da esportare', 'warning');
            return;
        }
        
        const header = ['Data', 'Tecnico', 'Codice', 'Tipo', 'Impianto', 'Indirizzo', 
                        'Ore Ord', 'Ore Stra', 'Ore Viaggio', 'Totale Ore', 'Note'];
        
        let csvContent = header.join(';') + '\n';
        
        datiDaEsportare.forEach(f => {
            const data = `${f.giorno.toString().padStart(2,'0')}/${f.mese.toString().padStart(2,'0')}/${f.anno}`;
            const riga = [
                data,
                f.tecnico || '',
                f.codice || '',
                f.ch_rep || '',
                f.impianto || '',
                f.indirizzo || '',
                (f.ore_ord || 0).toString(),
                (f.ore_stra || 0).toString(),
                (f.ore_viaggio || 0).toString(),
                (f.ore || 0).toString(),
                (f.note || '').replace(/;/g, ',').replace(/\n/g, ' ')
            ];
            
            csvContent += riga.join(';') + '\n';
        });
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = `FogliLavoro_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        mostraNotifica(`Esportati ${datiDaEsportare.length} fogli`, 'success');
        
    } catch (error) {
        console.error('❌ Errore export CSV:', error);
        mostraNotifica('Errore nell\'esportazione', 'error');
    }
}

// ============================================
// FUNZIONI IMPORT CSV
// ============================================

function mostraImportFogli() {
    document.getElementById('modal-import-fogli').style.display = 'flex';
}

function chiudiImportFogli() {
    document.getElementById('modal-import-fogli').style.display = 'none';
    document.getElementById('file-fogli-csv').value = '';
    document.getElementById('btn-analizza-fogli').disabled = true;
    document.getElementById('anteprima-import-fogli').style.display = 'none';
}

function setupDropZoneFogli() {
    const dropArea = document.getElementById('drop-zone-fogli');
    const fileInput = document.getElementById('file-fogli-csv');
    
    if (!dropArea || !fileInput) return;
    
    dropArea.addEventListener('click', () => fileInput.click());
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    dropArea.addEventListener('drop', handleDropFogli, false);
}

function handleDropFogli(e) {
    e.preventDefault();
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        document.getElementById('file-fogli-csv').files = files;
        handleFileSelectFogli({ target: { files: files } });
    }
}

function handleFileSelectFogli(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        mostraNotifica('Seleziona un file CSV', 'error');
        return;
    }
    
    document.getElementById('btn-analizza-fogli').disabled = false;
    
    // Mostra feedback
    mostraNotifica(`File caricato: ${file.name}`, 'success');
}

function scaricaTemplateFogli() {
    const template = `Data;Tecnico;Codice;Tipo;Impianto;Indirizzo;OreOrd;OreStra;OreViaggio;Note
15/02/2026;Mario Rossi;21;ORDINARIA;ASC001;Via Roma 1;8;0;0.5;Manutenzione ordinaria
15/02/2026;Luigi Verdi;075;ALTRO;;;8;0;0;Ferie
14/02/2026;Anna Neri;22;STRAORDINARIO;ASC002;Via Milano 5;0;3.5;0.5;Chiamata urgente`;

    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = 'Template_FogliLavoro.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function analizzaCSVFogli() {
    const fileInput = document.getElementById('file-fogli-csv');
    const file = fileInput.files[0];
    
    if (!file) {
        mostraNotifica('Seleziona un file CSV', 'error');
        return;
    }
    
    mostraNotifica('Analisi CSV in corso...', 'info');
    
    // Per ora solo anteprima semplice
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        const anteprima = document.getElementById('anteprima-import-fogli');
        anteprima.innerHTML = `
            <div style="background: #f8fafc; border-radius: 8px; padding: 1rem;">
                <h4 style="margin: 0 0 0.5rem 0;">Anteprima CSV</h4>
                <p><strong>Righe trovate:</strong> ${lines.length - 1}</p>
                <p><strong>Prime 3 righe:</strong></p>
                <pre style="background: white; padding: 0.5rem; border-radius: 4px; font-size: 0.8rem;">${lines.slice(0, 4).join('\n')}</pre>
                <button class="btn btn-primary" style="margin-top: 1rem;" onclick="importaCSVFogli()">
                    Procedi con Import
                </button>
            </div>
        `;
        anteprima.style.display = 'block';
    };
    reader.readAsText(file, 'UTF-8');
}

async function importaCSVFogli() {
    mostraNotifica('Funzionalità import completa in sviluppo', 'warning');
    chiudiImportFogli();
}

// ============================================
// UTILITY
// ============================================

function formatOre(valore) {
    if (!valore && valore !== 0) return '0h';
    const ore = Math.floor(valore);
    const minuti = Math.round((valore - ore) * 60);
    if (minuti === 0) return `${ore}h`;
    return `${ore}h ${minuti}m`;
}

function mostraNotifica(messaggio, tipo = 'info') {
    // Crea una notifica temporanea locale invece di chiamare altre funzioni
    const notifica = document.createElement('div');
    notifica.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        background: ${tipo === 'error' ? '#ef4444' : tipo === 'success' ? '#22c55e' : '#3B82F6'};
        color: white;
    `;
    notifica.textContent = messaggio;
    document.body.appendChild(notifica);
    
    setTimeout(() => {
        notifica.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notifica.remove(), 300);
    }, 3000);
}

// Carica dati quando il tab viene attivato
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'class') {
            const tabFogli = document.getElementById('tab-fogli');
            if (tabFogli && tabFogli.classList.contains('active')) {
                console.log('📋 Tab Fogli attivato, carico dati...');
                if (typeof window.caricaFogli === 'function') {
                    window.caricaFogli();
                }
            }
        }
    });
});

const tabFogli = document.getElementById('tab-fogli');
if (tabFogli) {
    observer.observe(tabFogli, { attributes: true });
}
// Carica dati all'avvio
//setTimeout(() => {
 //   if (document.getElementById('tab-fogli')?.classList.contains('active')) {
 //       caricaFogli();
 //   }
//}, 500);

console.log('✅ Admin Fogli Lavoro JS caricato');

console.log('🔍 Verifica funzioni prima dell\'export:');
console.log('- caricaFogli esiste?', typeof caricaFogli === 'function');
console.log('- mostraModalNuovoFoglio esiste?', typeof mostraModalNuovoFoglio === 'function');

if (typeof caricaFogli === 'function') {
    window.caricaFogli = caricaFogli;
    console.log('✅ caricaFogli esportata');
} else {
    console.error('❌ caricaFogli NON disponibile');
}

// ============================================
// ESPOSIZIONE FUNZIONI GLOBALI (FINALI)
// ============================================

window.caricaFogli = caricaFogli;
window.mostraModalNuovoFoglio = mostraModalNuovoFoglio;
window.switchVistaFogli = switchVistaFogli;
window.switchTipoRiepilogo = switchTipoRiepilogo;
window.filtraFogli = filtraFogli;
window.filtraPerTecnicoEMese = filtraPerTecnicoEMese;
window.filtraPerTecnicoEGiorno = filtraPerTecnicoEGiorno;
window.selezionaTuttiFogli = selezionaTuttiFogli;
window.toggleSelezionaFoglio = toggleSelezionaFoglio;
window.mostraModalModificaFoglio = mostraModalModificaFoglio;
window.chiudiModalFoglio = chiudiModalFoglio;
window.toggleTipoOreFoglio = toggleTipoOreFoglio;
window.calcolaOreFoglio = calcolaOreFoglio;
window.aggiornaTipoDaCodice = aggiornaTipoDaCodice;
window.salvaFoglio = salvaFoglio;
window.mostraConfermaCancellazioneFoglio = mostraConfermaCancellazioneFoglio;
window.confermaCancellazioneFoglio = confermaCancellazioneFoglio;
window.chiudiModalCancellazioneAnn = chiudiModalCancellazioneAnn;
window.eliminaSelezionatiFogli = eliminaSelezionatiFogli;
window.esportaCSVFogli = esportaCSVFogli;
window.mostraImportFogli = mostraImportFogli;
window.chiudiImportFogli = chiudiImportFogli;
window.scaricaTemplateFogli = scaricaTemplateFogli;
window.analizzaCSVFogli = analizzaCSVFogli;
window.importaCSVFogli = importaCSVFogli;

console.log('✅ ADMIN FOGLI - FUNZIONI GLOBALI REGISTRATE');
console.log('📋 Funzioni disponibili:', Object.keys(window).filter(k => k.includes('Fogli') || k.includes('foglio')));

// Verifica finale
console.log('🔍 Verifica finale window.caricaFogli:', typeof window.caricaFogli);