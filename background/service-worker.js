// background/service-worker.js

// Estado global del service worker
let sessionData = {
  seed: null,
  profile: null,
  initialized: false,
  sessionStartTime: null
};

// Inicialización cuando se instala la extensión
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Chameleon] Extension installed/updated:', details.reason);
  
  // Solo inicializar nueva sesión en instalación nueva
  if (details.reason === 'install') {
    await initializeSession();
  } else if (details.reason === 'update') {
    // En actualización, intentar restaurar sesión existente
    await restoreSession();
  }
});

// Inicialización cuando se inicia el navegador
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Chameleon] Browser started');
  await restoreSession();
});

// Restaurar sesión existente o crear nueva
async function restoreSession() {
  try {
    const stored = await chrome.storage.session.get(['sessionSeed', 'sessionStartTime', 'profile']);
    
    if (stored.sessionSeed) {
      sessionData.seed = stored.sessionSeed;
      sessionData.sessionStartTime = stored.sessionStartTime;
      sessionData.profile = stored.profile;
      sessionData.initialized = true;
      console.log('[Chameleon] Session restored:', sessionData.seed.substring(0, 8) + '...');
    } else {
      console.log('[Chameleon] No existing session found, creating new one');
      await initializeSession();
    }
  } catch (error) {
    console.error('[Chameleon] Error restoring session:', error);
    await initializeSession();
  }
}

// Inicializa una nueva sesión
async function initializeSession() {
  try {
    // Generar nueva semilla
    const seed = generateSessionSeed();
    const startTime = Date.now();
    
    // Guardar en storage
    await chrome.storage.session.set({ 
      sessionSeed: seed,
      sessionStartTime: startTime,
      profile: null // Se actualizará cuando el content script genere el perfil
    });
    
    sessionData.seed = seed;
    sessionData.sessionStartTime = startTime;
    sessionData.initialized = true;
    sessionData.profile = null;
    
    console.log('[Chameleon] New session initialized with seed:', seed.substring(0, 8) + '...');
    
    // Limpiar cookies y cache de sitios objetivo
    await clearTargetSiteData();
  } catch (error) {
    console.error('[Chameleon] Error initializing session:', error);
    
    // Como fallback, generar seed local
    sessionData.seed = generateSessionSeed();
    sessionData.sessionStartTime = Date.now();
    sessionData.initialized = true;
  }
}

// Genera una semilla criptográficamente segura
function generateSessionSeed() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Limpia datos de sitios específicos
async function clearTargetSiteData() {
  const targetDomains = [
    'twitch.tv',
    'youtube.com',
    'facebook.com',
    'meta.com',
    'tiktok.com'
  ];
  
  try {
    // Limpiar cookies
    for (const domain of targetDomains) {
      const cookies = await chrome.cookies.getAll({ domain: `.${domain}` });
      for (const cookie of cookies) {
        await chrome.cookies.remove({
          url: `https://${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}${cookie.path}`,
          name: cookie.name
        });
      }
    }
    
    // Limpiar otros datos
    await chrome.browsingData.remove({
      hostnames: targetDomains
    }, {
      cache: true,
      localStorage: true,
      indexedDB: true,
      serviceWorkers: true
    });
    
    console.log('[Chameleon] Cleared data for target sites');
  } catch (error) {
    console.error('[Chameleon] Error clearing site data:', error);
  }
}

