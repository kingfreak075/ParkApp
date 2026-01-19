// note_spese.js - VERSIONE DEFINITIVA (SOLO SOMMA, NO MOLTIPLICAZIONI)
const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let fotoRicevute = {
    vitto: [],
    auto: []
};

// ============ CALCOLO TOTALI (SEMPLICE SOMMA) ============
function calcolaTotali(ritornaValori = false) {
    try {
        // LEGGI TUTTI I VALORI (già in Euro)
        const pasti = parseFloat(document.getElementById('pasti').value) || 0;
        const pernottamenti = parseFloat(document.getElementById('pernottamenti').value) || 0;
        const mezziTrasporto = parseFloat(document.getElementById('mezzi-trasporto').value) || 0;
        const altreSpese = parseFloat(document.getElementById('altre-spese').value) || 0;
        const kmAuto = parseFloat(document.getElementById('km-auto').value) || 0; // già in €
        const pedaggi = parseFloat(document.getElementById('pedaggi').value) || 0;
        const parcheggi = parseFloat(document.getElementById('parcheggi').value) || 0;
        const lavaggio = parseFloat(document.getElementById('lavaggio').value) || 0;
        const carburante = parseFloat(document.getElementById('carburante').value) || 0;
        
        // SOMMA SEMPLICE (nessuna moltiplicazione!)
        const totaleVitto = pasti + pernottamenti + mezziTrasporto + altreSpese;
        const totaleAuto = kmAuto + pedaggi + parcheggi + lavaggio + carburante;
        const totaleGenerale = totaleVitto + totaleAuto;
        
        // AGGIORNA DISPLAY - MOSTRA GLI STESSI VALORI INSERITI
        document.getElementById('totale-pasti').textContent = `Totale: €${pasti.toFixed(2)}`;
        document.getElementById('totale-pernottamenti').textContent = `Totale: €${pernottamenti.toFixed(2)}`;
        document.getElementById('totale-trasporto').textContent = `Totale: €${mezziTrasporto.toFixed(2)}`;
        document.getElementById('totale-altre').textContent = `Totale: €${altreSpese.toFixed(2)}`;
        document.getElementById('totale-km').textContent = `Totale: €${kmAuto.toFixed(2)}`;
        document.getElementById('totale-pedaggi').textContent = `Totale: €${pedaggi.toFixed(2)}`;
        document.getElementById('totale-parcheggi').textContent = `Totale: €${parcheggi.toFixed(2)}`;
        document.getElementById('totale-lavaggio').textContent = `Totale: €${lavaggio.toFixed(2)}`;
        document.getElementById('totale-carburante').textContent = `Totale: €${carburante.toFixed(2)}`;
        
        document.getElementById('totale-vitto').textContent = `Vitto/Trasporto: €${totaleVitto.toFixed(2)}`;
        document.getElementById('totale-auto').textContent = `Auto: €${totaleAuto.toFixed(2)}`;
        document.getElementById('totale-generale').textContent = `€${totaleGenerale.toFixed(2)}`;
        
        // RITORNA SOLO SE RICHIESTO
        if (ritornaValori) {
            return {
                totaleVitto: totaleVitto,
                totaleAuto: totaleAuto,
                totaleGenerale: totaleGenerale
            };
        }
        
    } catch (error) {
        console.error('Errore calcolo:', error);
        
        // In caso di errore, mostra zeri
        document.getElementById('totale-vitto').textContent = `Vitto/Trasporto: €0.00`;
        document.getElementById('totale-auto').textContent = `Auto: €0.00`;
        document.getElementById('totale-generale').textContent = `€0.00`;
        
        if (ritornaValori) {
            return { totaleVitto: 0, totaleAuto: 0, totaleGenerale: 0 };
        }
    }
}

// ============ VALIDAZIONE ============
function validazioneInput(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return true;
    
    const value = input.value.trim().replace(',', '.');
    
    // Vuoto → 0
    if (value === '') {
        input.value = '0.00';
        return true;
    }
    
    // Verifica numero
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        input.value = '0.00';
        input.classList.add('error');
        return false;
    }
    
    // Non negativo
    if (numValue < 0) {
        input.value = '0.00';
        input.classList.add('error');
        return false;
    }
    
    // Formatta a 2 decimali
    input.value = numValue.toFixed(2);
    input.classList.remove('error');
    return true;
}

