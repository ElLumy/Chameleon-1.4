// content/modules/interceptors/meta-proxy.js
(function() {
    'use strict';
    
    class MetaProxyInterceptor {
        constructor() {
            this.interceptedFunctions = new WeakSet();
            this.originalToString = Function.prototype.toString;
            this.originalObjectToString = Object.prototype.toString;
            this.originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
            this.originalError = Error;
        }
        
        apply() {
            console.log('[Chameleon] Applying meta-proxy protection...');
            
            // Setup registration function
            this.setupRegistration();
            
            // Intercept Function.prototype.toString
            this.interceptFunctionToString();
            
            // Intercept Object.prototype.toString
            this.interceptObjectToString();
            
            // Intercept Error stack traces
            this.interceptErrorStackTraces();
            
            // Intercept property descriptor checks
            this.interceptPropertyDescriptors();
            
            // Protect against proxy detection
            this.protectProxyDetection();
            
            console.log('[Chameleon] Meta-proxy protection applied');
        }
        
        setupRegistration() {
            const self = this;
            // Global registration function for intercepted functions
            window.chameleonRegisterIntercepted = (fn) => {
                if (typeof fn === 'function') {
                    self.interceptedFunctions.add(fn);
                }
            };
        }
        
        interceptFunctionToString() {
            const self = this;
            
            Function.prototype.toString = new Proxy(this.originalToString, {
                apply(target, thisArg, args) {
                    // Check if this function is intercepted
                    if (self.interceptedFunctions.has(thisArg)) {
                        // Get function name
                        const fnName = thisArg.name || '';
                        
                        // Return native code string
                        if (fnName) {
                            return `function ${fnName}() { [native code] }`;
                        }
                        return 'function () { [native code] }';
                    }
                    
                    // Check if it's a bound function
                    if (thisArg && thisArg.toString && thisArg.toString() === '[object Function]') {
                        const boundMatch = thisArg.name && thisArg.name.match(/^bound (.+)$/);
                        if (boundMatch) {
                            return `function ${boundMatch[1]}() { [native code] }`;
                        }
                    }
                    
                    // For non-intercepted functions, return original
                    return Reflect.apply(target, thisArg, args);
                }
            });
            
            // Register the toString interceptor itself
            this.interceptedFunctions.add(Function.prototype.toString);
        }
        
        interceptObjectToString() {
            const self = this;
            
            Object.prototype.toString = new Proxy(this.originalObjectToString, {
                apply(target, thisArg, args) {
                    // Check for our fake objects
                    if (thisArg && thisArg._chameleonFakeObject) {
                        return thisArg._chameleonToStringTag || '[object Object]';
                    }
                    
                    // Check for specific types that might be spoofed
                    if (thisArg === navigator.plugins) {
                        return '[object PluginArray]';
                    }
                    if (thisArg === navigator.mimeTypes) {
                        return '[object MimeTypeArray]';
                    }
                    
                    return Reflect.apply(target, thisArg, args);
                }
            });
            
            this.interceptedFunctions.add(Object.prototype.toString);
        }
        
        interceptErrorStackTraces() {
            const self = this;
            // Override Error constructor
            const OriginalError = this.originalError;
            
            window.Error = new Proxy(OriginalError, {
                construct(target, args) {
                    const error = new target(...args);
                    
                    // Clean stack trace
                    if (error.stack) {
                        error.stack = self.cleanStackTrace(error.stack);
                    }
                    
                    return error;
                }
            });
            
            // Copy static properties
            Object.setPrototypeOf(window.Error, OriginalError);
            Object.getOwnPropertyNames(OriginalError).forEach(prop => {
                if (prop !== 'prototype' && prop !== 'length' && prop !== 'name') {
                    window.Error[prop] = OriginalError[prop];
                }
            });
            
            // Override captureStackTrace if available
            if (Error.captureStackTrace) {
                const originalCaptureStackTrace = Error.captureStackTrace;
                
                Error.captureStackTrace = function(targetObject, constructorOpt) {
                    originalCaptureStackTrace.call(this, targetObject, constructorOpt);
                    
                    if (targetObject.stack) {
                        targetObject.stack = self.cleanStackTrace(targetObject.stack);
                    }
                };
            }
            
            // Intercept stack getter
            const stackDescriptor = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');
            if (stackDescriptor && stackDescriptor.get) {
                Object.defineProperty(Error.prototype, 'stack', {
                    get: function() {
                        const stack = stackDescriptor.get.call(this);
                        return stack ? self.cleanStackTrace(stack) : stack;
                    },
                    set: stackDescriptor.set,
                    enumerable: stackDescriptor.enumerable,
                    configurable: stackDescriptor.configurable
                });
            }
        }
        
        cleanStackTrace(stack) {
            if (!stack || typeof stack !== 'string') return stack;
            
            // Remove lines containing chameleon references
            const lines = stack.split('\n');
            const cleaned = lines.filter(line => {
                const lowerLine = line.toLowerCase();
                return !lowerLine.includes('chameleon') &&
                       !lowerLine.includes('interceptor') &&
                       !lowerLine.includes('chrome-extension://');
            });
            
            return cleaned.join('\n');
        }
        
        interceptPropertyDescriptors() {
            const self = this;
            
            Object.getOwnPropertyDescriptor = new Proxy(this.originalGetOwnPropertyDescriptor, {
                apply(target, thisArg, args) {
                    const [obj, prop] = args;
                    const descriptor = Reflect.apply(target, thisArg, args);
                    
                    // Check if this is a property we've modified
                    if (descriptor && descriptor.get && self.interceptedFunctions.has(descriptor.get)) {
                        // Make it look native
                        descriptor.get = new Proxy(descriptor.get, {
                            apply(target, thisArg, args) {
                                return Reflect.apply(target, thisArg, args);
                            },
                            get(target, prop) {
                                if (prop === 'toString') {
                                    return function() {
                                        return `function get ${prop}() { [native code] }`;
                                    };
                                }
                                return target[prop];
                            }
                        });
                    }
                    
                    return descriptor;
                }
            });
        }
        
        protectProxyDetection() {
            // Override Proxy.prototype if it exists (it shouldn't normally)
            if (window.Proxy && window.Proxy.prototype) {
                delete window.Proxy.prototype;
            }
            
            // Make Proxy constructor look native
            const OriginalProxy = window.Proxy;
            
            window.Proxy = new Proxy(OriginalProxy, {
                construct(target, args) {
                    return new target(...args);
                },
                get(target, prop) {
                    if (prop === 'toString') {
                        return function() {
                            return 'function Proxy() { [native code] }';
                        };
                    }
                    return target[prop];
                }
            });
            
            // Prevent detection via Proxy.toString()
            Object.defineProperty(window.Proxy, 'toString', {
                value: function() {
                    return 'function Proxy() { [native code] }';
                },
                writable: false,
                enumerable: false,
                configurable: false
            });
        }
    }
    
    // Expose to global scope
    window.MetaProxyInterceptor = MetaProxyInterceptor;
})();