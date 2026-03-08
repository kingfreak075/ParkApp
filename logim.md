Stiamo facendo un passo indietro per ricostruire il flusso corretto di autenticazione e gestione profilo. Ecco un prompt dettagliato che riassume tutto il percorso, le regole e i passaggi da seguire per implementare correttamente l'applicazione. Lo scrivo in modo che tu possa usarlo come riferimento per la prossima sessione.

PROMPT: Flusso di autenticazione e gestione profilo per ParkApp
Contesto
L'applicazione ParkApp ha due livelli di autenticazione:

Tabella tecnici (database Supabase) – contiene i dati anagrafici, il PIN (4 cifre), il ruolo e lo stato dell'account.

Auth Supabase – gestisce l'accesso tramite email/password (password standard iniziale Esa123!).

Gli utenti (tecnici) sono precaricati nella tabella tecnici con PIN e ruolo. Alcuni di essi hanno anche un corrispondente account in Auth (collegato tramite auth_user_id), ma non tutti.

Obiettivo
Realizzare un flusso di login intelligente che:

Verifichi le credenziali sulla tabella tecnici (email + PIN).

Controlli l'esistenza dell'utente in Auth Supabase.

Gestisca i casi:

Primo accesso (password standard): login OK, reindirizzamento a profilo.html per il cambio password obbligatorio.

Accesso successivo dallo stesso dispositivo: solo PIN, login diretto (grazie a dispositivo riconosciuto).

Accesso da un nuovo dispositivo: richiesta della password Auth (tramite modale) e, se corretta, salvataggio del dispositivo.

Permetta all'utente loggato di cambiare PIN (tabella tecnici) e password (Auth Supabase) dalla pagina profilo.html.

Mantenga la sessione coerente dopo le modifiche.

Regole e vincoli
Il campo email nella tabella tecnici si chiama Mail (con la M maiuscola). È univoco.

Il PIN è di 4 cifre, memorizzato in chiaro (per semplicità, ma in produzione andrebbe hashato).

La password Auth standard è Esa123!.

Il riconoscimento del dispositivo si basa su un ID generato e salvato in localStorage (device_id), associato all'email.

Le password Auth non vengono mai memorizzate in chiaro se non nel localStorage criptato (ma per ora in chiaro, attenzione).

Dopo il cambio password, la sessione Auth deve rimanere valida (non è necessario rifare il login).

Struttura dei file coinvolti
index.html – pagina di login.

auth.js – contiene tutta la logica di autenticazione.

db-config.js – gestisce la configurazione del client Supabase.

profilo.html – pagina per la gestione del profilo (cambio PIN/password).

menu.html – pagina principale dopo il login.

Passi da implementare (dettaglio)
1. Login (auth.js – funzione _accedi(email, pin))
Pulizia input: rimuovere spazi e caratteri speciali dall'email.

Verifica tabella tecnici:

Usare il campo Mail (maiuscolo) per cercare l'utente.

Se non trovato → messaggio "Email non registrata".

Se trovato ma attivo === false → messaggio "Account in attesa".

Se PIN errato → messaggio "PIN errato".

Verifica dispositivo conosciuto:

Leggere da localStorage l'array dispositivi_${email}.

Confrontare con device_id corrente.

Se presente, recuperare la password salvata (password_${email}) e tentare il login Auth con quella.

Se successo → authSuccess = true.

Se fallisce → rimuovere il dispositivo e proseguire.

Se non ancora autenticato, tenta con password standard:

Eseguire signInWithPassword con Esa123!.

Se successo:

Salvare dispositivo e password standard.

Impostare flag primo_accesso in localStorage.

Salvare utente in sessione (sessionStorage) e reindirizzare a profilo.html?primo_accesso=true.

Restituire true (interrompere il flusso).

Se nessuno dei precedenti ha funzionato:

Salvare i dati temporanei (email, tecnico) in sessionStorage.

Mostrare un modale per richiedere la password Auth (funzione mostraModalePassword).

Restituire false (in attesa della password dal modale).

Login completato:

Salvare utente in sessionStorage e dati essenziali in localStorage.

Reindirizzare a menu.html.

2. Modale password (auth.js)
Creare un overlay con campo password e pulsanti "Continua" / "Annulla".

Alla conferma, recuperare email e tecnico da sessionStorage, tentare login Auth con la password inserita.

Se OK: salvare dispositivo e password, pulire sessione temporanea, completare login e reindirizzare.

Se errata: mostrare errore e rimanere nel modale.

3. Pagina profilo.html
Caricamento:

Verificare presenza utente in sessione (authGetUtente()), altrimenti redirect a index.html.

Mostrare dati anagrafici (nome, email, ruolo, ID).

Se parametro primo_accesso=true o flag in localStorage, mostrare messaggio ed evidenziare la sezione cambio password.

Cambio PIN:

Validare campi (tutti obbligatori, nuovo PIN 4 cifre, conferma uguale, diverso dal vecchio).

Chiamare authCambiaPin(email, vecchioPin, nuovoPin) (da auth.js).

In caso di successo, aggiornare l'oggetto utenteCorrente in sessione e pulire i campi.

Cambio password Auth:

Validare campi (nuova password >= 6 caratteri, conferma uguale, diversa dalla vecchia).

Verificare la password attuale con signInWithPassword.

Se OK, chiamare updateUser({ password: nuovaPassword }).

In caso di successo, mostrare messaggio e pulire campi. Non è necessario rifare il login.

Attenzione: non dichiarare una variabile globale supabase per evitare conflitti; usare getSupabaseClient() quando serve.

4. Protezione pagine
In ogni pagina protetta (menu, profilo, ecc.), all'avvio verificare la presenza di utenteCorrente in sessione; se assente, redirect a index.html.

In menu.html, aggiungere icona profilo (account_circle) che porta a profilo.html.

5. Gestione errori e feedback
Usare una funzione mostraMessaggio(testo, tipo) per mostrare notifiche temporanee.

Disabilitare i pulsanti durante le operazioni asincrone e mostrare spinner di caricamento.

Catturare eccezioni e mostrare messaggi user-friendly.

Note tecniche importanti
Ordine di inclusione script: in ogni pagina, includere prima Supabase JS, poi db-config.js, poi auth.js.

Conflitto di variabili: evitare di dichiarare supabase come variabile globale in più file; usare funzioni come getSupabaseClient().

Sincronizzazione sessione: dopo cambio PIN/password, aggiornare l'oggetto in sessionStorage per riflettere le modifiche.

LocalStorage vs SessionStorage: usare sessionStorage per i dati dell'utente corrente (più sicuro), localStorage per configurazioni e dispositivi conosciuti.

Prossimi passi (da verificare)
Testare il login con un utente che ha solo tabella (no Auth) → deve bloccare con messaggio "Contatta amministratore".

Testare il primo accesso con password standard → redirect a profilo con messaggio.

Testare il cambio PIN e verificare che il nuovo PIN funzioni al prossimo login.

Testare il cambio password e verificare che la nuova password funzioni al prossimo accesso da un altro dispositivo.

Verificare che dopo il cambio password, le query alle tabelle continuino a funzionare (sessione Auth valida).

Verificare che il riconoscimento dispositivo funzioni (stesso browser, stesso dispositivo).