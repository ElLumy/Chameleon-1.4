// content/modules/profile-generator.js
export class ProfileGenerator {
    constructor(profilesData) {
        this.data = profilesData;
        this.rng = null;
        this.profile = null;
    }
    
    generate(seed) {
        // Inicializar RNG determinista
        this.rng = new Math.seedrandom(seed);
        
        // Seleccionar arquetipo
        const archetype = this.selectWeighted(this.data.deviceArchetypes);
        
        // Generar perfil completo
        this.profile = this.buildProfile(archetype, seed);
        
        return this.profile;
    }
    
    buildProfile(archetype, seed) {
        // Características de hardware
        const cpu = this.selectCPU(archetype);
        const memory = this.selectFromArray(archetype.hardware.memory);
        const gpu = this.selectGPU(archetype);
        const resolution = this.selectWeighted(archetype.display.resolutions);
        
        // Localización
        const geoData = this.selectGeolocation();
        const language = this.selectLanguage(archetype, geoData);
        
        // Versiones
        const chromeVersion = this.selectWeighted(this.data.chromeVersions);
        
        // User Agent
        const userAgent = this.buildUserAgent(archetype, chromeVersion);
        
        // Fuentes
        const fonts = this.selectFonts(archetype);
        
        // Plugins
        const plugins = this.generatePlugins(archetype);
        
        // Construir perfil completo
        return {
            seed,
            archetype: archetype.id,
            summary: this.generateSummary(archetype, resolution, geoData),
            
            navigator: {
                userAgent,
                platform: archetype.platform,
                language,
                languages: this.generateLanguagesList(language),
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
                plugins,
                mimeTypes: this.generateMimeTypes(plugins),
                doNotTrack: null,
                credentials: {},
                keyboard: {},
                mediaDevices: this.generateMediaDevices(archetype)
            },
            
            screen: {
                width: resolution.width,
                height: resolution.height,
                availWidth: resolution.width,
                availHeight: resolution.height - this.getTaskbarHeight(archetype.os.name),
                colorDepth: archetype.display.colorDepth,
                pixelDepth: archetype.display.pixelDepth,
                orientation: {
                    angle: 0,
                    type: resolution.width > resolution.height ? 'landscape-primary' : 'portrait-primary'
                }
            },
            
            webgl: {
                vendor: gpu.vendor,
                renderer: gpu.renderer,
                version: 'WebGL 2.0',
                shadingLanguageVersion: 'WebGL GLSL ES 3.00',
                extensions: this.generateWebGLExtensions(gpu.vendor),
                parameters: this.generateWebGLParameters(gpu)
            },
            
            canvas: {
                noise: this.rng() * 0.0001 + 0.00005,
                offsetX: Math.floor(this.rng() * 3) - 1,
                offsetY: Math.floor(this.rng() * 3) - 1,
                multiplier: 0.999 + this.rng() * 0.002
            },
            
            audio: {
                sampleRate: 48000,
                channelCount: 2,
                maxChannelCount: 2,
                numberOfInputs: 1,
                numberOfOutputs: 1,
                channelCountMode: 'explicit',
                channelInterpretation: 'speakers',
                fftSize: 2048,
                frequencyBinCount: 1024,
                minDecibels: -100,
                maxDecibels: -30,
                smoothingTimeConstant: 0.8,
                noise: this.rng() * 0.00002 + 0.00001
            },
            
            timezone: {
                name: geoData.timezone,
                offset: this.getTimezoneOffset(geoData.timezone),
                locale: language,
                country: geoData.country
            },
            
            fonts: {
                available: fonts,
                js: this.selectJSFonts(fonts)
            },
            
            battery: {
                charging: this.rng() > 0.3,
                level: Math.round((0.2 + this.rng() * 0.8) * 100) / 100,
                chargingTime: this.rng() > 0.3 ? Math.floor(this.rng() * 3600) : Infinity,
                dischargingTime: Math.floor(this.rng() * 10800 + 3600)
            },
            
            network: this.generateNetworkInfo(),
            
            sensors: this.generateSensorInfo(archetype),
            
            media: this.generateMediaCapabilities(archetype),
            
            clientRects: this.generateClientRectsNoise(),
            
            performance: this.generatePerformanceProfile()
        };
    }
    
    selectWeighted(items) {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let random = this.rng() * totalWeight;
        
        for (const item of items) {
            random -= item.weight;
            if (random <= 0) return item;
        }
        
        return items[items.length - 1];
    }
    
