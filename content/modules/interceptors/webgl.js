// content/modules/interceptors/webgl.js
(function() {
    'use strict';
    
    class WebGLInterceptor {
        constructor(profile, chameleonState) {
            this.profile = profile.webgl;
            this.chameleonState = chameleonState;
            this.parameters = profile.parameters || {};
        }
        
        apply() {
            console.log('[Chameleon] Applying WebGL interceptor...');
            
            // Intercept both WebGL and WebGL2
            this.interceptWebGLContext(WebGLRenderingContext);
            this.interceptWebGLContext(WebGL2RenderingContext);
            
            console.log('[Chameleon] WebGL interceptor applied');
        }
        
        interceptWebGLContext(ContextClass) {
            if (!ContextClass) return;
            
            // Intercept getParameter
            this.interceptGetParameter(ContextClass);
            
            // Intercept getSupportedExtensions
            this.interceptGetSupportedExtensions(ContextClass);
            
            // Intercept getExtension
            this.interceptGetExtension(ContextClass);
            
            // Intercept getShaderPrecisionFormat
            this.interceptGetShaderPrecisionFormat(ContextClass);
            
            // Intercept getContextAttributes
            this.interceptGetContextAttributes(ContextClass);
        }
        
        interceptGetParameter(ContextClass) {
            const originalGetParameter = ContextClass.prototype.getParameter;
            
            ContextClass.prototype.getParameter = new Proxy(originalGetParameter, {
                apply: (target, thisArg, args) => {
                    const parameter = args[0];
                    
                    // WebGL constants
                    const GL_VENDOR = 0x1F00;
                    const GL_RENDERER = 0x1F01;
                    const GL_VERSION = 0x1F02;
                    const GL_SHADING_LANGUAGE_VERSION = 0x8B8C;
                    const UNMASKED_VENDOR_WEBGL = 0x9245;
                    const UNMASKED_RENDERER_WEBGL = 0x9246;
                    
                    switch (parameter) {
                        case UNMASKED_VENDOR_WEBGL:
                            return this.profile.vendor;
                            
                        case UNMASKED_RENDERER_WEBGL:
                            return this.profile.renderer;
                            
                        case GL_VENDOR:
                            return 'WebKit';
                            
                        case GL_RENDERER:
                            return 'WebKit WebGL';
                            
                        case GL_VERSION:
                            return this.profile.version;
                            
                        case GL_SHADING_LANGUAGE_VERSION:
                            return this.profile.shadingLanguageVersion;
                            
                        default:
                            // Check if we have a custom value for this parameter
                            if (parameter in this.parameters) {
                                return this.parameters[parameter];
                            }
                            
                            // Return original value
                            return Reflect.apply(target, thisArg, args);
                    }
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(ContextClass.prototype.getParameter);
            }
        }
        
        interceptGetSupportedExtensions(ContextClass) {
            const originalGetSupportedExtensions = ContextClass.prototype.getSupportedExtensions;
            
            ContextClass.prototype.getSupportedExtensions = new Proxy(originalGetSupportedExtensions, {
                apply: (target, thisArg, args) => {
                    return this.profile.extensions;
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(ContextClass.prototype.getSupportedExtensions);
            }
        }
        
        interceptGetExtension(ContextClass) {
            const originalGetExtension = ContextClass.prototype.getExtension;
            
            ContextClass.prototype.getExtension = new Proxy(originalGetExtension, {
                apply: (target, thisArg, args) => {
                    const name = args[0];
                    
                    // Only return extension if it's in our supported list
                    if (this.profile.extensions.includes(name)) {
                        return Reflect.apply(target, thisArg, args);
                    }
                    
                    return null;
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(ContextClass.prototype.getExtension);
            }
        }
        
        interceptGetShaderPrecisionFormat(ContextClass) {
            const originalGetShaderPrecisionFormat = ContextClass.prototype.getShaderPrecisionFormat;
            
            ContextClass.prototype.getShaderPrecisionFormat = new Proxy(originalGetShaderPrecisionFormat, {
                apply: (target, thisArg, args) => {
                    const result = Reflect.apply(target, thisArg, args);
                    
                    // Add slight variance to precision values
                    if (result && result.precision) {
                        const variance = Math.floor(Math.random() * 2);
                        result.precision = Math.max(0, result.precision + variance);
                    }
                    
                    return result;
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(ContextClass.prototype.getShaderPrecisionFormat);
            }
        }
        
        interceptGetContextAttributes(ContextClass) {
            const originalGetContextAttributes = ContextClass.prototype.getContextAttributes;
            
            ContextClass.prototype.getContextAttributes = new Proxy(originalGetContextAttributes, {
                apply: (target, thisArg, args) => {
                    const result = Reflect.apply(target, thisArg, args);
                    
                    // Ensure consistent attributes
                    if (result) {
                        result.antialias = true;
                        result.depth = true;
                        result.stencil = false;
                        result.premultipliedAlpha = true;
                        result.preserveDrawingBuffer = false;
                        result.powerPreference = 'default';
                        result.failIfMajorPerformanceCaveat = false;
                        result.desynchronized = false;
                    }
                    
                    return result;
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(ContextClass.prototype.getContextAttributes);
            }
        }
    }
    
    // Expose to global scope
    window.WebGLInterceptor = WebGLInterceptor;
})();