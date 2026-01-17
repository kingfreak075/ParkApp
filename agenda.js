const SUPABASE_URL = 'https://berlfufnmolyrmxeyqfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_a3USDfV7gbuauU2Kd6DuQQ_8PFVElpy';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const tecnicoLoggato = localStorage.getItem('tecnico_loggato');

document.addEventListener('DOMContentLoaded', () => {
    mostraData();
    caricaImpegniGiorno();
});

function mostraData() {
    const opzioni = { weekday: 'long', day: 'numeric', month: 'long' };
    const oggi = new Date().toLocaleDateString('it-IT', opzioni);
    document.getElementById('current-date-display').innerText = oggi;
}

async function caricaImpegniGiorno() {
    const container = document.getElementById('agenda-container');
    container.innerHTML = "<div style='text-align:center; padding:20px;'>Caricamento impegni...</div>";

    // ESEMPIO: Carichiamo gli impianti che hanno una nota specifica o una scadenza oggi
    // Per ora simuliamo un'interfaccia a "Timeline"
    
    const htmlPlaceholder = `
        <div style="border-left: 2px solid #e2e8f0; margin-left: 10px; padding-left: 20px; position: relative;">
            
            <div style="margin-bottom: 25px; position: relative;">
                <div style="position: absolute; left: -29px; top: 0; background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 4px solid #f8fafc;"></div>
                <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">08:30</div>
                <div style="background: white; padding: 15px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-top: 5px;">
                    <div style="font-weight: 800;">Partenza Magazzino</div>
                    <div style="font-size: 0.8rem; color: #94a3b8;">Ritiro materiali per riparazioni</div>
                </div>
            </div>

            <div style="margin-bottom: 25px; position: relative;">
                <div style="position: absolute; left: -29px; top: 0; background: #22c55e; width: 16px; height: 16px; border-radius: 50%; border: 4px solid #f8fafc;"></div>
                <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">09:15</div>
                <div style="background: white; padding: 15px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-top: 5px;">
                    <div style="font-weight: 800;">Condominio Belvedere</div>
                    <div style="font-size: 0.8rem; color: #64748b;">Via delle Rose 12</div>
                    <div style="display: flex; gap: 5px; margin-top: 8px;">
                        <span style="background: #f1f5f9; font-size: 0.65rem; padding: 3px 7px; border-radius: 4px; font-weight: 700; color: #475569;">RIPARAZIONE</span>
                    </div>
                </div>
            </div>

        </div>
    `;
    
    container.innerHTML = htmlPlaceholder;
}