    selectFromArray(array) {
        return array[Math.floor(this.rng() * array.length)];
    }
    
    selectCPU(archetype) {
        const cores = archetype.hardware.cpu.cores;
        const weights = archetype.hardware.cpu.weights;
        
        const items = cores.map((c, i) => ({ value: c, weight: weights[i] }));
        return this.selectWeighted(items).value;
    }
    
    selectGPU(archetype) {
        const gpu = this.selectFromArray(archetype.hardware.gpuVendors);
        const model = this.selectFromArray(gpu.models);
        
        return {
            vendor: gpu.vendor,
            model: model,
            renderer: gpu.renderer.replace('{model}', model)
        };
    }
    
    selectGeolocation() {
        // Seleccionar región
        const regions = Object.entries(this.data.timezoneRegions).map(([name, zones]) => ({
            name,
            zones,
            weight: zones.reduce((sum, z) => sum + z.weight, 0)
        }));
        
        const region = this.selectWeighted(regions);
        
        // Seleccionar timezone específica
        const timezoneData = this.selectWeighted(region.zones);
        
        return {
            region: region.name,
            timezone: timezoneData.timezone,
            languages: timezoneData.languages,
            country: this.getCountryFromTimezone(timezoneData.timezone)
        };
    }
    
    selectLanguage(archetype, geoData) {
        // Preferir idiomas de la geolocalización
        if (geoData.languages && geoData.languages.length > 0) {
            return this.selectFromArray(geoData.languages);
        }
        
        // Fallback a idiomas del arquetipo
        const items = archetype.languages.primary.map((l, i) => ({
            value: l,
            weight: archetype.languages.weights[i]
        }));
        
        return this.selectWeighted(items).value;
    }
    
    buildUserAgent(archetype, chromeVersion) {
        let ua = archetype.userAgentTemplate.replace('{chromeVersion}', chromeVersion.version);
        
        if (archetype.platform === 'Linux armv8l') {
            const deviceModel = this.selectFromArray(this.data.androidDeviceModels);
            ua = ua
                .replace('{androidVersion}', archetype.os.version)
                .replace('{deviceModel}', deviceModel);
        }
        
        return ua;
    }
    
    selectFonts(archetype) {
        const fontKey = archetype.os.name.toLowerCase();
        const allFonts = archetype.fonts[fontKey] || archetype.fonts.windows || [];
        
        // Siempre incluir fuentes básicas
        const basicFonts = [
            'Arial', 'Courier New', 'Georgia', 'Times New Roman', 
            'Trebuchet MS', 'Verdana'
        ];
        
        // Seleccionar fuentes adicionales
        const additionalCount = Math.floor(this.rng() * 20) + 25;
        const selectedFonts = new Set(basicFonts);
        
        const availableFonts = allFonts.filter(f => !basicFonts.includes(f));
        
        for (let i = 0; i < additionalCount && availableFonts.length > 0; i++) {
            const index = Math.floor(this.rng() * availableFonts.length);
            selectedFonts.add(availableFonts.splice(index, 1)[0]);
        }
        
        return Array.from(selectedFonts).sort();
    }
    
    selectJSFonts(allFonts) {
        // JavaScript detecta menos fuentes que Flash
        const jsDetectable = allFonts.filter(font => {
            // Filtrar fuentes que JS típicamente no puede detectar
            const nonDetectable = ['Symbol', 'Webdings', 'Wingdings', 'Marlett'];
            return !nonDetectable.includes(font);
        });
        
        // Reducir el conjunto en un 20-30%
        const reductionFactor = 0.7 + this.rng() * 0.1;
        const count = Math.floor(jsDetectable.length * reductionFactor);
        
        const selected = [];
        const fontsCopy = [...jsDetectable];
        
        for (let i = 0; i < count && fontsCopy.length > 0; i++) {
            const index = Math.floor(this.rng() * fontsCopy.length);
            selected.push(fontsCopy.splice(index, 1)[0]);
        }
        
        return selected.sort();
    }
    
    generatePlugins(archetype) {
        const plugins = [];
        
        if (archetype.platform !== 'Linux armv8l') { // No plugins en móvil
            // PDF plugins (siempre presentes en Chrome moderno)
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
            
            // Native Client (50% de probabilidad)
            if (this.rng() > 0.5) {
                plugins.push({
                    name: 'Native Client',
                    description: 'Native Client Executable',
                    filename: 'internal-nacl-plugin',
                    mimeTypes: [{
                        type: 'application/x-nacl',
                        suffixes: '',
                        description: 'Native Client Executable'
                    }, {
                        type: 'application/x-pnacl',
                        suffixes: '',
                        description: 'Portable Native Client Executable'
                    }]
                });
            }
        }
        
        return plugins;
    }
    
