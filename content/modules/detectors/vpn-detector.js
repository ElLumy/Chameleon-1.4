// content/modules/detectors/vpn-detector.js
export class VPNDetector {
    constructor() {
        this.vpnData = null;
        this.ipCache = new Map();
        this.lastCheck = 0;
        this.checkInterval = 5 * 60 * 1000; // 5 minutes
    }
    
    async initialize() {
        try {
            // Load VPN ranges data
            const response = await fetch(chrome.runtime.getURL('data/vpn-ranges.json'));
            this.vpnData = await response.json();
        } catch (error) {
            console.error('[Chameleon VPNDetector] Failed to load VPN data:', error);
        }
    }
    
    async detectVPN() {
        const now = Date.now();
        
        // Check cache
        if (this.lastCheck && (now - this.lastCheck) < this.checkInterval) {
            const cached = this.ipCache.get('current');
            if (cached) return cached;
        }
        
        try {
            // Get current IP info
            const ipInfo = await this.getIPInfo();
            
            // Analyze for VPN indicators
            const analysis = this.analyzeIPInfo(ipInfo);
            
            // Cache result
            this.ipCache.set('current', analysis);
            this.lastCheck = now;
            
            return analysis;
            
        } catch (error) {
            console.error('[Chameleon VPNDetector] Detection failed:', error);
            return {
                error: true,
                message: 'VPN detection failed'
            };
        }
    }
    
