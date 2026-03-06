// utils.js
let debugLogs = [];

function mostraMessaggio(testo, tipo) {
    const msgDiv = document.getElementById('messaggio');
    if (!msgDiv) {
        alert(testo);
        return;
    }
    
    msgDiv.className = 'messaggio ' + tipo;
    msgDiv.textContent = testo;
    
    setTimeout(() => {
        msgDiv.className = 'messaggio';
    }, 5000);
}

function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    debugLogs.unshift(logEntry);
    
    const debugDiv = document.getElementById('debugLogs');
    if (debugDiv) {
        debugDiv.innerHTML = debugLogs.map(log => 
            `<div class="log-entry ${log.includes('Errore') ? 'log-error' : ''}">${log}</div>`
        ).join('');
    }
    
    console.log(logEntry);
}

function salvaUtenteLocale(email, nome) {
    let list = JSON.parse(localStorage.getItem('park_tecnici') || '[]');
    const now = new Date().toLocaleString();
    
    list = list.filter(u => u.email !== email);
    list.unshift({ email, nome, lastAccess: now });
    
    localStorage.setItem('park_tecnici', JSON.stringify(list.slice(0, 5)));
    caricaUtentiLocali();
}

function caricaUtentiLocali() {
    const container = document.getElementById('savedUsersContainer');
    const lista = document.getElementById('listaUtenti');
    
    if (!container || !lista) return;
    
    const list = JSON.parse(localStorage.getItem('park_tecnici') || '[]');
    if (list.length > 0) {
        container.style.display = 'block';
        lista.innerHTML = list.map(u => `
            <div class="user-item" onclick="selezionaRapido('${u.email}')">
                <div class="info">
                    <div class="name">${u.nome}</div>
                    <div class="email">${u.email}</div>
                    ${u.lastAccess ? `<div class="last-access">🕒 ${u.lastAccess}</div>` : ''}
                </div>
                <div class="arrow">›</div>
            </div>
        `).join('');
    } else {
        container.style.display = 'none';
    }
}

window.mostraMessaggio = mostraMessaggio;
window.addDebugLog = addDebugLog;
window.salvaUtenteLocale = salvaUtenteLocale;
window.caricaUtentiLocali = caricaUtentiLocali;