    generateMimeTypes(plugins) {
        const mimeTypes = [];
        
        plugins.forEach(plugin => {
            plugin.mimeTypes.forEach(mimeType => {
                mimeTypes.push({
                    ...mimeType,
                    enabledPlugin: plugin.name
                });
            });
        });
        
        return mimeTypes;
    }
    
    generateLanguagesList(primary) {
        const languages = [primary];
        const baseLang = primary.split('-')[0];
        
        // Agregar idioma base si es diferente
        if (primary !== baseLang) {
            languages.push(baseLang);
        }
        
        // Agregar inglés si no está presente
        if (!languages.some(l => l.startsWith('en'))) {
            if (this.rng() > 0.3) languages.push('en-US');
            if (this.rng() > 0.5) languages.push('en');
        }
        
        return languages;
    }
    
    generateWebGLExtensions(vendor) {
        const allExtensions = [
            'ANGLE_instanced_arrays',
            'EXT_blend_minmax',
            'EXT_clip_control',
            'EXT_color_buffer_float',
            'EXT_color_buffer_half_float',
            'EXT_depth_clamp',
            'EXT_disjoint_timer_query',
            'EXT_disjoint_timer_query_webgl2',
            'EXT_float_blend',
            'EXT_frag_depth',
            'EXT_polygon_offset_clamp',
            'EXT_shader_texture_lod',
            'EXT_texture_compression_bptc',
            'EXT_texture_compression_rgtc',
            'EXT_texture_filter_anisotropic',
            'EXT_texture_mirror_clamp_to_edge',
            'EXT_sRGB',
            'KHR_parallel_shader_compile',
            'OES_draw_buffers_indexed',
            'OES_element_index_uint',
            'OES_fbo_render_mipmap',
            'OES_standard_derivatives',
            'OES_texture_float',
            'OES_texture_float_linear',
            'OES_texture_half_float',
            'OES_texture_half_float_linear',
            'OES_vertex_array_object',
            'OVR_multiview2',
            'WEBGL_color_buffer_float',
            'WEBGL_compressed_texture_astc',
            'WEBGL_compressed_texture_etc',
            'WEBGL_compressed_texture_etc1',
            'WEBGL_compressed_texture_pvrtc',
            'WEBGL_compressed_texture_s3tc',
            'WEBGL_compressed_texture_s3tc_srgb',
            'WEBGL_debug_renderer_info',
            'WEBGL_debug_shaders',
            'WEBGL_depth_texture',
            'WEBGL_draw_buffers',
            'WEBGL_lose_context',
            'WEBGL_multi_draw',
            'WEBGL_polygon_mode'
        ];
        
        // Filtrar extensiones basadas en el vendor
        let extensions = [...allExtensions];
        
        if (vendor === 'NVIDIA') {
            extensions.push('NV_shader_noperspective_interpolation');
        } else if (vendor === 'Intel') {
            // Intel generalmente soporta menos extensiones
            extensions = extensions.filter(ext => !ext.includes('compressed_texture_pvrtc'));
        } else if (vendor === 'Apple') {
            extensions = extensions.filter(ext => !ext.includes('WEBGL_compressed_texture_s3tc'));
            extensions.push('WEBGL_compressed_texture_pvrtc');
        }
        
        // Eliminar aleatoriamente algunas extensiones para variedad
        const removeCount = Math.floor(this.rng() * 5);
        for (let i = 0; i < removeCount; i++) {
            const index = Math.floor(this.rng() * extensions.length);
            extensions.splice(index, 1);
        }
        
        // Mezclar orden
        return extensions.sort(() => this.rng() - 0.5);
    }
    