// Manejo de mensajes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Chameleon] Received message:', request.action, 'from:', sender.tab?.id || 'extension');
  
  // Manejar mensajes asíncronos
  (async () => {
    try {
      let response = {};
      
      switch (request.action) {
        case 'getSessionSeed':
          response = await handleGetSessionSeed();
          break;
          
        case 'regenerateIdentity':
          response = await handleRegenerateIdentity();
          break;
          
        case 'getSessionInfo':
          response = await getSessionInfo();
          break;
          
        case 'checkVPN':
          response = await checkVPNStatus();
          break;
          
        default:
          console.warn('[Chameleon] Unknown message action:', request.action);
          response = { error: 'Unknown action' };
      }
      
      console.log('[Chameleon] Sending response:', response);
      sendResponse(response);
    } catch (error) {
      console.error('[Chameleon] Message handler error:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  // Return true to indicate async response
  return true;
});

// Obtener semilla de sesión
async function handleGetSessionSeed() {
  try {
    // Si no está inicializado, inicializar ahora
    if (!sessionData.initialized || !sessionData.seed) {
      console.log('[Chameleon] Session not initialized, initializing now');
      await initializeSession();
    }
    
    // Verificar que tenemos seed
    if (sessionData.seed) {
      return { seed: sessionData.seed };
    }
    
    // Si aún no hay seed, intentar obtener de storage
    const stored = await chrome.storage.session.get('sessionSeed');
    if (stored.sessionSeed) {
      sessionData.seed = stored.sessionSeed;
      return { seed: stored.sessionSeed };
    }
    
    // Como último recurso, generar nueva
    console.warn('[Chameleon] No seed found, generating new one');
    await initializeSession();
    return { seed: sessionData.seed };
    
  } catch (error) {
    console.error('[Chameleon] Error getting session seed:', error);
    // Generar nueva semilla como fallback
    const newSeed = generateSessionSeed();
    sessionData.seed = newSeed;
    return { seed: newSeed };
  }
}

// Regenera la identidad manualmente
async function handleRegenerateIdentity() {
  try {
    // Limpiar storage de sesión
    await chrome.storage.session.clear();
    
    // Inicializar nueva sesión
    await initializeSession();
    
    // Recargar todas las pestañas
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome://')) {
        chrome.tabs.reload(tab.id);
      }
    }
    
    return { success: true, message: 'Identity regenerated successfully' };
  } catch (error) {
    console.error('[Chameleon] Error regenerating identity:', error);
    return { success: false, error: error.message };
  }
}

// Obtiene información de la sesión actual
async function getSessionInfo() {
  try {
    // Asegurar que la sesión esté inicializada
    if (!sessionData.initialized) {
      console.log('[Chameleon] Session not initialized, restoring/initializing');
      await restoreSession();
    }
    
    // Obtener datos actualizados del storage
    const stored = await chrome.storage.session.get(['sessionSeed', 'profile', 'sessionStartTime', 'timestamp']);
    
    // Actualizar datos locales si es necesario
    if (stored.profile && (!sessionData.profile || stored.timestamp > sessionData.profileTimestamp)) {
      sessionData.profile = stored.profile;
      sessionData.profileTimestamp = stored.timestamp;
    }
    
    const result = { 
      seed: stored.sessionSeed || sessionData.seed,
      profile: stored.profile || sessionData.profile || null,
      sessionStartTime: stored.sessionStartTime || sessionData.sessionStartTime || Date.now(),
      timestamp: stored.timestamp || Date.now()
    };
    
    console.log('[Chameleon] Returning session info:', {
      hasSeed: !!result.seed,
      hasProfile: !!result.profile,
      profileAge: result.timestamp ? Date.now() - result.timestamp : 'N/A'
    });
    
    return result;
  } catch (error) {
    console.error('[Chameleon] Error getting session info:', error);
    return { 
      error: error.message,
      seed: sessionData.seed,
      profile: sessionData.profile
    };
  }
}

// Verifica el estado de VPN
async function checkVPNStatus() {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch IP info');
    }
    
    const data = await response.json();
    
    // Detectar indicadores de VPN
    const vpnIndicators = [
      data.org?.toLowerCase().includes('vpn'),
      data.org?.toLowerCase().includes('proxy'),
      data.org?.toLowerCase().includes('hosting'),
      data.org?.toLowerCase().includes('cloud'),
      data.org?.toLowerCase().includes('datacenter')
    ];
    
    const isVPN = vpnIndicators.some(indicator => indicator === true);
    
    return {
      ip: data.ip,
      country: data.country_name,
      countryCode: data.country,
      city: data.city,
      region: data.region,
      timezone: data.timezone,
      org: data.org,
      isVPN,
      asn: data.asn,
      latitude: data.latitude,
      longitude: data.longitude
    };
  } catch (error) {
    console.error('[Chameleon] Error checking VPN status:', error);
    return { error: 'Failed to check VPN status' };
  }
}

// Listener para cuando se conecta una nueva pestaña
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url && !tab.url.startsWith('chrome://')) {
    try {
      // Asegurar que la sesión esté inicializada
      if (!sessionData.initialized) {
        await restoreSession();
      }
    } catch (error) {
      console.error('[Chameleon] Error on tab update:', error);
    }
  }
});

// Listener para cuando se activa el service worker
self.addEventListener('activate', async (event) => {
  console.log('[Chameleon] Service worker activated');
  event.waitUntil(restoreSession());
});

// Inicializar al cargar el service worker
(async () => {
  try {
    console.log('[Chameleon] Service worker starting...');
    await restoreSession();
  } catch (error) {
    console.error('[Chameleon] Error during startup:', error);
  }
})();