const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function getMesiSemestrali(meseNum) {
    const mesi = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
    const m = parseInt(meseNum);
    if (isNaN(m) || m < 1 || m > 12) return "-";
    const meseCorrente = mesi[m - 1];
    let mesePrecedenteIndex = (m - 1) - 6;
    if (mesePrecedenteIndex < 0) mesePrecedenteIndex += 12;
    return `${mesi[mesePrecedenteIndex]} - ${meseCorrente}`;
}

function parseDataItaliana(str) {
    if (!str || typeof str !== 'string') return null;
    const s = str.trim();
    if (s === '-' || s.toLowerCase().includes('n/d') || s === '') return null;
    try {
        const parti = s.split('/');
        if (parti.length !== 3) return null;
        const d = new Date(parseInt(parti[2]), parseInt(parti[1]) - 1, parseInt(parti[0]));
        return isNaN(d.getTime()) ? null : d;
    } catch (e) { return null; }
}

async function caricaScheda() {
    const params = new URLSearchParams(window.location.search);
    const idImpianto = params.get('id');
    if (!idImpianto) { window.location.href = 'index.html'; return; }

    const { data: imp, error } = await supabaseClient
        .from('Parco_app')
        .select('*')
        .eq('impianto', idImpianto)
        .single();

    if (error || !imp) { alert("Impianto non trovato"); return; }

    // --- LOGICA VENDITORE (DEBUG) ---
    let visualizzazioneVenditore = imp.venditore || "Vuoto";
    
    if (imp.venditore && imp.venditore !== "-" && imp.venditore !== "") {
        // Puliamo il codice (es. da "901" a 901)
        const codPulito = parseInt(imp.venditore.toString().trim());
        
        if (!isNaN(codPulito)) {
            const { data: vData, error: vError } = await supabaseClient
                .from('venditori')
                .select('Nome')
                .eq('Cod', codPulito)
                .maybeSingle();

            if (vData && vData.Nome) {
                // Se lo trova, mostra: "Nome (Codice)"
                visualizzazioneVenditore = `${vData.Nome} (${codPulito})`;
            } else {
                // Se NON lo trova, mostra solo il codice con un avviso
                visualizzazioneVenditore = `Cod. ${codPulito} (Non trovato in tabella)`;
            }
            
            if (vError) console.error("Errore query venditori:", vError);
        }
    }

    // --- RISOLUZIONE MANUTENTORE E SUPERVISORE ---
    let nomeManutentore = imp.giro || "-"; 
    let nomeSupervisore = "-";
    if (imp.giro && !isNaN(parseInt(imp.giro))) {
        const { data: mData } = await supabaseClient.from('manutentori').select('Manutentore, Supervisore').eq('Giro', parseInt(imp.giro)).maybeSingle();
        if (mData) {
            nomeManutentore = mData.Manutentore || imp.giro;
            if (mData.Supervisore) {
                const { data: sData } = await supabaseClient.from('supervisori').select('Nome').eq('Cod', parseInt(mData.Supervisore)).maybeSingle();
                nomeSupervisore = sData ? sData.Nome : mData.Supervisore;
            }
        }
    }

    // --- RIEMPIMENTO UI ---
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val || '-';
    };

    setVal('det-impianto', imp.impianto);
    setVal('badge-manut', imp.manut);
    setVal('badge-tipo', imp.tipo);
    setVal('det-matricola', imp.matricola);
    setVal('det-tecnico', imp.tecnico);
    setVal('det-giro', nomeManutentore);
    setVal('det-supervisore', nomeSupervisore);
    setVal('det-mese-semestre', getMesiSemestrali(imp.mese_sem));
    setVal('det-periodicita', imp.periodicit);
    setVal('det-cliente', imp.cliente);
    setVal('det-amministratore', imp.amministratore);
    setVal('det-venditore', visualizzazioneVenditore); // Visualizzazione debug
    setVal('det-note', imp.note || 'Nessuna nota presente.');

    const locEl = document.getElementById('det-localita');
    if (locEl) {
        locEl.innerHTML = `${imp.Indirizzo || '-'}<br>${imp.localit || '-'} (${imp.prov || '-'})`;
    }

    // --- GESTIONE SCADENZE ---
    const oggi = new Date();
    const checkScadenza = (id, valoreData, mesiSoglia) => {
        const el = document.getElementById(id);
        if (!el) return;
        const dataParsed = parseDataItaliana(valoreData);
        if (dataParsed) {
            const limite = new Date();
            limite.setMonth(oggi.getMonth() - mesiSoglia);
            el.innerHTML = (dataParsed < limite) ? `⚠️ <span style="color: #ef4444;">${valoreData}</span>` : valoreData;
        } else { el.innerText = valoreData || '-'; }
    };

    checkScadenza('det-ult-sem', imp.ult_sem, 6);
    checkScadenza('det-ult-vp', imp.utl_vp, 24);

    document.getElementById('btn-nuovo-lavoro').onclick = () => {
        window.location.href = `nuovo_lavoro.html?id=${encodeURIComponent(imp.impianto)}`;
    };

    document.getElementById('dettaglio-content').style.display = 'block';
}

caricaScheda();