    generateWebGLParameters(gpu) {
        const params = {
            MAX_COMBINED_TEXTURE_IMAGE_UNITS: 32,
            MAX_CUBE_MAP_TEXTURE_SIZE: 16384,
            MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
            MAX_RENDERBUFFER_SIZE: 16384,
            MAX_TEXTURE_IMAGE_UNITS: 16,
            MAX_TEXTURE_SIZE: 16384,
            MAX_VARYING_VECTORS: 30,
            MAX_VERTEX_ATTRIBS: 16,
            MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
            MAX_VERTEX_UNIFORM_VECTORS: 4096,
            MAX_VIEWPORT_DIMS: [32767, 32767],
            ALIASED_LINE_WIDTH_RANGE: [1, 1],
            ALIASED_POINT_SIZE_RANGE: [1, 1024],
            MAX_3D_TEXTURE_SIZE: 2048,
            MAX_ARRAY_TEXTURE_LAYERS: 2048,
            MAX_COLOR_ATTACHMENTS: 8,
            MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS: 64000,
            MAX_COMBINED_UNIFORM_BLOCKS: 24,
            MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS: 64000,
            MAX_DRAW_BUFFERS: 8,
            MAX_ELEMENT_INDEX: 4294967295,
            MAX_ELEMENTS_INDICES: 150000,
            MAX_ELEMENTS_VERTICES: 100000,
            MAX_FRAGMENT_INPUT_COMPONENTS: 120,
            MAX_FRAGMENT_UNIFORM_BLOCKS: 12,
            MAX_FRAGMENT_UNIFORM_COMPONENTS: 4096,
            MAX_PROGRAM_TEXEL_OFFSET: 7,
            MAX_SAMPLES: 4,
            MAX_SERVER_WAIT_TIMEOUT: 0,
            MAX_TEXTURE_LOD_BIAS: 2,
            MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS: 120,
            MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS: 4,
            MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS: 4,
            MAX_UNIFORM_BLOCK_SIZE: 65536,
            MAX_UNIFORM_BUFFER_BINDINGS: 24,
            MAX_VARYING_COMPONENTS: 120,
            MAX_VERTEX_OUTPUT_COMPONENTS: 120,
            MAX_VERTEX_UNIFORM_BLOCKS: 12,
            MAX_VERTEX_UNIFORM_COMPONENTS: 4096,
            MIN_PROGRAM_TEXEL_OFFSET: -8,
            UNIFORM_BUFFER_OFFSET_ALIGNMENT: 256
        };
        
        // Ajustar valores basados en el GPU
        if (gpu.vendor === 'Intel') {
            params.MAX_SAMPLES = 4;
            params.MAX_TEXTURE_SIZE = 8192;
            params.MAX_CUBE_MAP_TEXTURE_SIZE = 8192;
        } else if (gpu.vendor === 'NVIDIA') {
            params.MAX_SAMPLES = 8;
            params.MAX_TEXTURE_SIZE = 32768;
            params.MAX_CUBE_MAP_TEXTURE_SIZE = 32768;
        }
        
        return params;
    }
    
    generateMediaDevices(archetype) {
        const devices = [];
        
        // Siempre hay al menos un dispositivo de audio
        devices.push({
            deviceId: this.generateDeviceId(),
            kind: 'audioinput',
            label: '',
            groupId: this.generateGroupId()
        });
        
        devices.push({
            deviceId: this.generateDeviceId(),
            kind: 'audiooutput',
            label: '',
            groupId: this.generateGroupId()
        });
        
        // Video devices dependen del tipo de dispositivo
        if (archetype.platform !== 'Linux armv8l' || this.rng() > 0.3) {
            devices.push({
                deviceId: this.generateDeviceId(),
                kind: 'videoinput',
                label: '',
                groupId: this.generateGroupId()
            });
        }
        
        return devices;
    }
    
    generateDeviceId() {
        const chars = '0123456789abcdef';
        let id = '';
        for (let i = 0; i < 64; i++) {
            id += chars[Math.floor(this.rng() * chars.length)];
        }
        return id;
    }
    
    generateGroupId() {
        const chars = '0123456789abcdef';
        let id = '';
        for (let i = 0; i < 64; i++) {
            id += chars[Math.floor(this.rng() * chars.length)];
        }
        return id;
    }
    
    generateNetworkInfo() {
        const types = ['wifi', 'ethernet', 'cellular', 'bluetooth'];
        const type = this.selectFromArray(types);
        
        return {
            type,
            effectiveType: '4g',
            downlink: 10 + this.rng() * 40,
            downlinkMax: Infinity,
            rtt: 50 + Math.floor(this.rng() * 100),
            saveData: false
        };
    }
    
    generateSensorInfo(archetype) {
        const sensors = {
            accelerometer: archetype.platform === 'Linux armv8l' || this.rng() > 0.7,
            gyroscope: archetype.platform === 'Linux armv8l' || this.rng() > 0.7,
            magnetometer: archetype.platform === 'Linux armv8l' || this.rng() > 0.8,
            linearAccelerationSensor: archetype.platform === 'Linux armv8l' || this.rng() > 0.8,
            ambientLightSensor: this.rng() > 0.9,
            proximitySensor: archetype.platform === 'Linux armv8l' || this.rng() > 0.9
        };
        
        return sensors;
    }
    
