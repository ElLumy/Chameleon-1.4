// content/modules/interceptors/audio.js
(function() {
    'use strict';
    
    class AudioInterceptor {
        constructor(profile, chameleonState) {
            this.profile = profile.audio;
            this.chameleonState = chameleonState;
            this.rng = new Math.seedrandom(chameleonState.seed + '_audio');
        }
        
        apply() {
            console.log('[Chameleon] Applying audio interceptor...');
            
            // Intercept AudioContext
            this.interceptAudioContext();
            
            // Intercept OfflineAudioContext
            this.interceptOfflineAudioContext();
            
            // Intercept AnalyserNode
            this.interceptAnalyserNode();
            
            console.log('[Chameleon] Audio interceptor applied');
        }
        
        interceptAudioContext() {
            const contexts = [
                window.AudioContext,
                window.webkitAudioContext
            ].filter(Boolean);
            
            contexts.forEach(AudioContextClass => {
                // Intercept constructor
                const OriginalAudioContext = AudioContextClass;
                const profile = this.profile;
                
                window[AudioContextClass.name] = new Proxy(OriginalAudioContext, {
                    construct: (target, args) => {
                        const context = new target(...args);
                        
                        // Override properties
                        Object.defineProperty(context, 'sampleRate', {
                            get: () => profile.sampleRate,
                            configurable: true
                        });
                        
                        return context;
                    }
                });
                
                // Copy static properties
                Object.setPrototypeOf(window[AudioContextClass.name], OriginalAudioContext);
                window[AudioContextClass.name].prototype = OriginalAudioContext.prototype;
            });
        }
        
        interceptOfflineAudioContext() {
            const contexts = [
                window.OfflineAudioContext,
                window.webkitOfflineAudioContext
            ].filter(Boolean);
            
            contexts.forEach(OfflineAudioContextClass => {
                const OriginalOfflineAudioContext = OfflineAudioContextClass;
                const profile = this.profile;
                
                window[OfflineAudioContextClass.name] = new Proxy(OriginalOfflineAudioContext, {
                    construct: (target, args) => {
                        // Modify sample rate if provided
                        if (args.length >= 3) {
                            args[2] = profile.sampleRate;
                        }
                        
                        return new target(...args);
                    }
                });
                
                // Copy static properties
                Object.setPrototypeOf(window[OfflineAudioContextClass.name], OriginalOfflineAudioContext);
                window[OfflineAudioContextClass.name].prototype = OriginalOfflineAudioContext.prototype;
            });
        }
        
        interceptAnalyserNode() {
            if (!window.AnalyserNode) return;
            
            // getFloatFrequencyData
            const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
            
            AnalyserNode.prototype.getFloatFrequencyData = new Proxy(originalGetFloatFrequencyData, {
                apply: (target, thisArg, args) => {
                    // Get original data
                    Reflect.apply(target, thisArg, args);
                    
                    const array = args[0];
                    if (!array) return;
                    
                    // Apply deterministic noise
                    for (let i = 0; i < array.length; i++) {
                        // Frequency-dependent noise
                        const freq = i / array.length;
                        const noiseAmount = this.profile.noise * (1 - freq * 0.5);
                        const noise = (this.rng() - 0.5) * noiseAmount;
                        
                        array[i] += noise;
                    }
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(AnalyserNode.prototype.getFloatFrequencyData);
            }
            
            // getByteFrequencyData
            const originalGetByteFrequencyData = AnalyserNode.prototype.getByteFrequencyData;
            
            AnalyserNode.prototype.getByteFrequencyData = new Proxy(originalGetByteFrequencyData, {
                apply: (target, thisArg, args) => {
                    Reflect.apply(target, thisArg, args);
                    
                    const array = args[0];
                    if (!array) return;
                    
                    for (let i = 0; i < array.length; i++) {
                        const noise = Math.floor((this.rng() - 0.5) * 2);
                        array[i] = Math.max(0, Math.min(255, array[i] + noise));
                    }
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(AnalyserNode.prototype.getByteFrequencyData);
            }
        }
    }
    
    // Expose to global scope
    window.AudioInterceptor = AudioInterceptor;
})();