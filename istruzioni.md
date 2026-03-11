## 📚 DOCUMENTAZIONE UTENTE - ParkApp

### INDICE
1. [Introduzione](#introduzione)
2. [Accesso all'Applicazione](#accesso)
3. [Dashboard Principale](#dashboard)
4. [Moduli per Tecnici](#tecnici)
5. [Moduli per Supervisori/Admin](#supervisori)
6. [Console Admin (PC)](#console-admin)
7. [Gestione Allegati](#allegati)
8. [FAQ](#faq)

---

## 1. INTRODUZIONE {#introduzione}

**ParkApp** è un'applicazione mobile-first per la gestione completa delle attività tecniche, progettata per:
- **Tecnici** - Operatività sul campo
- **Supervisori** - Coordinamento e controllo
- **Amministratori** - Gestione completa del sistema

**Versione:** 2.0  
**Edit by:** KINGFREAK

---

## 2. ACCESSO ALL'APPLICAZIONE {#accesso}

### 2.1 Primo Accesso
1. Apri `index.html`
2. Inserisci **Email** e **Password** fornite dall'amministratore
3. Al primo accesso, ti verrà chiesto di impostare un **PIN a 4 cifre**

### 2.2 Accessi Successivi
- Seleziona il tuo nome dalla lista dei tecnici memorizzati
- Inserisci il PIN a 4 cifre tramite tastierino numerico
- Clicca **SBLOCCA**

### 2.3 Gestione Tecnici Memorizzati
- ✅ **Aggiungi nuovo** - Per memorizzare un nuovo tecnico
- 🗑️ **Elimina singolo** - Rimuovi un tecnico dalla lista
- 🧹 **Cancella tutti** - Pulisce tutta la lista

### 2.4 Configurazione Database
L'icona ⚙️ in alto a destra indica lo stato del database:
- 🟢 **Verde** - Database configurato
- 🔴 **Rosso** - Database non configurato

Clicca per aprire il modale di configurazione e inserire:
- Supabase URL
- Anon Key
- Oppure carica un file `.kf`

---

## 3. DASHBOARD PRINCIPALE (MENU) {#dashboard}

Dal menu principale puoi accedere a tutti i moduli:

| Icona | Modulo | Descrizione |
|-------|--------|-------------|
| 🏢 | PARCO | Elenco impianti |
| 🔧 | MANUTENZIONE | Piano manutenzioni |
| 📅 | GESTIONE | Gestione interventi |
| 🏗️ | MONTAGGIO | Lavori di montaggio |
| 📝 | AGENDA | I miei lavori |
| 📆 | CALENDARIO | Calendario impegni |
| 🚗 | GESTIONE AUTO | Veicolo assegnato |
| 💰 | NOTE SPESE | Gestione rimborsi |
| 🚨 | REPERIBILITÀ | Turni reperibilità |
| ⚙️ | CONFIGURAZIONE | Impostazioni app |

*Per supervisori/admin compare anche la sezione **AREA AMMINISTRATIVA** con moduli aggiuntivi.*

---

## 4. MODULI PER TECNICI {#tecnici}

### 4.1 PARCO IMPIANTI
Visualizza tutti gli impianti con:
- 🔍 **Ricerca** per impianto o indirizzo
- 🟢 **Badge verdi** per impianti in regola
- 🔴 **Badge rossi** per impianti in ritardo
- `DISDETTA` in rosso per impianti disdettati

### 4.2 AGENDA (I Miei Lavori)
Lista dei lavori assegnati con:
- 🏷️ **Badge colorati** per stato (Aperto, Accettata, Lavorazione, Sospesa, Chiusa)
- ⚡ **Priorità** (ALTA in rosso, BASSA in blu)
- 📍 **Indirizzo** dell'impianto (se presente in anagrafica)
- 📊 **Contatori** allegati/note

**Azioni disponibili:**
- 👁️ **Dettaglio** - Visualizza tutte le informazioni
- ✏️ **Cambia stato** - Tramite pulsanti rapidi
- 📝 **Note lavorazione** - Aggiungi note all'intervento
- 📎 **Allegati** - Visualizza documenti

**Stati modificabili dal tecnico:**
- Aperto → Accettata
- Accettata → Lavorazione / Sospesa
- Lavorazione → Sospesa / Chiusa
- Sospesa → Lavorazione / Chiusa

### 4.3 GESTIONE AUTO
Visualizza il veicolo a te assegnato con:
- 📊 **Statistiche kilometri** (totali, media mensile)
- 📅 **Ultimo inserimento**
- 🚨 **Reminder** per scadenze (assicurazione, revisione, bollo)

**Inserimento kilometri:**
1. Vai alla tab **Kilometri**
2. Clicca **Nuovo**
3. Seleziona mese/anno
4. Inserisci i km del tachimetro
5. Aggiungi note (opzionale)
6. Salva (in attesa di conferma supervisore)

### 4.4 NOTE SPESE
Gestisci le tue spese:
- 🍽️ **Vitto/Trasporto** - Pasti, pernottamenti, mezzi
- 🚗 **Auto** - Km, pedaggi, parcheggi, lavaggio, carburante
- 📸 **Foto ricevute** - Scatta o carica foto degli scontrini

**Come inserire una spesa:**
1. Seleziona data
2. Indica se sei **Fuori Sede** (inserisci località)
3. Scegli tra Vitto o Auto
4. Inserisci importi
5. Scatta foto ricevute (opzionale)
6. Salva

### 4.5 REPERIBILITÀ
Visualizza i tuoi turni di reperibilità:
- 📅 **Calendario mensile** con turni evidenziati
- 📋 **Lista tutti i turni**
- 📊 **Statistiche personali**

**Richieste di modifica:**
1. Vai alla tab **Richieste**
2. Clicca **Nuova**
3. Scegli tipo (scambio, sostituzione, cessione parziale)
4. Seleziona turno e collega
5. Inserisci motivo
6. Invia richiesta

---

## 5. MODULI PER SUPERVISORI/ADMIN {#supervisori}

### 5.1 GESTIONE LAVORI (Agenda Admin)
Dashboard completa con:
- 📊 **Statistiche** (totali, aperti, in lavorazione, da terminare)
- 🔍 **Filtri avanzati** (stato, tecnico, priorità, ricerca)
- 👁️ **Vista completa** di tutti i lavori

**Azioni disponibili:**
- ➕ **Nuovo lavoro** - Crea un nuovo incarico
- ✏️ **Modifica** - Cambia dati del lavoro
- 🔄 **Cambia stato** - Modifica lo stato (anche saltando fasi)
- 🗑️ **Elimina** - Rimuovi lavoro (solo se necessario)
- 📝 **Note** - Aggiungi note di lavorazione
- 📎 **Allegati** - Gestisci documenti
- ✅ **Termina** - Solo per lavori in stato "Chiusa"

**Creazione nuovo lavoro:**
1. Clicca **NUOVO LAVORO**
2. Inserisci **Impianto** (ricerca automatica indirizzo)
3. Seleziona **Tecnico**
4. Scegli **Tipo lavoro**
5. Imposta **Priorità** (ALTA/BASSA)
6. Aggiungi **Note lavoro** (opzionale)
7. Salva

### 5.2 MANUTENZIONI
Piano manutenzioni completo:
- 📊 **Statistiche globali** e per manutentore
- 🔍 **Filtri** per mese, manutentore, periodicità
- 📍 **Indicatori visivi**:
  - 🟢 Verde: manutenzione nel mese corrente
  - ⚫ Nero: regolare (<180 giorni)
  - 🔴 Rosso: in ritardo (>180 giorni)

**Azioni:**
- ▶️ **Esegui** - Avvia intervento
- 📝 **Annotazioni** - Aggiungi note all'impianto

### 5.3 REPERIBILITÀ (Admin)
Gestione completa turni:
- 🗺️ **Zone** - Crea e gestisci zone
- 📤 **Carica CSV** - Importa turni da file
- 🗓️ **Festività** - Gestisci giorni festivi
- 📋 **Approvazioni** - Gestisci richieste di modifica

---

## 6. CONSOLE ADMIN (PC) {#console-admin}

Accessibile da `admin_database.html` per supervisori/admin, offre una vista desktop completa.

### 6.1 Configurazione Database
- Visualizza stato connessione
- Inserimento manuale URL/Key
- Carica file `.kf`
- Test connessione

### 6.2 Gestione Tabelle
- Elenco tutte le tabelle
- Statistiche (record, dimensione)
- Anteprima dati
- Creazione nuove tabelle

### 6.3 Gestione Manuale
- **Personale** - Gestisci tecnici, manutentori, supervisori, venditori
- **Veicoli** - Assegnazione veicoli, approvazione kilometri
- **Reperibilità** - Gestione completa turni
- **Parco Impianti** - CRUD impianti
- **Fogli Lavoro** - Monitor presenze
- **Gestione Lavori** - Vista completa lavori
- **Annotazioni** - Gestione annotazioni

### 6.4 Utenti
- Crea nuovi utenti (manuale o importa da tabelle)
- Gestisci ruoli (admin/supervisore/tecnico)
- Reset password
- Statistiche accessi

---

## 7. GESTIONE ALLEGATI {#allegati}

### 7.1 Visualizzazione
Da qualsiasi lavoro puoi accedere agli allegati:
- 📄 **Lista PDF** con nome file e data
- 👁️ **Anteprima** integrata
- 🗑️ **Elimina** (solo se autorizzato)

### 7.2 Caricamento
1. Clicca sull'icona 📎
2. Seleziona file PDF (max 5MB)
3. Trascina nel drop zone o clicca per selezionare
4. Il file viene caricato e associato al lavoro

### 7.3 Visualizzatore PDF
- Schermo intero
- Navigazione tra pagine
- Zoom in/out
- Download

---

## 8. FAQ {#faq}

### D: Cosa fare se dimentico il PIN?
**R:** Usa "Usa un altro account" e fai login completo con email/password. Il sistema ti permetterà di reimpostare il PIN.

### D: Come cambio la password?
**R:** Dal menu, clicca sull'icona profilo 👤 e seleziona "Cambia password".

### D: Perché non vedo tutti i lavori?
**R:** I tecnici vedono solo i lavori a loro assegnati. Se sei supervisore/admin, controlla i filtri nella pagina.

### D: Come faccio a sapere se un impianto è in ritardo?
**R:** Nella pagina Parco, gli impianti in ritardo hanno data in 🔴 rosso.

### D: Posso modificare un lavoro dopo che è stato terminato?
**R:** No, una volta "Terminata" non è più modificabile. Se necessario, contatta un amministratore.

### D: Cosa significa "Da terminare"?
**R:** Lavori che il tecnico ha chiuso ma devono essere verificati e terminati dal supervisore.

### D: Come faccio a esportare i dati?
**R:** Dalla console admin, puoi esportare in CSV da quasi tutte le tabelle usando il pulsante 📥.

### D: I dati sono al sicuro?
**R:** Sì, tutti i dati sono su Supabase con crittografia e backup automatici. Le policy RLS garantiscono che ogni utente veda solo i dati autorizzati.

---

## 🔐 BACKUP E RECOVERY

### Backup Automatici (Supabase)
- ✅ Backup giornalieri automatici
- ✅ Conservazione per 30 giorni
- ✅ PITR (Point-in-Time Recovery) disponibile su richiesta

### Backup Manuali Consigliati
1. **Configurazione**: Esporta file `.kf` dalla pagina Configurazione
2. **Dati critici**: Dalla console admin, esporta tabelle importanti in CSV
3. **Allegati**: I file sono salvati su Supabase Storage (già backup automatici)

### Procedure di Recovery

**In caso di perdita dati:**
1. Contatta l'amministratore Supabase
2. Richiedi restore da backup automatico
3. Specifica data/ora di ripristino

**Migrazione a nuovo progetto:**
1. Esporta configurazione (file `.kf`)
2. Esporta tabelle in CSV
3. Crea nuovo progetto Supabase
4. Importa configurazione
5. Importa dati via CSV

### Strategie di Sicurezza
- 🔒 **RLS** - Ogni utente vede solo i propri dati
- 🔐 **PIN** - Secondo fattore di autenticazione
- 📋 **Logging** - Tutte le operazioni tracciate
- 👥 **Ruoli** - Separazione chiara delle responsabilità

---

📧 **Supporto:** kingfreak75@gmail.com  
📱 **Versione:** 2.0 - Marzo 2026

*Documentazione generata automaticamente - Per aggiornamenti, contattare l'amministratore.*