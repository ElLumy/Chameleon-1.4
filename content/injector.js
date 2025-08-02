// content/injector.js
// Este script se ejecuta en el contexto ISOLATED y actúa como puente
(async function() {
  'use strict';
  
  console.log('[Chameleon Injector] Starting initialization...');
  
  // Verificar que chrome.runtime esté disponible
  if (!chrome?.runtime?.id) {
    console.error('[Chameleon Injector] Extension context not available');
    return;
  }
  
  // Inyectar script principal en el contexto MAIN
  function injectMainWorldScript(content, scriptId) {
    try {
      const script = document.createElement('script');
      script.id = scriptId;
      script.textContent = content;
      
      // Inyectar al principio del documento
      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(script);
        script.remove();
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[Chameleon Injector] Failed to inject ${scriptId}:`, error);
      return false;
    }
  }
  
  // Inyectar script desde archivo
  async function injectScriptFile(file) {
    try {
      const url = chrome.runtime.getURL(file);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${file}: ${response.status}`);
      }
      const content = await response.text();
      const scriptId = 'chameleon-' + file.replace(/[^a-zA-Z0-9]/g, '-');
      return injectMainWorldScript(content, scriptId);
    } catch (error) {
      console.error(`[Chameleon Injector] Failed to inject ${file}:`, error);
      return false;
    }
  }
  
  // Cargar datos necesarios
  async function loadInitialData() {
    try {
      // Cargar profiles.json
      const profilesResponse = await fetch(chrome.runtime.getURL('data/profiles.json'));
      if (!profilesResponse.ok) {
        throw new Error('Failed to load profiles data');
      }
      const profilesData = await profilesResponse.json();
      
      // Obtener seed de sesión
      let sessionSeed = null;
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getSessionSeed' });
        if (response && response.seed) {
          sessionSeed = response.seed;
        }
      } catch (error) {
        console.error('[Chameleon Injector] Failed to get seed from background:', error);
      }
      
      // Si no hay seed, generar uno localmente
      if (!sessionSeed) {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        sessionSeed = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
        console.warn('[Chameleon Injector] Using locally generated seed');
      }
      
      return { profilesData, sessionSeed };
      
    } catch (error) {
      console.error('[Chameleon Injector] Failed to load initial data:', error);
      return null;
    }
  }
  
  // Script para establecer comunicación con el contexto MAIN
  const bridgeScript = `
    (function() {
      'use strict';
      
      // Create communication bridge
      window.__chameleonBridge = {
        pendingCallbacks: new Map(),
        callbackId: 0,
        
        sendToIsolated: function(action, data) {
          const id = ++this.callbackId;
          return new Promise((resolve) => {
            this.pendingCallbacks.set(id, resolve);
            window.postMessage({
              source: 'chameleon-main',
              id: id,
              action: action,
              data: data
            }, '*');
          });
        },
        
        handleResponse: function(id, data) {
          const callback = this.pendingCallbacks.get(id);
          if (callback) {
            callback(data);
            this.pendingCallbacks.delete(id);
          }
        }
      };
      
      // Listen for responses
      window.addEventListener('message', (event) => {
        if (event.data && event.data.source === 'chameleon-isolated' && event.data.id) {
          window.__chameleonBridge.handleResponse(event.data.id, event.data.data);
        }
      });
      
      console.log('[Chameleon] Bridge established');
    })();
  `;
  
  // Función principal de inicialización
  async function initialize() {
    try {
      console.log('[Chameleon Injector] Loading initial data...');
      const initialData = await loadInitialData();
      
      if (!initialData) {
        throw new Error('Failed to load initial data');
      }
      
      console.log('[Chameleon Injector] Initial data loaded successfully');
      
      // Inyectar el bridge primero
      injectMainWorldScript(bridgeScript, 'chameleon-bridge');
      
      // Inyectar datos iniciales
      const initDataScript = `
        window.__chameleonInitData = {
          profilesData: ${JSON.stringify(initialData.profilesData)},
          sessionSeed: ${JSON.stringify(initialData.sessionSeed)}
        };
        console.log('[Chameleon] Initial data injected');
      `;
      injectMainWorldScript(initDataScript, 'chameleon-init-data');
      
      // Lista de scripts a inyectar en orden
      const scriptsToInject = [
        'lib/seedrandom.min.js',
        'content/modules/utils/jitter.js',
        'content/modules/interceptors/meta-proxy.js',
        'content/modules/interceptors/navigator.js',
        'content/modules/interceptors/screen.js',
        'content/modules/interceptors/canvas.js',
        'content/modules/interceptors/webgl.js',
        'content/modules/interceptors/audio.js',
        'content/modules/interceptors/timezone.js',
        'content/chameleon-main.js'
      ];
      
      // Inyectar scripts secuencialmente
      for (const script of scriptsToInject) {
        const success = await injectScriptFile(script);
        if (success) {
          console.log(`[Chameleon Injector] Successfully injected: ${script}`);
        } else {
          console.error(`[Chameleon Injector] Failed to inject: ${script}`);
        }
      }
      
      console.log('[Chameleon Injector] All scripts injected');
      
      // Establecer comunicación con el contexto MAIN
      setupCommunicationBridge();
      
    } catch (error) {
      console.error('[Chameleon Injector] Initialization failed:', error);
    }
  }
  
  // Configurar el puente de comunicación
  function setupCommunicationBridge() {
    // Escuchar mensajes del contexto MAIN
    window.addEventListener('message', async (event) => {
      if (event.data && event.data.source === 'chameleon-main') {
        console.log('[Chameleon Injector] Received message from MAIN:', event.data.action);
        
        let response = null;
        
        try {
          switch (event.data.action) {
            case 'saveProfile':
              // Guardar el perfil en storage
              await chrome.storage.session.set({
                profile: event.data.data.profile,
                timestamp: Date.now()
              });
              response = { success: true };
              console.log('[Chameleon Injector] Profile saved to storage');
              break;
              
            case 'getSessionInfo':
              const info = await chrome.runtime.sendMessage({ action: 'getSessionInfo' });
              response = info;
              break;
              
            case 'checkVPN':
              const vpnStatus = await chrome.runtime.sendMessage({ action: 'checkVPN' });
              response = vpnStatus;
              break;
              
            default:
              response = { error: 'Unknown action' };
          }
        } catch (error) {
          console.error('[Chameleon Injector] Error handling message:', error);
          response = { error: error.message };
        }
        
        // Enviar respuesta al contexto MAIN
        window.postMessage({
          source: 'chameleon-isolated',
          id: event.data.id,
          action: event.data.action,
          data: response
        }, '*');
      }
    });
    
    console.log('[Chameleon Injector] Communication bridge established');
  }
  
  // Iniciar cuando el documento esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    // Si el DOM ya está cargado, esperar un momento para asegurar que todo esté listo
    setTimeout(initialize, 0);
  }
  
})();