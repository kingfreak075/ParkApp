PROMPT PER CONTINUAZIONE PROGETTO SUPABASE ESA
📁 CONTESTO PROGETTO ATTIVO
Applicazione: Gestione tecnici ESA con sincronizzazione CSV
Stato attuale: Tabella tecnici configurata con caricamento CSV semplificato (3 campi utente, resto automatico)
Tecnologie: Supabase, JavaScript, CSV processing

🎯 OBIETTIVI FUTURI
1. SISTEMA DI UPLOAD CSV FLESSIBILE
text
IMPLEMENTARE: Upload CSV differenziato per tipo tabella
├── 📊 TABELLE "UPLOAD-ABILI" (con CSV)
│   ├── tecnici (già implementato)
│   ├── clienti
│   ├── materiali/ricambi
│   ├── listino_prezzi
│   └── [altre da definire]
│
└── 📁 TABELLE "BACKUP-ONLY" (solo export)
    ├── log_attività
    ├── interventi
    ├── fatture
    ├── ordini
    └── [altre da definire]
2. REGOLE PER OGNI TABELLA UPLOAD-ABILE
text
PER OGNI TABELLA DEFINIRE:
├── 🏷️  Nome tabella Supabase
├── 📝  Descrizione uso
├── ✅  Campi obbligatori (CSV)
├── 🔧  Campi automatici (server)
├── 📏  Validazioni specifiche
├── 🔗  Relazioni con altre tabelle
├── 👥  Permessi RLS
└── ⚠️  Comportamento sync (upsert/insert/delete)
3. INTERFACCIA ADMIN COMPLETA
text
FUNZIONALITÀ DA IMPLEMENTARE:
├── 🗂️  Selezione tabella target
├── 📤  Upload CSV con preview
├── ⚙️  Configurazione mapping colonne
├── 🔄  Opzioni sincronizzazione
│   ├── Sostituisci tutto
│   ├── Aggiungi nuovi
│   ├── Aggiorna esistenti
│   └── Merge intelligente
├── 📊  Report differenze pre-upload
├── ✅  Conferma/rollback
└── 📥  Download backup (tutte le tabelle)
📋 TEMPLATE PER NUOVE TABELLE UPLOAD-ABILI
sql
-- ESEMPIO: Tabella clienti
CREATE TABLE clienti (
    -- Automatici (NON nel CSV)
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    uid UUID DEFAULT gen_random_uuid() UNIQUE,
    
    -- Da CSV (CAMPI UTENTE)
    codice_cliente VARCHAR(20) UNIQUE NOT NULL,
    ragione_sociale VARCHAR(255) NOT NULL,
    indirizzo TEXT,
    citta VARCHAR(100),
    provincia VARCHAR(2),
    cap VARCHAR(5),
    piva VARCHAR(11),
    telefono VARCHAR(20),
    email VARCHAR(255),
    
    -- Automatici ma modificabili
    stato VARCHAR(20) DEFAULT 'attivo',
    categoria VARCHAR(50) DEFAULT 'standard',
    
    -- Vincoli CSV
    CONSTRAINT check_cap_format CHECK (cap ~ '^[0-9]{5}$'),
    CONSTRAINT check_provincia CHECK (provincia ~ '^[A-Z]{2}$')
);

-- Configurazione upload per questa tabella
INSERT INTO upload_config (table_name, csv_columns, auto_columns, validation_rules) VALUES
('clienti', 
 'codice_cliente,ragione_sociale,indirizzo,citta,provincia,cap,piva,telefono,email',
 'id,created_at,updated_at,uid,stato,categoria',
 '{"codice_cliente": "required|unique", "cap": "regex:^[0-9]{5}$", "provincia": "regex:^[A-Z]{2}$"}'
);
🔧 ARCHITETTURA DA COMPLETARE
A. TABELLA DI CONFIGURAZIONE UPLOAD
sql
CREATE TABLE upload_config (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    csv_columns TEXT, -- "col1,col2,col3"
    auto_columns TEXT, -- "id,created_at,uid"
    validation_rules JSONB, -- {col1: "required", col2: "email"}
    sync_mode VARCHAR(20) DEFAULT 'replace', -- replace/upsert/append
    rls_policy JSONB, -- lettura/scrittura
    created_at TIMESTAMPTZ DEFAULT NOW()
);
B. LOG DELLE OPERAZIONI
sql
CREATE TABLE sync_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50),
    operation VARCHAR(20), -- upload/backup/restore
    records_count INTEGER,
    sync_mode VARCHAR(20),
    status VARCHAR(20), -- success/error/partial
    details JSONB,
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW()
);
🚀 ROADMAP IMPLEMENTAZIONE
FASE 1: BASE (COMPLETATA)
Tabella tecnici con upload CSV

Sincronizzazione base (sostituzione totale)

FASE 2: ESPANSIONE TABELLE
Definire lista tabelle upload-abili vs backup-only

Creare template SQL per ogni tabella

Implementare configurazione dinamica per upload

FASE 3: LOGICA AVANZATA
Sistema di validazione CSV pre-upload

Differenze tra CSV e DB esistente

Multiple sync strategies (upsert/merge)

Rollback automatico su errori

FASE 4: INTERFACCIA COMPLETA
Pannello admin con selezione tabella

Preview CSV con highlight errori

Configurazione mapping colonne drag-drop

Storico operazioni con report

💡 IDEE AVANZATE (FUTURO)
text
1. SCHEDULAZIONE AUTO-BACKUP
   - Backup giornaliero automatico
   - Conservazione 30 giorni
   - Download one-click

2. TEMPLATE CSV
   - Download template precompilato
   - Validazione in tempo reale
   - Autocompletamento da DB esistente

3. API ESTERNE
   - Webhook post-sincronizzazione
   - Integrazione con sistema contabile
   - Export per app mobile

4. MULTI-TENANT
   - Aziende separate
   - Upload massivo multi-tenant
   - Permessi incrociati
📞 INFO PER RIPRENDERE IL PROGETTO
text
PROGETTO: ESA Technicians Management System
REPOSITORY: [inserire link quando creato]
SUPABASE URL: berlfu...supabase.co
TABELLA BASE: tecnici (già funzionante)
PROSSIMA TABELLA: [da definire - clienti/materiali]
PRIORITÀ: Estendere a 2-3 tabelle upload-abili
❓ DOMANDE DA RISOLVERE AL PROSSIMO INCONTRO
Quali sono le prossime 2-3 tabelle più urgenti?

Serve logica di "merge" o solo "sostituzione totale"?

Chi deve avere permessi di upload? Solo super-admin?

Frequenza attesa degli upload? Giornaliera/settimanale?

Serve notifica email post-sincronizzazione?

