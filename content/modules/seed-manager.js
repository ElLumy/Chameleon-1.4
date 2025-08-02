// content/modules/seed-manager.js
export class SeedManager {
    constructor() {
        this.seed = null;
        this.sessionId = null;
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) return this.seed;
        
        try {
            // Intentar obtener la semilla del storage de sesión
            const stored = await this.getFromStorage();
            
            if (stored && stored.seed) {
                this.seed = stored.seed;
                this.sessionId = stored.sessionId;
            } else {
                // Generar nueva semilla
                this.seed = this.generateSeed();
                this.sessionId = this.generateSessionId();
                
                // Guardar en storage
                await this.saveToStorage();
            }
            
            this.initialized = true;
            console.log('[Chameleon SeedManager] Initialized with seed:', this.seed.substring(0, 8) + '...');
            
            return this.seed;
            
        } catch (error) {
            console.error('[Chameleon SeedManager] Initialization error:', error);
            // Fallback a semilla temporal
            this.seed = this.generateSeed();
            return this.seed;
        }
    }
    
    generateSeed() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    generateSessionId() {
        return 'chameleon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    async getFromStorage() {
        return new Promise((resolve) => {
            const channelId = 'chameleon_storage_' + Math.random().toString(36).substr(2, 9);
            
            window.addEventListener(channelId, (event) => {
                resolve(event.detail);
            }, { once: true });
            
            // Inyectar script para acceder a chrome.storage
            const script = document.createElement('script');
            script.textContent = `
                (async () => {
                    try {
                        const data = await chrome.storage.session.get(['sessionSeed', 'sessionId']);
                        window.dispatchEvent(new CustomEvent('${channelId}', { 
                            detail: { 
                                seed: data.sessionSeed, 
                                sessionId: data.sessionId 
                            } 
                        }));
                    } catch (e) {
                        window.dispatchEvent(new CustomEvent('${channelId}', { 
                            detail: null 
                        }));
                    }
                })();
            `;
            document.documentElement.appendChild(script);
            script.remove();
        });
    }
    
    async saveToStorage() {
        return new Promise((resolve) => {
            const channelId = 'chameleon_save_' + Math.random().toString(36).substr(2, 9);
            
            window.addEventListener(channelId, (event) => {
                resolve(event.detail.success);
            }, { once: true });
            
            const script = document.createElement('script');
            script.textContent = `
                (async () => {
                    try {
                        await chrome.storage.session.set({
                            sessionSeed: '${this.seed}',
                            sessionId: '${this.sessionId}',
                            timestamp: ${Date.now()}
                        });
                        window.dispatchEvent(new CustomEvent('${channelId}', { 
                            detail: { success: true } 
                        }));
                    } catch (e) {
                        window.dispatchEvent(new CustomEvent('${channelId}', { 
                            detail: { success: false } 
                        }));
                    }
                })();
            `;
            document.documentElement.appendChild(script);
            script.remove();
        });
    }
    
    // Obtener subsemilla para un componente específico
    getSubSeed(component) {
        return this.seed + '_' + component;
    }
}