// content/modules/interceptors/screen.js
(function() {
    'use strict';
    
    class ScreenInterceptor {
        constructor(profile, chameleonState) {
            this.profile = profile.screen;
            this.chameleonState = chameleonState;
        }
        
        apply() {
            console.log('[Chameleon] Applying screen interceptor...');
            
            // Screen dimensions
            this.defineProperty(screen, 'width', this.profile.width);
            this.defineProperty(screen, 'height', this.profile.height);
            this.defineProperty(screen, 'availWidth', this.profile.availWidth);
            this.defineProperty(screen, 'availHeight', this.profile.availHeight);
            
            // Color depth
            this.defineProperty(screen, 'colorDepth', this.profile.colorDepth);
            this.defineProperty(screen, 'pixelDepth', this.profile.pixelDepth);
            
            // Screen orientation
            this.interceptOrientation();
            
            // Window properties
            this.interceptWindowProperties();
            
            // Visual viewport
            this.interceptVisualViewport();
            
            // Media queries
            this.interceptMediaQueries();
            
            // Device pixel ratio
            this.defineProperty(window, 'devicePixelRatio', 1);
            
            console.log('[Chameleon] Screen interceptor applied');
        }
        
        defineProperty(obj, prop, value) {
            const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
            
            Object.defineProperty(obj, prop, {
                get: function() {
                    return value;
                },
                set: descriptor && descriptor.set || function() {},
                enumerable: descriptor ? descriptor.enumerable : true,
                configurable: true
            });
            
            // Register getter as intercepted
            const getter = Object.getOwnPropertyDescriptor(obj, prop).get;
            if (getter && window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(getter);
            }
        }
        
        interceptOrientation() {
            if (!screen.orientation) return;
            
            this.defineProperty(screen.orientation, 'angle', this.profile.orientation.angle);
            this.defineProperty(screen.orientation, 'type', this.profile.orientation.type);
            
            // Lock and unlock methods
            const originalLock = screen.orientation.lock;
            const originalUnlock = screen.orientation.unlock;
            
            if (originalLock) {
                screen.orientation.lock = new Proxy(originalLock, {
                    apply: async (target, thisArg, args) => {
                        // Simulate successful lock
                        return Promise.resolve();
                    }
                });
                
                if (window.chameleonRegisterIntercepted) {
                    window.chameleonRegisterIntercepted(screen.orientation.lock);
                }
            }
            
            if (originalUnlock) {
                screen.orientation.unlock = new Proxy(originalUnlock, {
                    apply: (target, thisArg, args) => {
                        // Simulate successful unlock
                        return undefined;
                    }
                });
                
                if (window.chameleonRegisterIntercepted) {
                    window.chameleonRegisterIntercepted(screen.orientation.unlock);
                }
            }
        }
        
        interceptWindowProperties() {
            // Screen position
            this.defineProperty(window, 'screenX', 0);
            this.defineProperty(window, 'screenY', 0);
            this.defineProperty(window, 'screenLeft', 0);
            this.defineProperty(window, 'screenTop', 0);
            
            // Outer dimensions
            this.defineProperty(window, 'outerWidth', this.profile.width);
            this.defineProperty(window, 'outerHeight', this.profile.height);
            
            // Inner dimensions (with some variance)
            const innerWidth = this.profile.width - Math.floor(Math.random() * 20);
            const innerHeight = this.profile.availHeight - Math.floor(Math.random() * 100);
            
            this.defineProperty(window, 'innerWidth', innerWidth);
            this.defineProperty(window, 'innerHeight', innerHeight);
        }
        
        interceptVisualViewport() {
            if (!window.visualViewport) return;
            
            const viewport = window.visualViewport;
            
            // Use inner dimensions
            this.defineProperty(viewport, 'width', window.innerWidth);
            this.defineProperty(viewport, 'height', window.innerHeight);
            
            // Position (typically 0 unless zoomed/scrolled)
            this.defineProperty(viewport, 'offsetLeft', 0);
            this.defineProperty(viewport, 'offsetTop', 0);
            this.defineProperty(viewport, 'pageLeft', window.pageXOffset || 0);
            this.defineProperty(viewport, 'pageTop', window.pageYOffset || 0);
            
            // Scale
            this.defineProperty(viewport, 'scale', 1);
        }
        
        interceptMediaQueries() {
            const originalMatchMedia = window.matchMedia;
            
            window.matchMedia = new Proxy(originalMatchMedia, {
                apply: (target, thisArg, args) => {
                    const query = args[0];
                    
                    // Parse and potentially modify the query based on our spoofed values
                    let modifiedQuery = query;
                    
                    // Replace screen dimensions in the query
                    modifiedQuery = modifiedQuery.replace(/\bscreen\s+and\s+\(max-width:\s*\d+px\)/gi, (match) => {
                        const maxWidth = parseInt(match.match(/\d+/)[0]);
                        if (maxWidth < this.profile.width) {
                            return `screen and (max-width: ${this.profile.width}px)`;
                        }
                        return match;
                    });
                    
                    modifiedQuery = modifiedQuery.replace(/\bscreen\s+and\s+\(min-width:\s*\d+px\)/gi, (match) => {
                        const minWidth = parseInt(match.match(/\d+/)[0]);
                        if (minWidth > this.profile.width) {
                            return `screen and (min-width: 0px)`;
                        }
                        return match;
                    });
                    
                    // Call original with potentially modified query
                    const result = Reflect.apply(target, thisArg, [modifiedQuery]);
                    
                    // Override matches property if needed
                    const descriptor = Object.getOwnPropertyDescriptor(result, 'matches');
                    if (descriptor && descriptor.configurable) {
                        // Check if query should match based on our spoofed values
                        let shouldMatch = this.evaluateMediaQuery(query);
                        
                        Object.defineProperty(result, 'matches', {
                            get: () => shouldMatch,
                            configurable: true,
                            enumerable: true
                        });
                    }
                    
                    return result;
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(window.matchMedia);
            }
        }
        
        evaluateMediaQuery(query) {
            // Simple evaluation of common media queries
            if (query.includes('prefers-color-scheme: dark')) {
                return false; // Default to light mode
            }
            
            if (query.includes('prefers-reduced-motion')) {
                return false; // No reduced motion
            }
            
            if (query.includes('orientation: portrait')) {
                return this.profile.height > this.profile.width;
            }
            
            if (query.includes('orientation: landscape')) {
                return this.profile.width > this.profile.height;
            }
            
            // Width queries
            const maxWidthMatch = query.match(/max-width:\s*(\d+)px/);
            if (maxWidthMatch) {
                return this.profile.width <= parseInt(maxWidthMatch[1]);
            }
            
            const minWidthMatch = query.match(/min-width:\s*(\d+)px/);
            if (minWidthMatch) {
                return this.profile.width >= parseInt(minWidthMatch[1]);
            }
            
            // Default to true for unhandled queries
            return true;
        }
    }
    
    // Expose to global scope
    window.ScreenInterceptor = ScreenInterceptor;
})();