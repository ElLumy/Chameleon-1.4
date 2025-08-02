// content/modules/utils/consistency-checker.js
export class ConsistencyChecker {
    constructor() {
        this.rules = this.initializeRules();
    }
    
    initializeRules() {
        return [
            // Platform consistency
            {
                name: 'Platform-UserAgent',
                check: (profile) => {
                    const platform = profile.navigator.platform.toLowerCase();
                    const ua = profile.navigator.userAgent.toLowerCase();
                    
                    if (platform.includes('win') && !ua.includes('windows')) return false;
                    if (platform.includes('mac') && !ua.includes('mac')) return false;
                    if (platform.includes('linux') && !ua.includes('linux')) return false;
                    
                    return true;
                },
                severity: 'critical',
                message: 'Platform and UserAgent mismatch'
            },
            
            // WebGL consistency
            {
                name: 'WebGL-Platform',
                check: (profile) => {
                    const platform = profile.navigator.platform.toLowerCase();
                    const renderer = profile.webgl.renderer.toLowerCase();
                    
                    // Windows checks
                    if (platform.includes('win')) {
                        if (renderer.includes('apple')) return false;
                        if (!renderer.includes('direct3d') && !renderer.includes('d3d')) return false;
                    }
                    
                    // Mac checks
                    if (platform.includes('mac')) {
                        if (renderer.includes('direct3d')) return false;
                        if (renderer.includes('nvidia') || renderer.includes('amd')) return false;
                        if (!renderer.includes('apple') && !renderer.includes('intel')) return false;
                    }
                    
                    // Linux checks
                    if (platform.includes('linux')) {
                        if (renderer.includes('direct3d')) return false;
                        if (renderer.includes('apple')) return false;
                    }
                    
                    return true;
                },
                severity: 'critical',
                message: 'WebGL renderer incompatible with platform'
            },
            
            // Touch support consistency
            {
                name: 'Touch-DeviceType',
                check: (profile) => {
                    const maxTouchPoints = profile.navigator.maxTouchPoints;
                    const ua = profile.navigator.userAgent.toLowerCase();
                    const isMobile = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone');
                    
                    if (isMobile && maxTouchPoints === 0) return false;
                    if (!isMobile && maxTouchPoints > 10) return false;
                    
                    return true;
                },
                severity: 'high',
                message: 'Touch support inconsistent with device type'
            },
            
            // Screen resolution consistency
            {
                name: 'Resolution-DeviceType',
                check: (profile) => {
                    const width = profile.screen.width;
                    const height = profile.screen.height;
                    const ua = profile.navigator.userAgent.toLowerCase();
                    const isMobile = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone');
                    
                    if (isMobile) {
                        // Mobile resolutions typically portrait
                        if (width > height) return false;
                        if (width > 1080) return false;
                    } else {
                        // Desktop resolutions typically landscape
                        if (width < height) return false;
                        if (width < 1024) return false;
                    }
                    
                    return true;
                },
                severity: 'medium',
                message: 'Screen resolution unusual for device type'
            },
            
            // Hardware consistency
            {
                name: 'Hardware-DeviceType',
                check: (profile) => {
                    const cores = profile.navigator.hardwareConcurrency;
                    const memory = profile.navigator.deviceMemory;
                    const ua = profile.navigator.userAgent.toLowerCase();
                    const isMobile = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone');
                    
                    if (isMobile) {
                        if (cores > 8) return false;
                        if (memory > 8) return false;
                    } else {
                        if (cores < 2) return false;
                        if (memory < 4) return false;
                    }
                    
                    return true;
                },
                severity: 'medium',
                message: 'Hardware specs inconsistent with device type'
            },
            
            // Language-Timezone consistency
            {
                name: 'Language-Timezone',
                check: (profile) => {
                    const lang = profile.navigator.language.split('-')[0];
                    const timezone = profile.timezone.name;
                    
                    const timezoneLanguages = {
                        'America/New_York': ['en'],
                        'America/Chicago': ['en'],
                        'America/Los_Angeles': ['en'],
                        'America/Toronto': ['en', 'fr'],
                        'America/Mexico_City': ['es'],
                        'America/Sao_Paulo': ['pt'],
                        'America/Buenos_Aires': ['es'],
                        'Europe/London': ['en'],
                        'Europe/Paris': ['fr'],
                        'Europe/Berlin': ['de'],
                        'Europe/Madrid': ['es'],
                        'Europe/Rome': ['it'],
                        'Europe/Moscow': ['ru'],
                        'Asia/Tokyo': ['ja'],
                        'Asia/Shanghai': ['zh'],
                        'Asia/Seoul': ['ko'],
                        'Asia/Kolkata': ['hi', 'en'],
                        'Australia/Sydney': ['en']
                    };
                    
                    const expectedLangs = timezoneLanguages[timezone];
                    if (expectedLangs && !expectedLangs.includes(lang)) {
                        return false;
                    }
                    
                    return true;
                },
                severity: 'low',
                message: 'Language unusual for timezone'
            },
            
            // Plugins consistency
            {
                name: 'Plugins-Platform',
                check: (profile) => {
                    const plugins = profile.navigator.plugins;
                    const ua = profile.navigator.userAgent.toLowerCase();
                    const isMobile = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone');
                    
                    if (isMobile && plugins.length > 0) return false;
                    if (!isMobile && plugins.length === 0) return false;
                    
                    return true;
                },
                severity: 'medium',
                message: 'Plugin count inconsistent with platform'
            },
            
            // Color depth consistency
            {
                name: 'ColorDepth-Platform',
                check: (profile) => {
                    const colorDepth = profile.screen.colorDepth;
                    const platform = profile.navigator.platform.toLowerCase();
                    
                    if (platform.includes('mac') && colorDepth !== 30 && colorDepth !== 24) {
                        return false;
                    }
                    
                    if (colorDepth !== 24 && colorDepth !== 30 && colorDepth !== 32) {
                        return false;
                    }
                    
                    return true;
                },
                severity: 'low',
                message: 'Color depth unusual for platform'
            },
            
            // Font consistency
            {
                name: 'Fonts-Platform',
                check: (profile) => {
                    const fonts = profile.fonts.available;
                    const platform = profile.navigator.platform.toLowerCase();
                    
                    const platformFonts = {
                        'win': ['Arial', 'Calibri', 'Segoe UI', 'Times New Roman'],
                        'mac': ['Helvetica', 'Helvetica Neue', 'San Francisco', 'Lucida Grande'],
                        'linux': ['DejaVu Sans', 'Liberation Sans', 'Ubuntu']
                    };
                    
                    for (const [plat, requiredFonts] of Object.entries(platformFonts)) {
                        if (platform.includes(plat)) {
                            const hasRequired = requiredFonts.some(font => fonts.includes(font));
                            if (!hasRequired) return false;
                        }
                    }
                    
                    return true;
                },
                severity: 'medium',
                message: 'Font list missing platform-specific fonts'
            },
            
            // Battery consistency
            {
                name: 'Battery-DeviceType',
                check: (profile) => {
                    const battery = profile.battery;
                    const ua = profile.navigator.userAgent.toLowerCase();
                    const isMobile = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone');
                    const isLaptop = ua.includes('macbook') || (ua.includes('windows') && profile.navigator.maxTouchPoints > 0);
                    
                    if (!isMobile && !isLaptop && battery.level < 1.0) {
                        // Desktop should always be at 100%
                        return false;
                    }
                    
                    return true;
                },
                severity: 'low',
                message: 'Battery level inconsistent with device type'
            }
        ];
    }
    
