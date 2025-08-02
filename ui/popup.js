// ui/popup.js
(() => {
    'use strict';
    
    // State
    let currentProfile = null;
    let coherenceScore = 0;
    
    // DOM Elements
    const elements = {
        profileName: document.getElementById('profileName'),
        profileLocation: document.getElementById('profileLocation'),
        profileDevice: document.getElementById('profileDevice'),
        sessionSeed: document.getElementById('sessionSeed'),
        
        timezoneCheck: document.getElementById('timezoneCheck'),
        languageCheck: document.getElementById('languageCheck'),
        webglCheck: document.getElementById('webglCheck'),
        vpnCheck: document.getElementById('vpnCheck'),
        
        scoreFill: document.getElementById('scoreFill'),
        scoreValue: document.getElementById('scoreValue'),
        
        platformIcon: document.getElementById('platformIcon'),
        platformName: document.getElementById('platformName'),
        platformWarning: document.getElementById('platformWarning'),
        
        regenerateBtn: document.getElementById('regenerateBtn'),
        clearDataBtn: document.getElementById('clearDataBtn'),
        testFingerprintBtn: document.getElementById('testFingerprintBtn'),
        
        advancedInfo: document.getElementById('advancedInfo')
    };
    
    // Platform configurations
    const platformConfigs = {
        twitch: {
            icon: '🎮',
            name: 'Twitch',
            warning: null,
            color: '#9146FF'
        },
        youtube: {
            icon: '📺',
            name: 'YouTube',
            warning: 'YouTube uses timing analysis. Avoid skipping ads.',
            color: '#FF0000'
        },
        meta: {
            icon: '👤',
            name: 'Meta/Facebook',
            warning: 'Meta uses server-side tracking. VPN is essential!',
            color: '#1877F2'
        },
        tiktok: {
            icon: '🎵',
            name: 'TikTok',
            warning: 'TikTok uses VM obfuscation. Protection is limited.',
            color: '#000000'
        },
        other: {
            icon: '🌐',
            name: 'Other Site',
            warning: null,
            color: '#666666'
        }
    };
    
    // Initialize popup
    async function init() {
        try {
            console.log('[Chameleon Popup] Initializing...');
            
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Get session info with retries
            let sessionInfo = null;
            let retries = 3;
            
            while (retries > 0 && !sessionInfo?.profile) {
                try {
                    sessionInfo = await chrome.runtime.sendMessage({ action: 'getSessionInfo' });
                    console.log('[Chameleon Popup] Session info:', sessionInfo);
                    
                    if (sessionInfo && sessionInfo.profile) {
                        break;
                    }
                    
                    // Wait a bit before retry
                    await new Promise(resolve => setTimeout(resolve, 500));
                    retries--;
                } catch (error) {
                    console.error('[Chameleon Popup] Error getting session info:', error);
                    retries--;
                }
            }
            
            if (sessionInfo && sessionInfo.profile) {
                currentProfile = sessionInfo.profile;
                updateProfileDisplay();
                
                // Check coherence
                checkCoherence();
                
                // Update advanced info
                updateAdvancedInfo();
            } else {
                console.warn('[Chameleon Popup] No profile found');
                showNoProfile();
            }
            
            // Detect platform
            if (tab && tab.url) {
                detectPlatform(tab.url);
            }
            
            // Setup event listeners
            setupEventListeners();
            
        } catch (error) {
            console.error('[Chameleon Popup] Initialization error:', error);
            showError('Failed to initialize');
        }
    }
    
    // Show no profile state
    function showNoProfile() {
        if (elements.profileName) {
            elements.profileName.textContent = 'No Profile';
        }
        if (elements.profileLocation) {
            elements.profileLocation.textContent = 'Not initialized';
        }
        if (elements.profileDevice) {
            elements.profileDevice.textContent = 'Unknown';
        }
        if (elements.sessionSeed) {
            elements.sessionSeed.textContent = 'No session';
        }
        
        // Update coherence checks
        updateCoherenceUI({
            timezone: { status: 'error', score: 0, message: 'No profile' },
            language: { status: 'error', score: 0, message: 'No profile' },
            webgl: { status: 'error', score: 0, message: 'No profile' },
            vpn: { status: 'checking', score: 0, message: 'Checking...' }
        });
    }
    
    // Show error message
    function showError(message) {
        if (elements.profileName) {
            elements.profileName.textContent = 'Error';
        }
        if (elements.profileLocation) {
            elements.profileLocation.textContent = message;
        }
    }
    
    // Update profile display
    function updateProfileDisplay() {
        if (!currentProfile) return;
        
        try {
            console.log('[Chameleon Popup] Updating display with profile:', currentProfile);
            
            // Profile name
            if (elements.profileName) {
                elements.profileName.textContent = currentProfile.summary || currentProfile.archetype || 'Unknown Profile';
            }
            
            // Location
            if (elements.profileLocation && currentProfile.timezone) {
                const timezone = currentProfile.timezone.name || '';
                const city = timezone.split('/')[1]?.replace(/_/g, ' ') || timezone;
                elements.profileLocation.textContent = city || 'Unknown';
            }
            
            // Device
            if (elements.profileDevice) {
                if (currentProfile.screen) {
                    const resolution = `${currentProfile.screen.width}x${currentProfile.screen.height}`;
                    elements.profileDevice.textContent = resolution;
                } else {
                    elements.profileDevice.textContent = 'Unknown';
                }
            }
            
            // Session seed (first 16 chars)
            if (elements.sessionSeed && currentProfile.seed) {
                elements.sessionSeed.textContent = currentProfile.seed.substring(0, 16) + '...';
            }
        } catch (error) {
            console.error('[Chameleon Popup] Update display error:', error);
        }
    }
    
    // Detect current platform
    function detectPlatform(url) {
        try {
            const hostname = new URL(url).hostname;
            
            let platform = 'other';
            if (hostname.includes('twitch.tv')) platform = 'twitch';
            else if (hostname.includes('youtube.com')) platform = 'youtube';
            else if (hostname.includes('facebook.com') || hostname.includes('meta.com')) platform = 'meta';
            else if (hostname.includes('tiktok.com')) platform = 'tiktok';
            
            const config = platformConfigs[platform] || platformConfigs.other;
            
            // Update UI
            if (elements.platformIcon) {
                elements.platformIcon.textContent = config.icon;
            }
            if (elements.platformName) {
                elements.platformName.textContent = config.name;
            }
            
            if (elements.platformWarning) {
                if (config.warning) {
                    elements.platformWarning.textContent = config.warning;
                    elements.platformWarning.classList.add('show');
                } else {
                    elements.platformWarning.classList.remove('show');
                }
            }
            
        } catch (error) {
            console.error('[Chameleon Popup] Platform detection error:', error);
        }
    }
    
    // Check coherence
    async function checkCoherence() {
        let checks = {
            timezone: { status: 'checking', score: 0 },
            language: { status: 'checking', score: 0 },
            webgl: { status: 'checking', score: 0 },
            vpn: { status: 'checking', score: 0 }
        };
        
        if (!currentProfile) {
            updateCoherenceUI(checks);
            return;
        }
        
        try {
            // Check VPN status
            const vpnStatus = await chrome.runtime.sendMessage({ action: 'checkVPN' });
            
            if (!vpnStatus.error) {
                // Timezone check
                if (currentProfile.timezone?.name) {
                    if (vpnStatus.timezone === currentProfile.timezone.name) {
                        checks.timezone = { status: 'success', score: 25, message: 'Match' };
                    } else {
                        checks.timezone = { 
                            status: 'warning', 
                            score: 10, 
                            message: `Mismatch: ${vpnStatus.timezone || 'Unknown'}` 
                        };
                    }
                } else {
                    checks.timezone = { status: 'error', score: 0, message: 'No timezone data' };
                }
                
                // Language check
                const profileLang = currentProfile.navigator?.language?.split('-')[0];
                if (profileLang) {
                    checks.language = { status: 'success', score: 25, message: profileLang.toUpperCase() };
                } else {
                    checks.language = { status: 'error', score: 0, message: 'No language data' };
                }
                
                // WebGL check
                if (currentProfile.webgl) {
                    checks.webgl = { status: 'success', score: 25, message: 'Configured' };
                } else {
                    checks.webgl = { status: 'error', score: 0, message: 'No WebGL data' };
                }
                
                // VPN detection
                if (vpnStatus.isVPN) {
                    checks.vpn = { 
                        status: 'warning', 
                        score: 15, 
                        message: `VPN: ${vpnStatus.org || 'Unknown'}` 
                    };
                } else {
                    checks.vpn = { 
                        status: 'success', 
                        score: 25, 
                        message: 'Direct connection' 
                    };
                }
            } else {
                // Error checking VPN
                checks.vpn = { status: 'error', score: 0, message: 'Check failed' };
            }
            
        } catch (error) {
            console.error('[Chameleon Popup] Coherence check error:', error);
            checks.vpn = { status: 'error', score: 0, message: 'Check failed' };
        }
        
        // Update UI
        updateCoherenceUI(checks);
        
        // Calculate total score
        coherenceScore = Object.values(checks).reduce((sum, check) => sum + check.score, 0);
        updateScoreUI();
    }
    
    // Update coherence UI
    function updateCoherenceUI(checks) {
        const checkElements = {
            timezone: elements.timezoneCheck,
            language: elements.languageCheck,
            webgl: elements.webglCheck,
            vpn: elements.vpnCheck
        };
        
        Object.entries(checks).forEach(([key, check]) => {
            const element = checkElements[key];
            if (!element) return;
            
            // Remove all status classes
            element.classList.remove('success', 'warning', 'error');
            
            // Add appropriate class
            element.classList.add(check.status);
            
            // Update icon
            const icon = element.querySelector('.check-icon');
            if (icon) {
                if (check.status === 'success') icon.textContent = '✅';
                else if (check.status === 'warning') icon.textContent = '⚠️';
                else if (check.status === 'error') icon.textContent = '❌';
                else icon.textContent = '⏳';
            }
            
            // Update status text
            const statusText = element.querySelector('.check-status');
            if (statusText) {
                statusText.textContent = check.message || check.status;
            }
        });
    }
    
    // Update score UI
    function updateScoreUI() {
        if (elements.scoreFill) {
            elements.scoreFill.style.width = `${coherenceScore}%`;
        }
        if (elements.scoreValue) {
            elements.scoreValue.textContent = `${coherenceScore}%`;
            
            // Update color based on score
            let color;
            if (coherenceScore >= 80) color = 'var(--success-color)';
            else if (coherenceScore >= 60) color = 'var(--warning-color)';
            else color = 'var(--danger-color)';
            
            elements.scoreValue.style.color = color;
        }
    }
    
    // Update advanced info
    function updateAdvancedInfo() {
        if (!currentProfile || !elements.advancedInfo) return;
        
        try {
            const info = {
                'Session Seed': currentProfile.seed || 'N/A',
                'Profile': currentProfile.summary || currentProfile.archetype || 'N/A',
                'User Agent': currentProfile.navigator?.userAgent || 'N/A',
                'Platform': currentProfile.navigator?.platform || 'N/A',
                'Hardware Concurrency': currentProfile.navigator?.hardwareConcurrency || 'N/A',
                'Device Memory': currentProfile.navigator?.deviceMemory ? currentProfile.navigator.deviceMemory + ' GB' : 'N/A',
                'Screen Resolution': currentProfile.screen ? `${currentProfile.screen.width}x${currentProfile.screen.height}` : 'N/A',
                'Timezone': currentProfile.timezone?.name || 'N/A',
                'Language': currentProfile.navigator?.language || 'N/A',
                'WebGL Vendor': currentProfile.webgl?.vendor || 'N/A',
                'WebGL Renderer': currentProfile.webgl?.renderer || 'N/A'
            };
            
            const infoText = Object.entries(info)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
            
            elements.advancedInfo.textContent = infoText;
        } catch (error) {
            console.error('[Chameleon Popup] Advanced info error:', error);
        }
    }
    
    // Setup event listeners
    function setupEventListeners() {
        // Regenerate identity
        if (elements.regenerateBtn) {
            elements.regenerateBtn.addEventListener('click', async () => {
                if (confirm('This will regenerate your browser identity and reload all tabs. Continue?')) {
                    elements.regenerateBtn.classList.add('loading', 'regenerating');
                    elements.regenerateBtn.disabled = true;
                    
                    try {
                        const response = await chrome.runtime.sendMessage({ action: 'regenerateIdentity' });
                        if (response.success) {
                            window.close();
                        } else {
                            alert('Failed to regenerate identity: ' + (response.error || 'Unknown error'));
                        }
                    } catch (error) {
                        console.error('[Chameleon Popup] Regenerate error:', error);
                        alert('Failed to regenerate identity');
                    } finally {
                        elements.regenerateBtn.classList.remove('loading', 'regenerating');
                        elements.regenerateBtn.disabled = false;
                    }
                }
            });
        }
        
        // Clear site data
        if (elements.clearDataBtn) {
            elements.clearDataBtn.addEventListener('click', async () => {
                if (confirm('This will clear cookies and cache for tracking sites. Continue?')) {
                    elements.clearDataBtn.classList.add('loading');
                    elements.clearDataBtn.disabled = true;
                    
                    try {
                        // Clear data is handled by regenerate identity
                        await chrome.runtime.sendMessage({ action: 'regenerateIdentity' });
                        alert('Site data cleared successfully');
                        window.close();
                    } catch (error) {
                        console.error('[Chameleon Popup] Clear data error:', error);
                        alert('Failed to clear site data');
                    } finally {
                        elements.clearDataBtn.classList.remove('loading');
                        elements.clearDataBtn.disabled = false;
                    }
                }
            });
        }
        
        // Test fingerprint
        if (elements.testFingerprintBtn) {
            elements.testFingerprintBtn.addEventListener('click', () => {
                chrome.tabs.create({ url: 'https://fingerprint.com/demo/' });
            });
        }
    }
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
    
})();