    async getIPInfo() {
        // Try multiple IP info services for redundancy
        const services = [
            {
                url: 'https://ipapi.co/json/',
                parser: (data) => ({
                    ip: data.ip,
                    country: data.country_name,
                    countryCode: data.country,
                    city: data.city,
                    region: data.region,
                    timezone: data.timezone,
                    isp: data.org,
                    asn: data.asn,
                    latitude: data.latitude,
                    longitude: data.longitude
                })
            },
            {
                url: 'https://ipinfo.io/json',
                parser: (data) => ({
                    ip: data.ip,
                    country: data.country,
                    countryCode: data.country,
                    city: data.city,
                    region: data.region,
                    timezone: data.timezone,
                    isp: data.org,
                    asn: data.org,
                    latitude: parseFloat(data.loc?.split(',')[0]),
                    longitude: parseFloat(data.loc?.split(',')[1])
                })
            },
            {
                url: 'https://api.ipgeolocation.io/ipgeo?apiKey=demo',
                parser: (data) => ({
                    ip: data.ip,
                    country: data.country_name,
                    countryCode: data.country_code2,
                    city: data.city,
                    region: data.state_prov,
                    timezone: data.time_zone.name,
                    isp: data.isp,
                    asn: data.asn,
                    latitude: parseFloat(data.latitude),
                    longitude: parseFloat(data.longitude)
                })
            }
        ];
        
        for (const service of services) {
            try {
                const response = await fetch(service.url, {
                    cache: 'no-store',
                    credentials: 'omit'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    return service.parser(data);
                }
            } catch (e) {
                continue;
            }
        }
        
        throw new Error('All IP services failed');
    }
    
    analyzeIPInfo(ipInfo) {
        const analysis = {
            ip: ipInfo.ip,
            country: ipInfo.country,
            countryCode: ipInfo.countryCode,
            city: ipInfo.city,
            timezone: ipInfo.timezone,
            isp: ipInfo.isp,
            asn: ipInfo.asn,
            isVPN: false,
            isProxy: false,
            isDatacenter: false,
            isResidential: false,
            isMobile: false,
            confidence: 'low',
            type: 'unknown',
            warnings: []
        };
        
        if (!this.vpnData) {
            analysis.warnings.push('VPN database not loaded');
            return analysis;
        }
        
        // Check against known VPN providers
        const ispLower = (ipInfo.isp || '').toLowerCase();
        const asnLower = (ipInfo.asn || '').toLowerCase();
        
        // Check commercial VPNs
        for (const vpn of this.vpnData.commercialVPNs) {
            if (vpn.keywords.some(keyword => 
                ispLower.includes(keyword) || asnLower.includes(keyword)
            )) {
                analysis.isVPN = true;
                analysis.type = 'commercial_vpn';
                analysis.provider = vpn.name;
                analysis.confidence = 'high';
                analysis.warnings.push(`Commercial VPN detected: ${vpn.name}`);
                break;
            }
            
            // Check ASN
            if (vpn.asns && ipInfo.asn) {
                const asnNumber = parseInt(ipInfo.asn.replace(/\D/g, ''));
                if (vpn.asns.includes(asnNumber)) {
                    analysis.isVPN = true;
                    analysis.type = 'commercial_vpn';
                    analysis.provider = vpn.name;
                    analysis.confidence = 'high';
                    analysis.warnings.push(`VPN ASN detected: ${vpn.name}`);
                    break;
                }
            }
        }
        
        // Check datacenters
        if (!analysis.isVPN) {
            for (const dc of this.vpnData.datacenters) {
                if (dc.keywords.some(keyword => 
                    ispLower.includes(keyword) || asnLower.includes(keyword)
                )) {
                    analysis.isDatacenter = true;
                    analysis.type = 'datacenter';
                    analysis.provider = dc.name;
                    analysis.confidence = 'high';
                    analysis.warnings.push(`Datacenter IP detected: ${dc.name}`);
                    break;
                }
            }
        }
        
        // Check residential proxies
        for (const rp of this.vpnData.residentialProxies) {
            if (rp.keywords.some(keyword => 
                ispLower.includes(keyword) || asnLower.includes(keyword)
            )) {
                analysis.isProxy = true;
                analysis.isResidential = true;
                analysis.type = 'residential_proxy';
                analysis.provider = rp.name;
                analysis.confidence = 'medium';
                analysis.warnings.push(`Residential proxy detected: ${rp.name}`);
                break;
            }
        }
        
        // Mobile network detection
        const mobileKeywords = ['mobile', 'cellular', 'wireless', 'telecom', 'vodafone', 'verizon', 'at&t', 't-mobile'];
        if (mobileKeywords.some(keyword => ispLower.includes(keyword))) {
            analysis.isMobile = true;
            if (!analysis.isVPN && !analysis.isProxy) {
                analysis.type = 'mobile';
                analysis.confidence = 'high';
            }
        }
        
        // Additional heuristics
        if (!analysis.isVPN && !analysis.isProxy && !analysis.isDatacenter) {
            // Check for suspicious patterns
            if (ispLower.includes('hosting') || ispLower.includes('server') || ispLower.includes('cloud')) {
                analysis.isDatacenter = true;
                analysis.type = 'datacenter';
                analysis.confidence = 'medium';
                analysis.warnings.push('Possible datacenter IP');
            } else if (!analysis.isMobile) {
                // Likely residential
                analysis.isResidential = true;
                analysis.type = 'residential';
                analysis.confidence = 'medium';
            }
        }
        
        return analysis;
    }
    
    async checkCoherence(profile) {
        const vpnInfo = await this.detectVPN();
        const coherence = {
            score: 100,
            issues: [],
            recommendations: []
        };
        
        // Check timezone match
        if (vpnInfo.timezone !== profile.timezone.name) {
            coherence.score -= 30;
            coherence.issues.push({
                type: 'timezone_mismatch',
                severity: 'high',
                message: `Timezone mismatch: IP shows ${vpnInfo.timezone} but profile shows ${profile.timezone.name}`
            });
            coherence.recommendations.push('Use VPN server in matching timezone');
        }
        
        // Check country match
        const profileCountry = profile.timezone.country;
        if (vpnInfo.country !== profileCountry && vpnInfo.countryCode !== profileCountry) {
            coherence.score -= 20;
            coherence.issues.push({
                type: 'country_mismatch',
                severity: 'medium',
                message: `Country mismatch: IP shows ${vpnInfo.country} but profile suggests ${profileCountry}`
            });
        }
        
        // Check VPN type
        if (vpnInfo.isVPN && vpnInfo.type === 'commercial_vpn') {
            coherence.score -= 20;
            coherence.issues.push({
                type: 'commercial_vpn',
                severity: 'medium',
                message: `Commercial VPN detected: ${vpnInfo.provider}`
            });
            coherence.recommendations.push('Consider using residential proxy for better anonymity');
        }
        
        if (vpnInfo.isDatacenter && !vpnInfo.isVPN) {
            coherence.score -= 25;
            coherence.issues.push({
                type: 'datacenter_ip',
                severity: 'high',
                message: 'Datacenter IP without VPN service'
            });
            coherence.recommendations.push('Use residential IP or known VPN service');
        }
        
        // Language coherence
        const expectedLanguages = this.getExpectedLanguages(vpnInfo.countryCode);
        const profileLang = profile.navigator.language.split('-')[0];
        
        if (expectedLanguages.length > 0 && !expectedLanguages.includes(profileLang)) {
            coherence.score -= 15;
            coherence.issues.push({
                type: 'language_mismatch',
                severity: 'low',
                message: `Language ${profile.navigator.language} unusual for ${vpnInfo.country}`
            });
            coherence.recommendations.push(`Consider using ${expectedLanguages[0]} for ${vpnInfo.country}`);
        }
        
        return coherence;
    }
    
    getExpectedLanguages(countryCode) {
        const countryLanguages = {
            'US': ['en'],
            'GB': ['en'],
            'CA': ['en', 'fr'],
            'AU': ['en'],
            'DE': ['de'],
            'FR': ['fr'],
            'ES': ['es'],
            'IT': ['it'],
            'BR': ['pt'],
            'MX': ['es'],
            'AR': ['es'],
            'JP': ['ja'],
            'CN': ['zh'],
            'KR': ['ko'],
            'RU': ['ru'],
            'NL': ['nl'],
            'SE': ['sv'],
            'NO': ['no'],
            'DK': ['da'],
            'FI': ['fi'],
            'PL': ['pl'],
            'IN': ['hi', 'en'],
            'SG': ['en', 'zh', 'ms', 'ta'],
            'HK': ['zh', 'en'],
            'TW': ['zh'],
            'AE': ['ar', 'en'],
            'SA': ['ar'],
            'EG': ['ar'],
            'IL': ['he', 'ar', 'en'],
            'TH': ['th'],
            'VN': ['vi'],
            'ID': ['id'],
            'MY': ['ms', 'en', 'zh'],
            'PH': ['en', 'tl'],
            'NZ': ['en'],
            'ZA': ['en', 'af', 'zu'],
            'NG': ['en'],
            'KE': ['en', 'sw'],
            'GH': ['en'],
            'CL': ['es'],
            'CO': ['es'],
            'PE': ['es'],
            'VE': ['es'],
            'EC': ['es'],
            'UY': ['es'],
            'PY': ['es'],
            'BO': ['es'],
            'CR': ['es'],
            'PA': ['es'],
            'DO': ['es'],
            'GT': ['es'],
            'CU': ['es'],
            'PT': ['pt'],
            'RO': ['ro'],
            'CZ': ['cs'],
            'HU': ['hu'],
            'GR': ['el'],
            'BG': ['bg'],
            'RS': ['sr'],
            'HR': ['hr'],
            'SK': ['sk'],
            'SI': ['sl'],
            'LT': ['lt'],
            'LV': ['lv'],
            'EE': ['et'],
            'UA': ['uk', 'ru'],
            'BY': ['be', 'ru'],
            'KZ': ['kk', 'ru'],
            'TR': ['tr'],
            'IR': ['fa'],
            'IQ': ['ar', 'ku'],
            'PK': ['ur', 'en'],
            'BD': ['bn'],
            'LK': ['si', 'ta'],
            'MM': ['my'],
            'NP': ['ne'],
            'AF': ['ps', 'fa'],
            'MA': ['ar', 'fr'],
            'DZ': ['ar', 'fr'],
            'TN': ['ar', 'fr'],
            'LY': ['ar'],
            'ET': ['am'],
            'SO': ['so'],
            'UG': ['en', 'sw'],
            'RW': ['rw', 'fr', 'en'],
            'TZ': ['sw', 'en'],
            'MZ': ['pt'],
            'AO': ['pt'],
            'ZW': ['en', 'sn', 'nd'],
            'BW': ['en', 'tn'],
            'MW': ['en', 'ny'],
            'ZM': ['en'],
            'SN': ['fr', 'wo'],
            'ML': ['fr'],
            'BF': ['fr'],
            'NE': ['fr'],
            'TD': ['fr', 'ar'],
            'CF': ['fr', 'sg'],
            'CM': ['fr', 'en'],
            'CD': ['fr'],
            'CG': ['fr'],
            'CI': ['fr'],
            'MG': ['mg', 'fr'],
            'BJ': ['fr'],
            'TG': ['fr'],
            'GA': ['fr'],
            'GN': ['fr'],
            'GQ': ['es', 'fr', 'pt'],
            'MR': ['ar', 'fr'],
            'DJ': ['fr', 'ar'],
            'KM': ['ar', 'fr'],
            'SC': ['en', 'fr'],
            'MU': ['en', 'fr'],
            'RE': ['fr'],
            'YT': ['fr']
        };
        
        return countryLanguages[countryCode] || [];
    }
}