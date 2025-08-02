// content/modules/detectors/platform-detector.js
export class PlatformDetector {
    constructor() {
        this.platforms = {
            twitch: {
                domains: ['twitch.tv', 'www.twitch.tv'],
                patterns: ['/embed/', '/popout/'],
                apis: ['__twitch__', 'Twitch'],
                priority: 'high'
            },
            youtube: {
                domains: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com'],
                patterns: ['/watch', '/embed/', '/v/'],
                apis: ['ytplayer', 'YT'],
                priority: 'high'
            },
            meta: {
                domains: ['facebook.com', 'www.facebook.com', 'meta.com', 'www.meta.com', 'instagram.com', 'www.instagram.com'],
                patterns: [],
                apis: ['FB', 'fbq'],
                priority: 'high'
            },
            tiktok: {
                domains: ['tiktok.com', 'www.tiktok.com'],
                patterns: [],
                apis: ['__UNIVERSAL_DATA__'],
                priority: 'high'
            },
            fingerprint: {
                domains: ['fingerprint.com', 'www.fingerprint.com', 'fingerprintjs.com'],
                patterns: ['/demo', '/test'],
                apis: ['FingerprintJS', 'Fingerprint'],
                priority: 'medium'
            },
            creepjs: {
                domains: ['abrahamjuliot.github.io'],
                patterns: ['/creepjs'],
                apis: [],
                priority: 'medium'
            },
            browserleaks: {
                domains: ['browserleaks.com', 'www.browserleaks.com'],
                patterns: [],
                apis: [],
                priority: 'medium'
            },
            amiunique: {
                domains: ['amiunique.org', 'www.amiunique.org'],
                patterns: [],
                apis: [],
                priority: 'medium'
            }
        };
    }
    
    detect() {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;
        
        // Check each platform
        for (const [platform, config] of Object.entries(this.platforms)) {
            // Domain check
            if (config.domains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
                return {
                    platform,
                    confidence: 'high',
                    method: 'domain',
                    priority: config.priority
                };
            }
            
            // Pattern check
            if (config.patterns.some(pattern => pathname.includes(pattern))) {
                return {
                    platform,
                    confidence: 'medium',
                    method: 'pattern',
                    priority: config.priority
                };
            }
            
            // API check
            if (config.apis.some(api => window[api] !== undefined)) {
                return {
                    platform,
                    confidence: 'medium',
                    method: 'api',
                    priority: config.priority
                };
            }
        }
        
        // Check for specific fingerprinting libraries
        if (this.detectFingerprintingLibraries()) {
            return {
                platform: 'fingerprinting',
                confidence: 'high',
                method: 'library',
                priority: 'high'
            };
        }
        
        return {
            platform: 'unknown',
            confidence: 'low',
            method: 'none',
            priority: 'low'
        };
    }
    
    detectFingerprintingLibraries() {
        // Check for common fingerprinting library signatures
        const signatures = [
            // FingerprintJS
            () => window.Fingerprint || window.FingerprintJS,
            // ClientJS
            () => window.ClientJS,
            // ImprintJS
            () => window.imprint,
            // UAParser
            () => window.UAParser,
            // Check for specific function names
            () => {
                const scripts = document.getElementsByTagName('script');
                for (const script of scripts) {
                    if (script.src && (
                        script.src.includes('fingerprint') ||
                        script.src.includes('fp.js') ||
                        script.src.includes('analytics') ||
                        script.src.includes('tracking')
                    )) {
                        return true;
                    }
                }
                return false;
            }
        ];
        
        return signatures.some(check => {
            try {
                return check();
            } catch (e) {
                return false;
            }
        });
    }
    
    getPlatformWarnings(platform) {
        const warnings = {
            youtube: 'YouTube uses timing analysis. Ads may still be detected.',
            meta: 'Meta uses server-side tracking. VPN is essential for full protection.',
            tiktok: 'TikTok uses VM obfuscation. Protection is limited.',
            fingerprinting: 'Fingerprinting library detected. Results may be used for tracking.'
        };
        
        return warnings[platform] || null;
    }
    
    getPlatformRecommendations(platform) {
        const recommendations = {
            youtube: [
                'Let ads play naturally (muted if desired)',
                'Use residential proxy for best results',
                'Clear YouTube cookies regularly'
            ],
            meta: [
                'Use residential proxy or VPN',
                'Match timezone with VPN location',
                'Avoid rapid account switching'
            ],
            tiktok: [
                'Use mobile user agent',
                'Expect CAPTCHAs',
                'Avoid automation'
            ],
            twitch: [
                'Clear cookies between sessions',
                'Use consistent viewing patterns',
                'Match language with location'
            ]
        };
        
        return recommendations[platform] || [];
    }
}