    checkProfile(profile) {
        const results = {
            passed: 0,
            failed: 0,
            score: 100,
            issues: [],
            criticalIssues: 0,
            warnings: []
        };
        
        for (const rule of this.rules) {
            try {
                const passed = rule.check(profile);
                
                if (passed) {
                    results.passed++;
                } else {
                    results.failed++;
                    results.issues.push({
                        name: rule.name,
                        severity: rule.severity,
                        message: rule.message
                    });
                    
                    // Deduct points based on severity
                    switch (rule.severity) {
                        case 'critical':
                            results.score -= 30;
                            results.criticalIssues++;
                            break;
                        case 'high':
                            results.score -= 20;
                            break;
                        case 'medium':
                            results.score -= 10;
                            break;
                        case 'low':
                            results.score -= 5;
                            break;
                    }
                }
            } catch (error) {
                results.warnings.push({
                    rule: rule.name,
                    error: error.message
                });
            }
        }
        
        // Ensure score doesn't go below 0
        results.score = Math.max(0, results.score);
        
        // Add summary
        results.summary = this.generateSummary(results);
        
        return results;
    }
    
    generateSummary(results) {
        if (results.criticalIssues > 0) {
            return 'Critical issues detected. Profile may be easily detected as fake.';
        } else if (results.score >= 90) {
            return 'Excellent consistency. Profile appears genuine.';
        } else if (results.score >= 70) {
            return 'Good consistency with minor issues.';
        } else if (results.score >= 50) {
            return 'Moderate consistency. Some detection risk.';
        } else {
            return 'Poor consistency. High risk of detection.';
        }
    }
    
    // Check specific consistency between two values
    checkValueConsistency(value1, value2, type) {
        switch (type) {
            case 'platform-ua':
                return this.checkPlatformUA(value1, value2);
            case 'webgl-platform':
                return this.checkWebGLPlatform(value1, value2);
            case 'timezone-language':
                return this.checkTimezoneLanguage(value1, value2);
            default:
                return true;
        }
    }
    
    checkPlatformUA(platform, userAgent) {
        const pl = platform.toLowerCase();
        const ua = userAgent.toLowerCase();
        
        if (pl.includes('win') && !ua.includes('windows')) return false;
        if (pl.includes('mac') && !ua.includes('mac')) return false;
        if (pl.includes('linux') && !ua.includes('linux') && !ua.includes('android')) return false;
        
        return true;
    }
    
    checkWebGLPlatform(webglRenderer, platform) {
        const renderer = webglRenderer.toLowerCase();
        const plat = platform.toLowerCase();
        
        if (plat.includes('win') && renderer.includes('apple')) return false;
        if (plat.includes('mac') && renderer.includes('direct3d')) return false;
        
        return true;
    }
    
    checkTimezoneLanguage(timezone, language) {
        // Simple check - can be expanded
        const lang = language.split('-')[0];
        
        const tzToLang = {
            'America/': ['en', 'es', 'pt', 'fr'],
            'Europe/': ['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'pt', 'ru'],
            'Asia/': ['zh', 'ja', 'ko', 'hi', 'ar', 'th', 'vi', 'id'],
            'Australia/': ['en']
        };
        
        for (const [prefix, langs] of Object.entries(tzToLang)) {
            if (timezone.startsWith(prefix)) {
                return langs.includes(lang);
            }
        }
        
        return true;
    }
}