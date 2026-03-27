/**
 * Theme system controller
 * Supports palette themes (green/blue/purple) + color mode (light/dark).
 */
(function initThemeSystem() {
    const THEME_STORAGE_KEY = 'habitThemePreference';
    const LEGACY_STORAGE_KEYS = ['themePreference', 'theme'];
    const DEFAULT_THEME = 'green';
    const DEFAULT_MODE = 'light';
    const AVAILABLE_THEMES = new Set(['green', 'blue', 'purple']);
    const AVAILABLE_MODES = new Set(['light', 'dark']);

    function detectSystemMode() {
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function normalizeThemePreference(rawValue) {
        if (!rawValue) return null;

        if (rawValue === 'light' || rawValue === 'dark') {
            return { theme: DEFAULT_THEME, mode: rawValue };
        }

        const [theme, mode] = String(rawValue).split('-');
        if (AVAILABLE_THEMES.has(theme) && AVAILABLE_MODES.has(mode)) {
            return { theme, mode };
        }

        return null;
    }

    function getSavedThemePreference() {
        const saved = normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
        if (saved) return saved;

        // Backward compatibility: migrate legacy dark/light-only settings.
        for (const key of LEGACY_STORAGE_KEYS) {
            const legacy = normalizeThemePreference(localStorage.getItem(key));
            if (legacy) {
                localStorage.setItem(THEME_STORAGE_KEY, `${legacy.theme}-${legacy.mode}`);
                return legacy;
            }
        }

        return null;
    }

    function getResolvedThemePreference() {
        const saved = getSavedThemePreference();
        if (saved) return saved;

        return {
            theme: DEFAULT_THEME,
            mode: detectSystemMode() || DEFAULT_MODE
        };
    }

    function applyThemePreference(preference, { persist = false } = {}) {
        const next = {
            theme: AVAILABLE_THEMES.has(preference.theme) ? preference.theme : DEFAULT_THEME,
            mode: AVAILABLE_MODES.has(preference.mode) ? preference.mode : DEFAULT_MODE
        };

        const themeToken = `${next.theme}-${next.mode}`;
        document.body.dataset.theme = themeToken;

        if (persist) {
            localStorage.setItem(THEME_STORAGE_KEY, themeToken);
        }

        // Keep settings controls in sync with active values.
        const themeSelect = document.getElementById('themeSelect');
        const modeSelect = document.getElementById('modeSelect');

        if (themeSelect) themeSelect.value = next.theme;
        if (modeSelect) modeSelect.value = next.mode;

        // Improve installed PWA status-bar tint in supported browsers.
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) {
            const resolved = getComputedStyle(document.body).getPropertyValue('--primary-color').trim();
            if (resolved) themeMeta.setAttribute('content', resolved);
        }

        return next;
    }

    function setupThemeControls() {
        const themeSelect = document.getElementById('themeSelect');
        const modeSelect = document.getElementById('modeSelect');
        if (!themeSelect || !modeSelect) return;

        const onChange = () => {
            applyThemePreference(
                {
                    theme: themeSelect.value,
                    mode: modeSelect.value
                },
                { persist: true }
            );
        };

        themeSelect.addEventListener('change', onChange);
        modeSelect.addEventListener('change', onChange);
    }

    function setupSystemModeListener() {
        const saved = getSavedThemePreference();
        if (saved || !window.matchMedia) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (event) => {
            applyThemePreference({
                theme: DEFAULT_THEME,
                mode: event.matches ? 'dark' : 'light'
            });
        });
    }

    window.ThemeManager = {
        init() {
            applyThemePreference(getResolvedThemePreference());
            setupThemeControls();
            setupSystemModeListener();
        },
        apply: applyThemePreference,
        getCurrent: () => normalizeThemePreference(document.body.dataset.theme)
    };
})();
