// content/modules/interceptors/navigator.js
(function() {
    'use strict';
    
    class NavigatorInterceptor {
        constructor(profile, chameleonState) {
            this.profile = profile.navigator;
            this.chameleonState = chameleonState;
        }
        
        apply() {
            console.log('[Chameleon] Applying navigator interceptor...');
            
            // Basic properties
            this.defineProperty(navigator, 'userAgent', this.profile.userAgent);
            this.defineProperty(navigator, 'platform', this.profile.platform);
            this.defineProperty(navigator, 'language', this.profile.language);
            this.defineProperty(navigator, 'languages', this.profile.languages);
            
            // Hardware
            this.defineProperty(navigator, 'hardwareConcurrency', this.profile.hardwareConcurrency);
            this.defineProperty(navigator, 'deviceMemory', this.profile.deviceMemory);
            this.defineProperty(navigator, 'maxTouchPoints', this.profile.maxTouchPoints);
            
            // Vendor info
            this.defineProperty(navigator, 'vendor', this.profile.vendor);
            this.defineProperty(navigator, 'vendorSub', this.profile.vendorSub);
            this.defineProperty(navigator, 'productSub', this.profile.productSub);
            
            // Browser features
            this.defineProperty(navigator, 'cookieEnabled', this.profile.cookieEnabled);
            this.defineProperty(navigator, 'onLine', this.profile.onLine);
            this.defineProperty(navigator, 'doNotTrack', this.profile.doNotTrack);
            this.defineProperty(navigator, 'webdriver', this.profile.webdriver);
            this.defineProperty(navigator, 'pdfViewerEnabled', this.profile.pdfViewerEnabled);
            
            // Plugins and MIME types
            this.interceptPlugins();
            
            // Media devices
            this.interceptMediaDevices();
            
            // Permissions
            this.interceptPermissions();
            
            // Connection
            this.interceptConnection();
            
            // User agent data
            this.interceptUserAgentData();
            
            // Clipboard
            this.interceptClipboard();
            
            // Share
            this.interceptShare();
            
            console.log('[Chameleon] Navigator interceptor applied');
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
        
        interceptPlugins() {
            const fakePluginArray = this.createFakePluginArray(this.profile.plugins);
            this.defineProperty(navigator, 'plugins', fakePluginArray);
            
            const fakeMimeTypeArray = this.createFakeMimeTypeArray(this.profile.plugins);
            this.defineProperty(navigator, 'mimeTypes', fakeMimeTypeArray);
        }
        
        createFakePluginArray(pluginsData) {
            const plugins = pluginsData.map(p => this.createFakePlugin(p));
            
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
                _chameleonFakeObject: true,
                _chameleonToStringTag: '[object PluginArray]'
            };
            
            // Add plugins by index
            for (let i = 0; i < plugins.length; i++) {
                fakePluginArray[i] = plugins[i];
            }
            
            Object.setPrototypeOf(fakePluginArray, PluginArray.prototype);
            
            return fakePluginArray;
        }
        
        createFakePlugin(pluginData) {
            const mimeTypes = pluginData.mimeTypes.map(m => this.createFakeMimeType(m, pluginData.name));
            
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
                _chameleonFakeObject: true,
                _chameleonToStringTag: '[object Plugin]'
            };
            
            // Add mimeTypes by index
            for (let i = 0; i < mimeTypes.length; i++) {
                fakePlugin[i] = mimeTypes[i];
            }
            
            Object.setPrototypeOf(fakePlugin, Plugin.prototype);
            
            return fakePlugin;
        }
        
        createFakeMimeTypeArray(pluginsData) {
            const allMimeTypes = [];
            
            pluginsData.forEach(plugin => {
                plugin.mimeTypes.forEach(mimeType => {
                    allMimeTypes.push(this.createFakeMimeType(mimeType, plugin.name));
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
                _chameleonFakeObject: true,
                _chameleonToStringTag: '[object MimeTypeArray]'
            };
            
            // Add mimeTypes by index
            for (let i = 0; i < allMimeTypes.length; i++) {
                fakeMimeTypeArray[i] = allMimeTypes[i];
            }
            
            Object.setPrototypeOf(fakeMimeTypeArray, MimeTypeArray.prototype);
            
            return fakeMimeTypeArray;
        }
        
        createFakeMimeType(mimeTypeData, pluginName) {
            const fakeMimeType = {
                type: mimeTypeData.type,
                suffixes: mimeTypeData.suffixes,
                description: mimeTypeData.description,
                enabledPlugin: this.profile.plugins.find(p => p.name === pluginName) || null,
                _chameleonFakeObject: true,
                _chameleonToStringTag: '[object MimeType]'
            };
            
            Object.setPrototypeOf(fakeMimeType, MimeType.prototype);
            
            return fakeMimeType;
        }
        
        interceptMediaDevices() {
            if (!navigator.mediaDevices) return;
            
            const devices = [];
            
            // Default devices
            devices.push({
                deviceId: 'default',
                kind: 'audioinput',
                label: 'Default - Microphone',
                groupId: 'default'
            });
            
            devices.push({
                deviceId: 'communications',
                kind: 'audiooutput',
                label: 'Default - Speakers',
                groupId: 'default'
            });
            
            // Intercept enumerateDevices
            const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
            
            navigator.mediaDevices.enumerateDevices = new Proxy(originalEnumerateDevices, {
                apply: async (target, thisArg, args) => {
                    // Return our fake devices
                    return devices.map(device => ({
                        deviceId: device.deviceId,
                        kind: device.kind,
                        label: device.label,
                        groupId: device.groupId,
                        toJSON: function() {
                            return {
                                deviceId: this.deviceId,
                                kind: this.kind,
                                label: this.label,
                                groupId: this.groupId
                            };
                        }
                    }));
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(navigator.mediaDevices.enumerateDevices);
            }
        }
        
        interceptPermissions() {
            if (!navigator.permissions) return;
            
            const originalQuery = navigator.permissions.query;
            
            navigator.permissions.query = new Proxy(originalQuery, {
                apply: async (target, thisArg, args) => {
                    const permission = args[0];
                    
                    // Return predetermined permission states
                    const states = {
                        'geolocation': 'prompt',
                        'notifications': 'prompt',
                        'push': 'prompt',
                        'midi': 'granted',
                        'camera': 'prompt',
                        'microphone': 'prompt',
                        'speaker': 'granted',
                        'device-info': 'granted',
                        'background-sync': 'granted',
                        'bluetooth': 'prompt',
                        'persistent-storage': 'prompt',
                        'ambient-light-sensor': 'denied',
                        'accelerometer': 'denied',
                        'gyroscope': 'denied',
                        'magnetometer': 'denied',
                        'clipboard': 'granted',
                        'screen-wake-lock': 'prompt'
                    };
                    
                    const state = states[permission.name] || 'prompt';
                    
                    return {
                        state: state,
                        onchange: null,
                        addEventListener: function() {},
                        removeEventListener: function() {},
                        dispatchEvent: function() { return true; }
                    };
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(navigator.permissions.query);
            }
        }
        
        interceptConnection() {
            if (!navigator.connection && !navigator.mozConnection && !navigator.webkitConnection) return;
            
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            
            if (!connection) return;
            
            this.defineProperty(connection, 'type', 'wifi');
            this.defineProperty(connection, 'effectiveType', '4g');
            this.defineProperty(connection, 'downlink', 10);
            this.defineProperty(connection, 'downlinkMax', Infinity);
            this.defineProperty(connection, 'rtt', 50);
            this.defineProperty(connection, 'saveData', false);
        }
        
        interceptUserAgentData() {
            if (!navigator.userAgentData) return;
            
            const uaData = this.parseUserAgent(this.profile.userAgent);
            
            // Basic properties
            this.defineProperty(navigator.userAgentData, 'brands', uaData.brands);
            this.defineProperty(navigator.userAgentData, 'mobile', uaData.mobile);
            this.defineProperty(navigator.userAgentData, 'platform', uaData.platform);
            
            // getHighEntropyValues method
            const originalGetHighEntropyValues = navigator.userAgentData.getHighEntropyValues;
            
            navigator.userAgentData.getHighEntropyValues = new Proxy(originalGetHighEntropyValues, {
                apply: async (target, thisArg, args) => {
                    const hints = args[0] || [];
                    const result = {};
                    
                    const availableHints = {
                        'architecture': uaData.architecture,
                        'bitness': uaData.bitness,
                        'brands': uaData.brands,
                        'formFactor': uaData.formFactor,
                        'fullVersionList': uaData.fullVersionList,
                        'mobile': uaData.mobile,
                        'model': uaData.model,
                        'platform': uaData.platform,
                        'platformVersion': uaData.platformVersion,
                        'uaFullVersion': uaData.uaFullVersion,
                        'wow64': uaData.wow64
                    };
                    
                    hints.forEach(hint => {
                        if (hint in availableHints) {
                            result[hint] = availableHints[hint];
                        }
                    });
                    
                    return result;
                }
            });
            
            if (window.chameleonRegisterIntercepted) {
                window.chameleonRegisterIntercepted(navigator.userAgentData.getHighEntropyValues);
            }
        }
        
        parseUserAgent(userAgent) {
            const mobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
            const platform = this.profile.platform;
            
            // Extract Chrome version
            const chromeMatch = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
            const chromeVersion = chromeMatch ? chromeMatch[1] : '120.0.0.0';
            const majorVersion = chromeVersion.split('.')[0];
            
            const brands = [
                { brand: 'Not_A Brand', version: '8' },
                { brand: 'Chromium', version: majorVersion },
                { brand: 'Google Chrome', version: majorVersion }
            ];
            
            const fullVersionList = [
                { brand: 'Not_A Brand', version: '8.0.0.0' },
                { brand: 'Chromium', version: chromeVersion },
                { brand: 'Google Chrome', version: chromeVersion }
            ];
            
            return {
                brands,
                mobile,
                platform,
                architecture: platform.includes('64') ? 'x86' : 'x86',
                bitness: platform.includes('64') ? '64' : '32',
                formFactor: mobile ? 'Mobile' : 'Desktop',
                fullVersionList,
                model: mobile ? this.profile.userAgent.match(/\((.*?)\)/)?.[1] || '' : '',
                platformVersion: this.getPlatformVersion(),
                uaFullVersion: chromeVersion,
                wow64: false
            };
        }
        
        getPlatformVersion() {
            if (this.profile.platform === 'Win32') {
                return '10.0.0'; // Windows 10/11
            } else if (this.profile.platform === 'MacIntel') {
                return '14.5.0'; // macOS Sonoma
            } else if (this.profile.platform.includes('Linux')) {
                return '6.5.0'; // Linux kernel
            }
            return '1.0.0';
        }
        
        interceptClipboard() {
            if (!navigator.clipboard) return;
            
            // Ensure clipboard API is present but may require permission
            const fakeClipboard = {
                read: async () => {
                    throw new DOMException('Permission denied', 'NotAllowedError');
                },
                readText: async () => {
                    throw new DOMException('Permission denied', 'NotAllowedError');
                },
                write: async () => {
                    throw new DOMException('Permission denied', 'NotAllowedError');
                },
                writeText: async () => {
                    throw new DOMException('Permission denied', 'NotAllowedError');
                }
            };
            
            Object.setPrototypeOf(fakeClipboard, Clipboard.prototype);
            this.defineProperty(navigator, 'clipboard', fakeClipboard);
        }
        
        interceptShare() {
            // Remove or add share capability based on platform
            if (this.profile.maxTouchPoints > 0) {
                // Mobile devices typically have share
                if (!navigator.share) {
                    navigator.share = async (data) => {
                        // Simulate share API
                        return Promise.resolve();
                    };
                }
            } else {
                // Desktop typically doesn't have share
                if (navigator.share) {
                    delete navigator.share;
                }
            }
        }
    }
    
    // Expose to global scope
    window.NavigatorInterceptor = NavigatorInterceptor;
})();