// ============ SALVA SPESA ============
async function salvaSpesa() {
    console.log('Avvio salvataggio...');
    
    // 1. Validazioni
    const dataSpesa = document.getElementById('data-spesa').value;
    if (!dataSpesa) {
        showError('Seleziona una data');
        return;
    }
    
    const tecnico = localStorage.getItem('tecnico_loggato');
    if (!tecnico) {
        window.location.href = 'index.html';
        return;
    }
    
    // 2. Validazione input
    const inputs = [
        'pasti', 'pernottamenti', 'mezzi-trasporto', 'altre-spese',
        'km-auto', 'pedaggi', 'parcheggi', 'lavaggio', 'carburante'
    ];
    
    let errori = false;
    inputs.forEach(id => {
        if (!validazioneInput(id)) errori = true;
    });
    
    if (errori) {
        showError('Correggi i campi in rosso');
        return;
    }
    
    // 3. Conferma
    if (!confirm('Salvare questa spesa?\nIl form verrà resettato.')) {
        return;
    }
    
    showLoading();
    
    try {
        // 4. Calcola totali (SEMPLICE SOMMA)
        console.log('Calcolo totali...');
        const totali = calcolaTotali(true);
        
        if (!totali) {
            throw new Error('Impossibile calcolare i totali');
        }
        
        console.log('Totali:', totali);
        
        // 5. Upload foto (facoltativo)
        const fotoUrls = [];
        const allFotos = [...fotoRicevute.vitto, ...fotoRicevute.auto];
        
        for (const foto of allFotos) {
            const url = await uploadFoto(foto);
            if (url) fotoUrls.push(url);
        }
        
        // 6. Prepara dati
        const data = new Date(dataSpesa);
        const spesaData = {
            tecnico: tecnico,
            data: dataSpesa,
            giorno: data.getDate(),
            mese: data.getMonth() + 1,
            anno: data.getFullYear(),
            localita: document.querySelector('input[name="fuori-sede"]:checked').value === 'true' 
                     ? (document.getElementById('localita').value.trim() || 'Fuori Sede')
                     : 'In Sede',
            pasti: parseFloat(document.getElementById('pasti').value) || 0,
            pernottamenti: parseFloat(document.getElementById('pernottamenti').value) || 0,
            mezzi_trasp: parseFloat(document.getElementById('mezzi-trasporto').value) || 0,
            altre_spese: parseFloat(document.getElementById('altre-spese').value) || 0,
            km_auto_propria: parseFloat(document.getElementById('km-auto').value) || 0, // già in €
            ped_autostrad: parseFloat(document.getElementById('pedaggi').value) || 0,
            parcheggi: parseFloat(document.getElementById('parcheggi').value) || 0,
            lavaggio: parseFloat(document.getElementById('lavaggio').value) || 0,
            carbur_lubrif: parseFloat(document.getElementById('carburante').value) || 0,
            totale_vitto: totali.totaleVitto,
            totale_auto: totali.totaleAuto,
            totale_generale: totali.totaleGenerale,
            note: document.getElementById('note').value.trim(),
            foto_url: fotoUrls.length > 0 ? fotoUrls : null
        };
        
        console.log('Dati da salvare:', spesaData);
        
        // 7. Salva su Supabase
        const { data: result, error } = await supabaseClient
            .from('note_spese')
            .insert([spesaData]);
        
        if (error) throw error;
        
        console.log('Spesa salvata!');
        
        // 8. Successo e reset
        showSuccess();
        
        setTimeout(() => {
            resetForm();
            hideMessages();
        }, 2000);
        
    } catch (error) {
        console.error('Errore:', error);
        showError('Errore salvataggio: ' + error.message);
    } finally {
        hideLoading();
    }
}

// ============ FUNZIONI AUSILIARIE ============

async function uploadFoto(foto) {
    if (!foto || !foto.file) return null;
    
    try {
        const fileName = `ricevuta_${Date.now()}.jpg`;
        const filePath = `ricevute/${fileName}`;
        
        const { error } = await supabaseClient.storage
            .from('spese')
            .upload(filePath, foto.file);
        
        if (error) throw error;
        
        const { data: urlData } = supabaseClient.storage
            .from('spese')
            .getPublicUrl(filePath);
        
        return urlData?.publicUrl;
    } catch (error) {
        console.warn('Foto non salvata:', error);
        return null;
    }
}

