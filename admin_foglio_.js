// ============================================
// ADMIN FOGLI LAVORO - VERSIONE TEST
// ============================================

console.log('🚀 ADMIN FOGLI - CARICAMENTO IN CORSO');

// DICHIARAZIONE FUNZIONI GLOBALI IMMEDIATA
window.caricaFogli = function() { 
    console.log('✅ caricaFogli eseguita');
    alert('caricaFogli funziona!');
};

window.mostraModalNuovoFoglio = function() { 
    console.log('✅ mostraModalNuovoFoglio eseguita');
    alert('mostraModalNuovoFoglio funziona!');
};

window.switchVistaFogli = function(vista) { 
    console.log('✅ switchVistaFogli eseguita', vista);
    alert('switchVistaFogli funziona!');
};

window.switchTipoRiepilogo = function(tipo) { 
    console.log('✅ switchTipoRiepilogo eseguita', tipo);
    alert('switchTipoRiepilogo funziona!');
};

window.filtraFogli = function() { 
    console.log('✅ filtraFogli eseguita');
    alert('filtraFogli funziona!');
};

window.esportaCSVFogli = function() { 
    console.log('✅ esportaCSVFogli eseguita');
    alert('esportaCSVFogli funziona!');
};

window.mostraImportFogli = function() { 
    console.log('✅ mostraImportFogli eseguita');
    alert('mostraImportFogli funziona!');
};

console.log('✅ ADMIN FOGLI - FUNZIONI GLOBALI REGISTRATE');
console.log('📋 Funzioni disponibili:', Object.keys(window).filter(k => k.includes('Fogli')));