    generateMediaCapabilities(archetype) {
        const codecs = {
            video: [
                'video/mp4; codecs="avc1.42E01E"',
                'video/mp4; codecs="avc1.4D401E"',
                'video/mp4; codecs="avc1.64001E"',
                'video/webm; codecs="vp8"',
                'video/webm; codecs="vp9"'
            ],
            audio: [
                'audio/mp4; codecs="mp4a.40.2"',
                'audio/webm; codecs="opus"',
                'audio/webm; codecs="vorbis"',
                'audio/ogg; codecs="opus"',
                'audio/ogg; codecs="vorbis"'
            ]
        };
        
        // Agregar codecs avanzados basados en el dispositivo
        if (archetype.hardware.gpuVendors[0].vendor !== 'Intel') {
            codecs.video.push('video/mp4; codecs="hev1.1.6.L93.90"'); // HEVC
            codecs.video.push('video/webm; codecs="av01.0.01M.08"'); // AV1
        }
        
        return codecs;
    }
    
    generateClientRectsNoise() {
        return {
            x: this.rng() * 0.01 - 0.005,
            y: this.rng() * 0.01 - 0.005,
            width: this.rng() * 0.01 - 0.005,
            height: this.rng() * 0.01 - 0.005
        };
    }
    
    generatePerformanceProfile() {
        return {
            navigationStart: Date.now() - Math.floor(this.rng() * 5000),
            redirectTime: Math.floor(this.rng() * 50),
            dnsTime: 20 + Math.floor(this.rng() * 30),
            connectTime: 30 + Math.floor(this.rng() * 50),
            requestTime: 10 + Math.floor(this.rng() * 20),
            responseTime: 20 + Math.floor(this.rng() * 40),
            domLoadingTime: 50 + Math.floor(this.rng() * 100),
            domCompleteTime: 200 + Math.floor(this.rng() * 300),
            loadEventTime: 300 + Math.floor(this.rng() * 200)
        };
    }
    
    getTaskbarHeight(os) {
        const heights = {
            'Windows': 40,
            'macOS': 25,
            'Linux': 28,
            'Android': 0,
            'iOS': 0
        };
        
        return heights[os] || 30;
    }
    
    getTimezoneOffset(timezone) {
        try {
            const date = new Date();
            const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
            const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
            return (utcDate - tzDate) / 60000;
        } catch (e) {
            return 0;
        }
    }
    
    getCountryFromTimezone(timezone) {
        const countryMap = {
            'America/New_York': 'United States',
            'America/Chicago': 'United States',
            'America/Los_Angeles': 'United States',
            'America/Denver': 'United States',
            'America/Phoenix': 'United States',
            'America/Toronto': 'Canada',
            'America/Mexico_City': 'Mexico',
            'America/Sao_Paulo': 'Brazil',
            'America/Buenos_Aires': 'Argentina',
            'Europe/London': 'United Kingdom',
            'Europe/Paris': 'France',
            'Europe/Berlin': 'Germany',
            'Europe/Madrid': 'Spain',
            'Europe/Rome': 'Italy',
            'Europe/Amsterdam': 'Netherlands',
            'Europe/Warsaw': 'Poland',
            'Europe/Stockholm': 'Sweden',
            'Europe/Moscow': 'Russia',
            'Europe/Istanbul': 'Turkey',
            'Europe/Athens': 'Greece',
            'Asia/Tokyo': 'Japan',
            'Asia/Shanghai': 'China',
            'Asia/Hong_Kong': 'Hong Kong',
            'Asia/Singapore': 'Singapore',
            'Asia/Seoul': 'South Korea',
            'Asia/Kolkata': 'India',
            'Asia/Dubai': 'United Arab Emirates',
            'Asia/Bangkok': 'Thailand',
            'Asia/Jakarta': 'Indonesia',
            'Australia/Sydney': 'Australia',
            'Australia/Melbourne': 'Australia',
            'Australia/Brisbane': 'Australia',
            'Australia/Perth': 'Australia',
            'Pacific/Auckland': 'New Zealand'
        };
        
        return countryMap[timezone] || 'Unknown';
    }
    
    generateSummary(archetype, resolution, geoData) {
        const location = geoData.timezone.split('/')[1]?.replace(/_/g, ' ') || geoData.timezone;
        return `${archetype.name} - ${resolution.width}x${resolution.height} - ${location}`;
    }
}