function resetForm() {
    // Reset valori a 0.00
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.value = '0.00';
        input.classList.remove('error');
    });
    
    document.getElementById('localita').value = '';
    document.getElementById('note').value = '';
    document.querySelector('input[name="fuori-sede"][value="false"]').checked = true;
    document.getElementById('localita-group').style.display = 'none';
    
    // Reset foto
    document.getElementById('foto-preview-vitto').innerHTML = '';
    document.getElementById('foto-preview-auto').innerHTML = '';
    fotoRicevute = { vitto: [], auto: [] };
    
    // Reset sezione
    selezionaTipo('vitto');
    
    // Ricalcola
    calcolaTotali();
}

function scattaFoto(tipo) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file || file.size > 5 * 1024 * 1024) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const foto = {
                tipo: tipo,
                file: file,
                url: e.target.result,
                nome: file.name
            };
            
            const isVitto = ['pasti', 'pernottamenti', 'mezzi-trasporto', 'altre-spese'].includes(tipo);
            fotoRicevute[isVitto ? 'vitto' : 'auto'].push(foto);
            aggiornaFotoPreview(isVitto ? 'vitto' : 'auto');
        };
        reader.readAsDataURL(file);
    };
    
    input.click();
}

function aggiornaFotoPreview(categoria) {
    const containerId = categoria === 'vitto' ? 'foto-preview-vitto' : 'foto-preview-auto';
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    fotoRicevute[categoria].forEach((foto, index) => {
        const div = document.createElement('div');
        div.className = 'foto-item';
        div.innerHTML = `
            <img src="${foto.url}" alt="Ricevuta">
            <button class="foto-remove" onclick="rimuoviFoto('${categoria}', ${index})">
                <span class="material-symbols-rounded">close</span>
            </button>
        `;
        container.appendChild(div);
    });
}

function rimuoviFoto(categoria, index) {
    fotoRicevute[categoria].splice(index, 1);
    aggiornaFotoPreview(categoria);
}

// ============ UI FUNCTIONS ============

function showError(msg) {
    const el = document.getElementById('error-message');
    const txt = document.getElementById('error-text');
    if (el && txt) {
        txt.textContent = msg;
        el.style.display = 'flex';
        document.getElementById('success-message').style.display = 'none';
    }
}

function showSuccess() {
    const el = document.getElementById('success-message');
    if (el) {
        el.style.display = 'flex';
        document.getElementById('error-message').style.display = 'none';
    }
}

function hideMessages() {
    ['error-message', 'success-message'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

function showLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'flex';
}

function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'none';
}

// ============ FUNZIONE SELEZIONE TIPO ============
function selezionaTipo(tipo) {
    if (tipo === 'vitto') {
        document.getElementById('toggle-vitto').classList.add('active');
        document.getElementById('toggle-auto').classList.remove('active');
        document.getElementById('sezione-vitto').style.display = 'block';
        document.getElementById('sezione-auto').style.display = 'none';
    } else {
        document.getElementById('toggle-vitto').classList.remove('active');
        document.getElementById('toggle-auto').classList.add('active');
        document.getElementById('sezione-vitto').style.display = 'none';
        document.getElementById('sezione-auto').style.display = 'block';
    }
}

// ============ INIZIALIZZAZIONE PAGINA ============
document.addEventListener('DOMContentLoaded', () => {
    console.log('Pagina note spese pronta');
    
    // Imposta data odierna
    const oggi = new Date();
    document.getElementById('data-spesa').value = oggi.toISOString().split('T')[0];
    
    // Formatta e mostra data corrente
    document.getElementById('data-corrente').textContent = oggi.toLocaleDateString('it-IT', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    
    // Recupera nome tecnico
    const tecnico = localStorage.getItem('tecnico_loggato');
    document.getElementById('tecnico-nome').textContent = tecnico || 'Tecnico';
    
    // Gestione toggle fuori sede
    document.querySelectorAll('input[name="fuori-sede"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('localita-group').style.display = 
                e.target.value === 'true' ? 'block' : 'none';
        });
    });
    
    // Event listener per input numerici (calcolo in tempo reale)
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('input', () => {
            setTimeout(() => calcolaTotali(), 50);
        });
        
        input.addEventListener('blur', function() {
            validazioneInput(this.id);
            calcolaTotali();
        });
    });
    
    // Calcolo iniziale
    calcolaTotali();
});