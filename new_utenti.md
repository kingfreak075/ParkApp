## GESTIONE UTENTI - PUNTO DI RIPARTENZA

### ✅ Già completato:
- Struttura tabella `profiles` collegata a `auth.users`
- Visualizzazione utenti nella sezione USER
- Statistiche per ruolo
- Modale per nuovo utente con due tab (manuale/import)
- Caricamento tecnici/supervisori senza account

### ⏸️ In pausa (DA COMPLETARE):
1. **Creazione utenti** - Da implementare con Edge Functions (service key non usabile in browser)
   - File: `supabase/functions/create-user/index.ts`
   - Deploy con: `supabase functions deploy create-user`

2. **Modifica utente** - Da implementare in `admin_users.js`
   - Funzione `modificaUtente(userId)`

3. **Reset password** - Da implementare in `admin_users.js`
   - Funzione `resettaPassword(userId)`

4. **Eliminazione utente** - Da implementare in `admin_users.js`
   - Funzione `eliminaUtente(userId)`

### 📂 File coinvolti:
- `admin_users.js` - Logica principale
- `supabase/functions/create-user/index.ts` - Edge Function
- `admin_database.html` - Modale già pronta
- `db-config.js` - Già configurato

### 🔗 Prossimi passi quando riprendi:
1. Implementare Edge Function per creazione
2. Completare funzioni CRUD in admin_users.js
3. Testare con utenti reali