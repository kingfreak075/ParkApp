🚀 PROMPT SVILUPPO FUTURO - ParkApp v4.3+
OBIETTIVO
Integrare le seguenti funzionalità nella pagina index.html (versione con login email+PIN) per migliorare robustezza, UX e debug.

📦 MODIFICHE DA IMPLEMENTARE
9. FALLBACK OFFLINE
Se Supabase non risponde, mostrare messaggio chiaro

Testo: "❌ Database non raggiungibile. Verifica connessione internet o contatta l'assistenza"

Opzionale: cache locale delle ultime credenziali per accesso limitato offline

File da modificare: index.html (funzione testConnessione() e gestione errori)

10. LOG SESSIONI LOCALI
Salvare in localStorage un array di log con:

Timestamp

Email tentativo

Esito (successo/fallimento/motivo)

IP/device (se disponibile)

Visualizzare nel pannello debug (doppio tap)

Mantenere ultimi 50 log

Nuova funzione: aggiungiLogSessione(email, esito, motivo)

Visualizzazione: in debug-panel

11. PIN TEMPORANEO
Aggiungere campo pin_scadenza (timestamp) nella tabella tecnici

Se presente e non scaduto, il PIN funziona anche se diverso da quello principale

Logica: controllare prima PIN normale, poi PIN temporaneo con scadenza

Messaggio: "🔑 Accesso con PIN temporaneo. Scade il: [data]"

Modifiche: funzione accedi() e query Supabase

12. AUTENTICAZIONE BIOMETRICA (struttura futura)
Aggiungere check all'avvio: window.PublicKeyCredential ? 'biometria supportata' : 'non supportata'

Preparare variabile biometricSupported e flag in localStorage

Non implementare ancora la biometria, solo struttura pronta

Aggiungere: pulsante "Impronta digitale" (disabilitato) con tooltip "Prossimamente"

13. TEMA SCURO AUTOMATICO
Media query @media (prefers-color-scheme: dark)

Adattare colori:

Sfondo sfumato: versioni più scure dei gradienti

Container: background più scuro, testo chiaro

Bottoni: mantenere visibilità

Testare su dispositivi con tema scuro attivo

File: aggiungere sezione CSS media query

14. TOAST NOTIFICATIONS
Sostituire il messaggio statico con notifiche toast

Posizione: in alto (sotto l'header) o in basso

Durata: 3 secondi, poi fade out

Tipi: success (verde), error (rosso), warning (arancione), info (blu)

Mantenere compatibilità con il vecchio mostraMessaggio() ma reindirizzare a toast

Nuova funzione: mostraToast(testo, tipo, durata = 3000)

15. CONFERMA REGISTRAZIONE VIA EMAIL
Dopo registrazione, mostrare messaggio:
"✅ Richiesta inviata! Riceverai una email di conferma quando l'admin approverà il profilo."

Opzionale: simulare invio email (solo frontend)

Preparare struttura per futura integrazione con Supabase Edge Functions

Modifica: funzione registrati()

16. CHECKLIST CONFIGURAZIONE
Se !hasDbConfig() mostrare checklist interattiva:

1. Configura URL e Key Supabase

2. Crea tabella tecnici (con struttura: id, Mail, nome_completo, pin, attivo, Telefono, ruolo, pin_scadenza)

3. Inserisci almeno un tecnico con attivo=true

4. Verifica permessi RLS

Link a config.html per punto 1

Nuova funzione: mostraChecklistConfigurazione()

17. RESET PIN
Aggiungere link "Hai dimenticato il PIN?" sotto il campo email

Aprire modal con:

Campo email (precompilato se presente)

Bottone "Richiedi nuovo PIN"

Invia richiesta a Supabase (tabella richieste_reset o notifica admin)

Messaggio: "Richiesta inviata all'amministratore. Riceverai un PIN temporaneo via email."

Nuova funzione: apriModalResetPin()

🔧 PRIORITÀ CONSIGLIATA
Fallback offline (9) - Gestione errori base

Toast notifications (14) - UX immediata

Tema scuro (13) - Rapido da implementare

Log sessioni (10) - Debug migliorato

Reset PIN (17) - Funzionalità richiesta

PIN temporaneo (11) - Estensione reset

Checklist configurazione (16) - Per nuovi utenti

Biometria (12) - Struttura futura

Conferma email (15) - Richiede backend

📁 FILE INTERESSATI
index.html (principale)

style.css (eventuali stili aggiuntivi)

db-config.js (per controlli configurazione)

menu.html (per verificare compatibilità)

✅ TEST DA EFFETTUARE
Connessione assente / presente

Login con PIN errato / corretto

Account attivo / non attivo

Tema chiaro / scuro

Dispositivi mobile / desktop

Browser con/senza supporto biometria

