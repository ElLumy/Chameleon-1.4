// content/modules/interceptors/canvas.js
(function() {
    'use strict';
    
    class CanvasInterceptor {
        constructor(profile, chameleonState) {
            this.profile = profile.canvas;
            this.chameleonState = chameleonState;
            this.rng = new Math.seedrandom(chameleonState.seed + '_canvas');
            this.appliedCanvases = new WeakSet();
        }
        
        apply() {
            console.log('[Chameleon] Applying canvas interceptor...');
            
            // Intercept 2D context methods
            this.intercept2DContext();
            
            // Intercept toDataURL
            this.interceptToDataURL();
            
            // Intercept toBlob
            this.interceptToBlob();
            
            // Intercept getImageData
            this.interceptGetImageData();
            
            console.log('[Chameleon] Canvas interceptor applied');
        }
        
        intercept2DContext() {
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            
            HTMLCanvasElement.prototype.getContext = new Proxy(originalGetContext, {
                apply: (target, thisArg, args) => {
                    const context = Reflect.apply(target, thisArg, args);
                    
                    if (args[0] === '2d' && context && !this.appliedCanvases.has(thisArg)) {
                        this.applyContextNoise(context);
                        this.appliedCanvases.add(thisArg);
                    }
                    
                    return context;
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(HTMLCanvasElement.prototype.getContext);
            }
        }
        
        applyContextNoise(ctx) {
            // Intercept fillText
            const originalFillText = ctx.fillText;
            ctx.fillText = new Proxy(originalFillText, {
                apply: (target, thisArg, args) => {
                    // Apply slight position offset
                    if (args.length >= 3) {
                        args[1] += this.profile.offsetX * 0.1;
                        args[2] += this.profile.offsetY * 0.1;
                    }
                    return Reflect.apply(target, thisArg, args);
                }
            });
            
            // Intercept strokeText
            const originalStrokeText = ctx.strokeText;
            ctx.strokeText = new Proxy(originalStrokeText, {
                apply: (target, thisArg, args) => {
                    // Apply slight position offset
                    if (args.length >= 3) {
                        args[1] += this.profile.offsetX * 0.1;
                        args[2] += this.profile.offsetY * 0.1;
                    }
                    return Reflect.apply(target, thisArg, args);
                }
            });
        }
        
        interceptToDataURL() {
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            
            HTMLCanvasElement.prototype.toDataURL = new Proxy(originalToDataURL, {
                apply: (target, thisArg, args) => {
                    this.applyCanvasNoise(thisArg);
                    return Reflect.apply(target, thisArg, args);
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(HTMLCanvasElement.prototype.toDataURL);
            }
        }
        
        interceptToBlob() {
            const originalToBlob = HTMLCanvasElement.prototype.toBlob;
            
            HTMLCanvasElement.prototype.toBlob = new Proxy(originalToBlob, {
                apply: (target, thisArg, args) => {
                    this.applyCanvasNoise(thisArg);
                    return Reflect.apply(target, thisArg, args);
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(HTMLCanvasElement.prototype.toBlob);
            }
        }
        
        interceptGetImageData() {
            const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
            
            CanvasRenderingContext2D.prototype.getImageData = new Proxy(originalGetImageData, {
                apply: (target, thisArg, args) => {
                    const imageData = Reflect.apply(target, thisArg, args);
                    
                    // Apply noise to the image data
                    this.applyImageDataNoise(imageData);
                    
                    return imageData;
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(CanvasRenderingContext2D.prototype.getImageData);
            }
        }
        
        applyCanvasNoise(canvas) {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            // Add an almost invisible pixel based on seed
            ctx.save();
            ctx.globalAlpha = 0.01;
            ctx.fillStyle = `rgb(${Math.floor(this.rng() * 256)}, ${Math.floor(this.rng() * 256)}, ${Math.floor(this.rng() * 256)})`;
            ctx.fillRect(
                canvas.width - 1 + this.profile.offsetX,
                canvas.height - 1 + this.profile.offsetY,
                1, 1
            );
            ctx.restore();
        }
        
        applyImageDataNoise(imageData) {
            const data = imageData.data;
            
            // Apply very subtle noise to a few random pixels
            const pixelCount = Math.floor(this.rng() * 10) + 5;
            
            for (let i = 0; i < pixelCount; i++) {
                const index = Math.floor(this.rng() * (data.length / 4)) * 4;
                const noise = (this.rng() - 0.5) * this.profile.noise * 255;
                
                data[index] = this.clamp(data[index] + noise);
                data[index + 1] = this.clamp(data[index + 1] + noise);
                data[index + 2] = this.clamp(data[index + 2] + noise);
            }
        }
        
        clamp(value) {
            return Math.max(0, Math.min(255, Math.round(value)));
        }
    }
    
    // Expose to global scope
    window.CanvasInterceptor = CanvasInterceptor;
})();