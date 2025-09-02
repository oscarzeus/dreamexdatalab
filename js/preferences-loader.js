import { getDatabase, ref, onValue } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getCurrentUser } from './auth.js';

class GlobalPreferencesLoader {
    constructor() {
        this.db = getDatabase();
        this.initializePreferences();
    }

    async initializePreferences() {
        // Apply cached preferences immediately for fast initial load
        const cachedPrefs = localStorage.getItem('userPreferences');
        if (cachedPrefs) {
            try {
                const preferences = JSON.parse(cachedPrefs);
                this.applyPreferences(preferences);
            } catch (error) {
                console.error('Error applying cached preferences:', error);
            }
        }

        // Set up real-time sync
        const user = await getCurrentUser();
        if (user) {
            const prefsRef = ref(this.db, `userPreferences/${user.uid}`);
            onValue(prefsRef, (snapshot) => {
                if (snapshot.exists()) {
                    const preferences = snapshot.val();
                    this.applyPreferences(preferences);
                    localStorage.setItem('userPreferences', JSON.stringify(preferences));
                }
            });
        }
    }

    applyPreferences(preferences) {
        // Apply theme
        document.documentElement.setAttribute('data-theme', preferences.colorScheme);
        if (preferences.colorScheme === 'system') {
            this.initializeSystemThemeListener();
        }

        // Apply font settings
        document.documentElement.style.setProperty('--font-family', preferences.defaultFont);
        document.documentElement.style.setProperty('--base-font-size', `${preferences.fontSize}px`);
        document.documentElement.style.setProperty('--font-scale', preferences.fontScale);

        // Apply menu visibility settings
        if (Array.isArray(preferences.spage)) {
            const menuItems = document.querySelectorAll('[data-feature]');
            menuItems.forEach(item => {
                const feature = item.getAttribute('data-feature');
                if (feature) {
                    item.style.display = preferences.spage.includes(feature) ? '' : 'none';
                }
            });
        }

        // Apply accessibility settings
        document.documentElement.setAttribute('data-contrast', preferences.contrastMode);
        document.documentElement.setAttribute('data-density', preferences.density);
        document.documentElement.setAttribute('data-reduced-motion', preferences.animationReduction);

        // Apply accent color
        document.documentElement.style.setProperty('--accent-color', `var(--${preferences.accentColor})`);

        // Set language
        document.documentElement.setAttribute('lang', preferences.language);

        // Set global variables for formatting
        window.globalDateFormat = preferences.dateFormat;
        window.globalTimeFormat = preferences.timeFormat;
        window.globalTimezone = preferences.timezone;
        window.globalPageSize = parseInt(preferences.defaultPageSize);
        window.globalRefreshRate = parseInt(preferences.dataRefreshRate);
        window.globalDefaultSort = preferences.defaultSort;

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('preferencesUpdated', {
            detail: preferences
        }));
    }

    initializeSystemThemeListener() {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const updateTheme = (e) => {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        };
        darkModeMediaQuery.addListener(updateTheme);
        updateTheme(darkModeMediaQuery);
    }
}

// Initialize preferences loader when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.preferencesLoader = new GlobalPreferencesLoader();
});