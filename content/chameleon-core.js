// content/chameleon-core.js
(function() {
  'use strict';
  
  // Verificar que no se ejecute múltiples veces
  if (window.__chameleonInitialized) {
    console.warn('[Chameleon] Already initialized');
    return;
  }
  
  window.__chameleonInitialized = true;
  
  console.log('[Chameleon] Starting initialization...');
  
  // ===== ESTADO GLOBAL =====
  const ChameleonState = {
    seed: null,
    profile: null,
    initialized: false,
    interceptedFunctions: new WeakSet(),
    platform: null,
    profilesData: null
  };
  
  // ===== UTILIDADES =====
  
  // Generador de números aleatorios con semilla
  function SeededRandom(seed) {
    if (!window.Math.seedrandom) {
      console.error('[Chameleon] seedrandom not loaded!');
      return Math.random;
    }
    return new Math.seedrandom(seed);
  }
  
  // Jitter gaussiano
  function generateJitter(mean = 2, stdDev = 1) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const jitter = mean + z0 * stdDev;
    return Math.max(0, Math.min(10, jitter));
  }
  
  // Aplicar jitter a una función
  async function applyJitter(fn) {
    const delay = generateJitter();
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return typeof fn === 'function' ? fn() : fn;
  }
  
  // ===== CARGAR DATOS DE PERFILES =====
  async function loadProfilesData() {
    try {
      const response = await fetch(chrome.runtime.getURL('data/profiles.json'));
      if (!response.ok) {
        throw new Error('Failed to load profiles data');
      }
      return await response.json();
    } catch (error) {
      console.error('[Chameleon] Failed to load profiles data:', error);
      return null;
    }
  }
  
  // ===== OBTENER SEMILLA =====
  async function getSessionSeed() {
    return new Promise((resolve) => {
      // Crear un canal de comunicación único
      const channelId = '__chameleon_seed_' + Math.random().toString(36).substring(7);
      
      // Escuchar la respuesta
      const handleMessage = (event) => {
        if (event.data && event.data.type === channelId && event.data.seed) {
          window.removeEventListener('message', handleMessage);
          resolve(event.data.seed);
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Inyectar script para obtener la semilla
      const script = document.createElement('script');
      script.textContent = `
        (async function() {
          try {
            const response = await chrome.runtime.sendMessage({ action: 'getSessionSeed' });
            window.postMessage({ type: '${channelId}', seed: response.seed }, '*');
          } catch (error) {
            console.error('[Chameleon] Failed to get seed:', error);
            // Generar semilla local como fallback
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            const seed = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
            window.postMessage({ type: '${channelId}', seed: seed }, '*');
          }
        })();
      `;
      
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      
      // Timeout para evitar bloqueo infinito
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        // Generar semilla local si no hay respuesta
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const seed = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
        resolve(seed);
      }, 1000);
    });
  }
  
  // ===== GENERADOR DE PERFILES =====
  function ProfileGenerator(profilesData, seed) {
    const rng = SeededRandom(seed);
    
    function selectWeighted(items) {
      const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
      let random = rng() * totalWeight;
      
      for (const item of items) {
        random -= item.weight;
        if (random <= 0) return item;
      }
      
      return items[items.length - 1];
    }
    
    function selectFromArray(array) {
      return array[Math.floor(rng() * array.length)];
    }
    
    function generate() {
      // Seleccionar arquetipo
      const archetype = selectWeighted(profilesData.deviceArchetypes);
      
      // Hardware
      const cpu = selectWeighted(
        archetype.hardware.cpu.cores.map((c, i) => ({
          value: c,
          weight: archetype.hardware.cpu.weights[i]
        }))
      ).value;
      
      const memory = selectFromArray(archetype.hardware.memory);
      const gpu = selectFromArray(archetype.hardware.gpuVendors);
      const gpuModel = selectFromArray(gpu.models);
      
      // Display
      const resolution = selectWeighted(archetype.display.resolutions);
      
      // Language and timezone
      const language = selectWeighted(
        archetype.languages.primary.map((l, i) => ({
          value: l,
          weight: archetype.languages.weights[i]
        }))
      ).value;
      
      // Timezone
      const regions = Object.entries(profilesData.timezoneRegions);
      const region = selectWeighted(
        regions.map(([name, zones]) => ({
          value: { name, zones },
          weight: zones.reduce((sum, z) => sum + z.weight, 0)
        }))
      );
      
      const timezoneData = selectWeighted(region.value.zones);
      
      // Chrome version
      const chromeVersion = selectWeighted(profilesData.chromeVersions);
      
      // Build user agent
      const userAgent = archetype.userAgentTemplate.replace('{chromeVersion}', chromeVersion.version);
      
      // Build profile
      return {
        seed: seed,
        archetype: archetype.id,
        summary: `${archetype.name} - ${resolution.width}x${resolution.height} - ${timezoneData.timezone}`,
        navigator: {
          userAgent: userAgent,
          platform: archetype.platform,
          language: language,
          languages: [language, language.split('-')[0], 'en-US', 'en'].filter((v, i, a) => a.indexOf(v) === i),
          hardwareConcurrency: cpu,
          deviceMemory: memory,
          maxTouchPoints: archetype.display.touchPoints,
          vendor: 'Google Inc.',
          vendorSub: '',
          productSub: '20030107',
          cookieEnabled: true,
          onLine: true,
          webdriver: false,
          pdfViewerEnabled: true,
          plugins: generatePlugins(archetype, rng),
          doNotTrack: null
        },
        screen: {
          width: resolution.width,
          height: resolution.height,
          availWidth: resolution.width,
          availHeight: resolution.height - 40, // Taskbar
          colorDepth: archetype.display.colorDepth,
          pixelDepth: archetype.display.pixelDepth,
          orientation: {
            angle: 0,
            type: resolution.width > resolution.height ? 'landscape-primary' : 'portrait-primary'
          }
        },
        webgl: {
          vendor: gpu.vendor,
          renderer: gpu.renderer.replace('{model}', gpuModel),
          version: 'WebGL 2.0',
          shadingLanguageVersion: 'WebGL GLSL ES 3.00',
          extensions: generateWebGLExtensions(gpu.vendor, rng)
        },
        canvas: {
          noise: rng() * 0.0001 + 0.00005,
          offsetX: Math.floor(rng() * 3) - 1,
          offsetY: Math.floor(rng() * 3) - 1
        },
        audio: {
          sampleRate: 48000,
          channelCount: 2,
          noise: rng() * 0.00002 + 0.00001
        },
        timezone: {
          name: timezoneData.timezone,
          offset: getTimezoneOffset(timezoneData.timezone),
          locale: language
        },
        fonts: selectFonts(archetype, rng),
        battery: {
          charging: rng() > 0.3,
          level: Math.round((0.2 + rng() * 0.8) * 100) / 100,
          chargingTime: rng() > 0.3 ? Math.floor(rng() * 3600) : Infinity,
          dischargingTime: Math.floor(rng() * 10800 + 3600)
        }
      };
    }
    
    function generatePlugins(archetype, rng) {
      const plugins = [];
      
      if (archetype.platform !== 'Linux armv8l') {
        plugins.push({
          name: 'PDF Viewer',
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          mimeTypes: [{
            type: 'application/pdf',
            suffixes: 'pdf',
            description: 'Portable Document Format'
          }]
        });
        
        if (rng() > 0.5) {
          plugins.push({
            name: 'Chrome PDF Viewer',
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            mimeTypes: [{
              type: 'application/pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format'
            }]
          });
        }
      }
      
      return plugins;
    }
    
    function generateWebGLExtensions(vendor, rng) {
      const baseExtensions = [
        'EXT_blend_minmax',
        'EXT_color_buffer_half_float',
        'EXT_float_blend',
        'EXT_frag_depth',
        'EXT_texture_compression_bptc',
        'EXT_texture_filter_anisotropic',
        'WEBGL_compressed_texture_s3tc',
        'WEBGL_compressed_texture_s3tc_srgb',
        'WEBGL_debug_renderer_info',
        'WEBGL_depth_texture',
        'WEBGL_lose_context'
      ];
      
      if (vendor === 'NVIDIA') {
        baseExtensions.push('NV_shader_noperspective_interpolation');
      }
      
      // Randomize order
      return baseExtensions.sort(() => rng() - 0.5);
    }
    
    function selectFonts(archetype, rng) {
      const fontKey = archetype.os.name.toLowerCase();
      const allFonts = archetype.fonts[fontKey] || archetype.fonts.windows || [];
      
      const basicFonts = ['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana'];
      const selectedFonts = new Set(basicFonts);
      
      const additionalCount = Math.floor(rng() * 15) + 20;
      const availableFonts = allFonts.filter(f => !basicFonts.includes(f));
      
      for (let i = 0; i < additionalCount && availableFonts.length > 0; i++) {
        const index = Math.floor(rng() * availableFonts.length);
        selectedFonts.add(availableFonts.splice(index, 1)[0]);
      }
      
      return Array.from(selectedFonts).sort();
    }
    
    function getTimezoneOffset(timezone) {
      const offsets = {
        'America/New_York': 300,
        'America/Chicago': 360,
        'America/Los_Angeles': 480,
        'America/Toronto': 300,
        'America/Mexico_City': 360,
        'Europe/London': 0,
        'Europe/Paris': -60,
        'Europe/Berlin': -60,
        'Europe/Madrid': -60,
        'Europe/Rome': -60
      };
      
      return offsets[timezone] || 0;
    }
    
    return { generate };
  }
  
  // ===== META PROXY PROTECTION =====
  function setupMetaProxy() {
    console.log('[Chameleon] Setting up meta-proxy protection...');
    
    const originalToString = Function.prototype.toString;
    const originalObjectToString = Object.prototype.toString;
    
    // Override Function.prototype.toString
    Function.prototype.toString = new Proxy(originalToString, {
      apply(target, thisArg, args) {
        if (ChameleonState.interceptedFunctions.has(thisArg)) {
          const name = thisArg.name || '';
          return name ? `function ${name}() { [native code] }` : 'function () { [native code] }';
        }
        return Reflect.apply(target, thisArg, args);
      }
    });
    
    ChameleonState.interceptedFunctions.add(Function.prototype.toString);
    
    // Override Object.prototype.toString
    Object.prototype.toString = new Proxy(originalObjectToString, {
      apply(target, thisArg, args) {
        if (thisArg && thisArg.__chameleonFakeObject) {
          return thisArg.__chameleonToStringTag || '[object Object]';
        }
        return Reflect.apply(target, thisArg, args);
      }
    });
    
    ChameleonState.interceptedFunctions.add(Object.prototype.toString);
    
    // Clean stack traces
    if (Error.captureStackTrace) {
      const originalCaptureStackTrace = Error.captureStackTrace;
      Error.captureStackTrace = function(targetObject, constructorOpt) {
        originalCaptureStackTrace.call(this, targetObject, constructorOpt);
        if (targetObject.stack) {
          targetObject.stack = targetObject.stack
            .split('\n')
            .filter(line => !line.toLowerCase().includes('chameleon'))
            .join('\n');
        }
      };
    }
  }
  
  // ===== INTERCEPTORES =====
  
  // Define property helper
  function defineProperty(obj, prop, value) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
      Object.defineProperty(obj, prop, {
        get: function() {
          return applyJitter(() => value);
        },
        set: descriptor && descriptor.set || function() {},
        enumerable: descriptor ? descriptor.enumerable : true,
        configurable: true
      });
      
      const getter = Object.getOwnPropertyDescriptor(obj, prop).get;
      if (getter) {
        ChameleonState.interceptedFunctions.add(getter);
      }
    } catch (e) {
      console.error(`[Chameleon] Failed to define property ${prop}:`, e);
    }
  }
  
  // Navigator interceptor
  function interceptNavigator(profile) {
    console.log('[Chameleon] Intercepting navigator...');
    
    defineProperty(navigator, 'userAgent', profile.navigator.userAgent);
    defineProperty(navigator, 'platform', profile.navigator.platform);
    defineProperty(navigator, 'language', profile.navigator.language);
    defineProperty(navigator, 'languages', profile.navigator.languages);
    defineProperty(navigator, 'hardwareConcurrency', profile.navigator.hardwareConcurrency);
    defineProperty(navigator, 'deviceMemory', profile.navigator.deviceMemory);
    defineProperty(navigator, 'maxTouchPoints', profile.navigator.maxTouchPoints);
    defineProperty(navigator, 'vendor', profile.navigator.vendor);
    defineProperty(navigator, 'vendorSub', profile.navigator.vendorSub);
    defineProperty(navigator, 'productSub', profile.navigator.productSub);
    defineProperty(navigator, 'webdriver', profile.navigator.webdriver);
    defineProperty(navigator, 'pdfViewerEnabled', profile.navigator.pdfViewerEnabled);
    defineProperty(navigator, 'doNotTrack', profile.navigator.doNotTrack);
    
    // Plugins
    const fakePluginArray = createFakePluginArray(profile.navigator.plugins);
    defineProperty(navigator, 'plugins', fakePluginArray);
    
    // MimeTypes
    const fakeMimeTypeArray = createFakeMimeTypeArray(profile.navigator.plugins);
    defineProperty(navigator, 'mimeTypes', fakeMimeTypeArray);
  }
  
  // Screen interceptor
  function interceptScreen(profile) {
    console.log('[Chameleon] Intercepting screen...');
    
    defineProperty(screen, 'width', profile.screen.width);
    defineProperty(screen, 'height', profile.screen.height);
    defineProperty(screen, 'availWidth', profile.screen.availWidth);
    defineProperty(screen, 'availHeight', profile.screen.availHeight);
    defineProperty(screen, 'colorDepth', profile.screen.colorDepth);
    defineProperty(screen, 'pixelDepth', profile.screen.pixelDepth);
    
    if (screen.orientation) {
      defineProperty(screen.orientation, 'angle', profile.screen.orientation.angle);
      defineProperty(screen.orientation, 'type', profile.screen.orientation.type);
    }
    
    defineProperty(window, 'screenX', 0);
    defineProperty(window, 'screenY', 0);
    defineProperty(window, 'screenLeft', 0);
    defineProperty(window, 'screenTop', 0);
    defineProperty(window, 'devicePixelRatio', 1);
  }
  
  // Canvas interceptor
  function interceptCanvas(profile) {
    console.log('[Chameleon] Intercepting canvas...');
    
    const rng = SeededRandom(profile.seed + '_canvas');
    
    // toDataURL
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = new Proxy(originalToDataURL, {
      apply(target, thisArg, args) {
        const ctx = thisArg.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.globalAlpha = 0.01;
          ctx.fillStyle = `rgb(${Math.floor(rng() * 256)}, ${Math.floor(rng() * 256)}, ${Math.floor(rng() * 256)})`;
          ctx.fillRect(
            thisArg.width - 1 + profile.canvas.offsetX,
            thisArg.height - 1 + profile.canvas.offsetY,
            1, 1
          );
          ctx.restore();
        }
        return Reflect.apply(target, thisArg, args);
      }
    });
    
    ChameleonState.interceptedFunctions.add(HTMLCanvasElement.prototype.toDataURL);
    
    // toBlob
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = new Proxy(originalToBlob, {
      apply(target, thisArg, args) {
        const ctx = thisArg.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.globalAlpha = 0.01;
          ctx.fillStyle = `rgb(${Math.floor(rng() * 256)}, ${Math.floor(rng() * 256)}, ${Math.floor(rng() * 256)})`;
          ctx.fillRect(
            thisArg.width - 1 + profile.canvas.offsetX,
            thisArg.height - 1 + profile.canvas.offsetY,
            1, 1
          );
          ctx.restore();
        }
        return Reflect.apply(target, thisArg, args);
      }
    });
    
    ChameleonState.interceptedFunctions.add(HTMLCanvasElement.prototype.toBlob);
  }
  
  // WebGL interceptor
  function interceptWebGL(profile) {
    console.log('[Chameleon] Intercepting WebGL...');
    
    const contexts = [WebGLRenderingContext, WebGL2RenderingContext].filter(Boolean);
    
    contexts.forEach(ContextClass => {
      const originalGetParameter = ContextClass.prototype.getParameter;
      
      ContextClass.prototype.getParameter = new Proxy(originalGetParameter, {
        apply(target, thisArg, args) {
          const parameter = args[0];
          
          switch (parameter) {
            case 0x9245: // UNMASKED_VENDOR_WEBGL
              return profile.webgl.vendor;
            case 0x9246: // UNMASKED_RENDERER_WEBGL
              return profile.webgl.renderer;
            case 0x1F00: // VENDOR
              return 'WebKit';
            case 0x1F01: // RENDERER
              return 'WebKit WebGL';
            case 0x1F02: // VERSION
              return profile.webgl.version;
            case 0x8B8C: // SHADING_LANGUAGE_VERSION
              return profile.webgl.shadingLanguageVersion;
            default:
              return Reflect.apply(target, thisArg, args);
          }
        }
      });
      
      ChameleonState.interceptedFunctions.add(ContextClass.prototype.getParameter);
      
      // getSupportedExtensions
      const originalGetSupportedExtensions = ContextClass.prototype.getSupportedExtensions;
      
      ContextClass.prototype.getSupportedExtensions = new Proxy(originalGetSupportedExtensions, {
        apply() {
          return profile.webgl.extensions;
        }
      });
      
      ChameleonState.interceptedFunctions.add(ContextClass.prototype.getSupportedExtensions);
    });
  }
  
  // Audio interceptor
  function interceptAudio(profile) {
    console.log('[Chameleon] Intercepting audio...');
    
    const rng = SeededRandom(profile.seed + '_audio');
    
    if (window.AnalyserNode) {
      const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
      
      AnalyserNode.prototype.getFloatFrequencyData = new Proxy(originalGetFloatFrequencyData, {
        apply(target, thisArg, args) {
          Reflect.apply(target, thisArg, args);
          
          const array = args[0];
          if (array) {
            for (let i = 0; i < array.length; i++) {
              const freq = i / array.length;
              const noise = (rng() - 0.5) * profile.audio.noise * (1 - freq * 0.5);
              array[i] += noise;
            }
          }
        }
      });
      
      ChameleonState.interceptedFunctions.add(AnalyserNode.prototype.getFloatFrequencyData);
    }
  }
  
  // Timezone interceptor
  function interceptTimezone(profile) {
    console.log('[Chameleon] Intercepting timezone...');
    
    // Date.prototype.getTimezoneOffset
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = new Proxy(originalGetTimezoneOffset, {
      apply() {
        return profile.timezone.offset;
      }
    });
    
    ChameleonState.interceptedFunctions.add(Date.prototype.getTimezoneOffset);
    
    // Intl.DateTimeFormat
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    
    Intl.DateTimeFormat = new Proxy(OriginalDateTimeFormat, {
      construct(target, args) {
        const locale = args[0] || profile.timezone.locale;
        const options = args[1] || {};
        
        if (!options.timeZone) {
          options.timeZone = profile.timezone.name;
        }
        
        return new target(locale, options);
      }
    });
    
    // resolvedOptions
    const originalResolvedOptions = OriginalDateTimeFormat.prototype.resolvedOptions;
    
    OriginalDateTimeFormat.prototype.resolvedOptions = new Proxy(originalResolvedOptions, {
      apply(target, thisArg, args) {
        const result = Reflect.apply(target, thisArg, args);
        result.timeZone = profile.timezone.name;
        if (!result.locale || result.locale === 'en-US') {
          result.locale = profile.timezone.locale;
        }
        return result;
      }
    });
    
    ChameleonState.interceptedFunctions.add(OriginalDateTimeFormat.prototype.resolvedOptions);
  }
  
  // Battery interceptor  
  function interceptBattery(profile) {
    if (!navigator.getBattery) return;
    
    console.log('[Chameleon] Intercepting battery...');
    
    const originalGetBattery = navigator.getBattery;
    navigator.getBattery = new Proxy(originalGetBattery, {
      apply(target, thisArg, args) {
        return Reflect.apply(target, thisArg, args).then(battery => {
          return new Proxy(battery, {
            get(target, prop) {
              switch (prop) {
                case 'charging':
                  return profile.battery.charging;
                case 'chargingTime':
                  return profile.battery.chargingTime;
                case 'dischargingTime':
                  return profile.battery.dischargingTime;
                case 'level':
                  return profile.battery.level;
                default:
                  return target[prop];
              }
            }
          });
        });
      }
    });
    
    ChameleonState.interceptedFunctions.add(navigator.getBattery);
  }
  
  // Create fake plugin array
  function createFakePluginArray(pluginsData) {
    const plugins = pluginsData.map(p => createFakePlugin(p));
    
    const fakePluginArray = {
      length: plugins.length,
      item: function(index) {
        return plugins[index] || null;
      },
      namedItem: function(name) {
        return plugins.find(p => p.name === name) || null;
      },
      refresh: function() {},
      [Symbol.iterator]: function*() {
        for (let i = 0; i < plugins.length; i++) {
          yield plugins[i];
        }
      },
      __chameleonFakeObject: true,
      __chameleonToStringTag: '[object PluginArray]'
    };
    
    for (let i = 0; i < plugins.length; i++) {
      fakePluginArray[i] = plugins[i];
    }
    
    Object.setPrototypeOf(fakePluginArray, PluginArray.prototype);
    
    return fakePluginArray;
  }
  
  // Create fake plugin
  function createFakePlugin(pluginData) {
    const mimeTypes = pluginData.mimeTypes.map(m => createFakeMimeType(m, pluginData.name));
    
    const fakePlugin = {
      name: pluginData.name,
      description: pluginData.description,
      filename: pluginData.filename,
      length: mimeTypes.length,
      item: function(index) {
        return mimeTypes[index] || null;
      },
      namedItem: function(name) {
        return mimeTypes.find(m => m.type === name) || null;
      },
      [Symbol.iterator]: function*() {
        for (let i = 0; i < mimeTypes.length; i++) {
          yield mimeTypes[i];
        }
      },
      __chameleonFakeObject: true,
      __chameleonToStringTag: '[object Plugin]'
    };
    
    for (let i = 0; i < mimeTypes.length; i++) {
      fakePlugin[i] = mimeTypes[i];
    }
    
    Object.setPrototypeOf(fakePlugin, Plugin.prototype);
    
    return fakePlugin;
  }
  
  // Create fake MIME type array
  function createFakeMimeTypeArray(pluginsData) {
    const allMimeTypes = [];
    
    pluginsData.forEach(plugin => {
      plugin.mimeTypes.forEach(mimeType => {
        allMimeTypes.push(createFakeMimeType(mimeType, plugin.name));
      });
    });
    
    const fakeMimeTypeArray = {
      length: allMimeTypes.length,
      item: function(index) {
        return allMimeTypes[index] || null;
      },
      namedItem: function(name) {
        return allMimeTypes.find(m => m.type === name) || null;
      },
      [Symbol.iterator]: function*() {
        for (let i = 0; i < allMimeTypes.length; i++) {
          yield allMimeTypes[i];
        }
      },
      __chameleonFakeObject: true,
      __chameleonToStringTag: '[object MimeTypeArray]'
    };
    
    for (let i = 0; i < allMimeTypes.length; i++) {
      fakeMimeTypeArray[i] = allMimeTypes[i];
    }
    
    Object.setPrototypeOf(fakeMimeTypeArray, MimeTypeArray.prototype);
    
    return fakeMimeTypeArray;
  }
  
  // Create fake MIME type
  function createFakeMimeType(mimeTypeData, pluginName) {
    const fakeMimeType = {
      type: mimeTypeData.type,
      suffixes: mimeTypeData.suffixes,
      description: mimeTypeData.description,
      enabledPlugin: pluginName,
      __chameleonFakeObject: true,
      __chameleonToStringTag: '[object MimeType]'
    };
    
    Object.setPrototypeOf(fakeMimeType, MimeType.prototype);
    
    return fakeMimeType;
  }
  
  // Detect platform
  function detectPlatform() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('twitch.tv')) return 'twitch';
    if (hostname.includes('youtube.com')) return 'youtube';
    if (hostname.includes('facebook.com') || hostname.includes('meta.com')) return 'meta';
    if (hostname.includes('tiktok.com')) return 'tiktok';
    if (hostname.includes('fingerprint.com')) return 'fingerprint';
    
    return 'other';
  }
  
  // ===== INICIALIZACIÓN PRINCIPAL =====
  async function initialize() {
    try {
      console.log('[Chameleon] Getting session seed...');
      
      // Cargar datos de perfiles
      ChameleonState.profilesData = await loadProfilesData();
      if (!ChameleonState.profilesData) {
        throw new Error('Profiles data not loaded');
      }
      
      // Obtener semilla
      ChameleonState.seed = await getSessionSeed();
      console.log('[Chameleon] Session seed:', ChameleonState.seed.substring(0, 8) + '...');
      
      // Generar perfil
      const generator = ProfileGenerator(ChameleonState.profilesData, ChameleonState.seed);
      ChameleonState.profile = generator.generate();
      console.log('[Chameleon] Generated profile:', ChameleonState.profile.archetype);
      
      // Detectar plataforma
      ChameleonState.platform = detectPlatform();
      console.log('[Chameleon] Detected platform:', ChameleonState.platform);
      
      // Aplicar meta-proxy
      setupMetaProxy();
      
      // Aplicar interceptores
      interceptNavigator(ChameleonState.profile);
      interceptScreen(ChameleonState.profile);
      interceptCanvas(ChameleonState.profile);
      interceptWebGL(ChameleonState.profile);
      interceptAudio(ChameleonState.profile);
      interceptTimezone(ChameleonState.profile);
      interceptBattery(ChameleonState.profile);
      
      ChameleonState.initialized = true;
      console.log('[Chameleon] Initialization complete!');
      
      // Guardar perfil en storage para el popup
      const script = document.createElement('script');
      script.textContent = `
        (async function() {
          try {
            await chrome.storage.session.set({ 
              profile: ${JSON.stringify({
                seed: ChameleonState.profile.seed,
                summary: ChameleonState.profile.archetype,
                navigator: {
                  userAgent: ChameleonState.profile.navigator.userAgent,
                  language: ChameleonState.profile.navigator.language,
                  hardwareConcurrency: ChameleonState.profile.navigator.hardwareConcurrency,
                  deviceMemory: ChameleonState.profile.navigator.deviceMemory
                },
                screen: {
                  width: ChameleonState.profile.screen.width,
                  height: ChameleonState.profile.screen.height
                },
                timezone: ChameleonState.profile.timezone,
                webgl: {
                  vendor: ChameleonState.profile.webgl.vendor,
                  renderer: ChameleonState.profile.webgl.renderer
                }
              })}
            });
          } catch (e) {}
        })();
      `;
      
      document.documentElement.appendChild(script);
      script.remove();
      
    } catch (error) {
      console.error('[Chameleon] Initialization failed:', error);
    }
  }
  
  // Esperar a que seedrandom esté cargado
  function waitForDependencies() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      const check = () => {
        attempts++;
        
        if (window.Math.seedrandom) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(check, 100);
        } else {
          console.error('[Chameleon] Dependencies not loaded');
          resolve(); // Continue anyway
        }
      };
      
      check();
    });
  }
  
  // Iniciar cuando esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await waitForDependencies();
      initialize();
    });
  } else {
    waitForDependencies().then(initialize);
  }
  
})();