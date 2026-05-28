/**
 * PwdBook Theme Manager
 * 支持：明暗模式（dark / light / system）+ 强调色选色卡
 */
(function () {
  const STORAGE_MODE = 'pwdbook-theme-mode';
  const STORAGE_ACCENT = 'pwdbook-theme-accent';
  const DEFAULT_MODE = 'dark';
  const DEFAULT_ACCENT = 'brass';

  const ACCENTS = [
    { id: 'brass', label: '黄铜', color: '#c9a227' },
    { id: 'teal', label: '青绿', color: '#14b8a6' },
    { id: 'indigo', label: '靛蓝', color: '#6366f1' },
    { id: 'rose', label: '玫瑰', color: '#f43f5e' },
    { id: 'emerald', label: '翡翠', color: '#10b981' },
    { id: 'violet', label: '紫罗兰', color: '#8b5cf6' },
    { id: 'amber', label: '琥珀', color: '#f59e0b' },
    { id: 'ocean', label: '海洋', color: '#0ea5e9' },
  ];

  const MODES = [
    { id: 'light', label: '浅色', icon: 'sun' },
    { id: 'dark', label: '深色', icon: 'moon' },
    { id: 'system', label: '跟随系统', icon: 'monitor' },
  ];

  function getStored(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  }

  function resolveMode(mode) {
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode === 'light' ? 'light' : 'dark';
  }

  function applyTheme(mode, accent) {
    const root = document.documentElement;
    const resolved = resolveMode(mode);
    root.setAttribute('data-mode', resolved);
    root.setAttribute('data-accent', accent);
    root.setAttribute('data-mode-pref', mode);
  }

  function initTheme() {
    const mode = getStored(STORAGE_MODE, DEFAULT_MODE);
    const accent = getStored(STORAGE_ACCENT, DEFAULT_ACCENT);
    applyTheme(mode, accent);
    return { mode, accent, resolved: resolveMode(mode) };
  }

  function setMode(mode) {
    localStorage.setItem(STORAGE_MODE, mode);
    const accent = getStored(STORAGE_ACCENT, DEFAULT_ACCENT);
    applyTheme(mode, accent);
    syncUI();
  }

  function setAccent(accent) {
    localStorage.setItem(STORAGE_ACCENT, accent);
    const mode = getStored(STORAGE_MODE, DEFAULT_MODE);
    applyTheme(mode, accent);
    syncUI();
  }

  function syncUI() {
    const mode = getStored(STORAGE_MODE, DEFAULT_MODE);
    const accent = getStored(STORAGE_ACCENT, DEFAULT_ACCENT);
    const resolved = resolveMode(mode);

    document.querySelectorAll('[data-theme-mode]').forEach((btn) => {
      const active = btn.dataset.themeMode === mode;
      btn.classList.toggle('theme-segment-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    document.querySelectorAll('[data-theme-accent]').forEach((btn) => {
      const active = btn.dataset.themeAccent === accent;
      btn.classList.toggle('swatch-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const previewMode = document.getElementById('theme-preview-mode');
    const previewAccent = document.getElementById('theme-preview-accent');
    const accentMeta = ACCENTS.find((a) => a.id === accent);
    const modeMeta = MODES.find((m) => m.id === mode);

    if (previewMode) {
      previewMode.textContent = modeMeta ? modeMeta.label : mode;
      if (mode === 'system') {
        previewMode.textContent += `（当前 ${resolved === 'dark' ? '深色' : '浅色'}）`;
      }
    }
    if (previewAccent && accentMeta) {
      previewAccent.textContent = accentMeta.label;
      previewAccent.style.color = accentMeta.color;
    }
  }

  function renderAppearancePanel(container) {
    if (!container) return;

    container.innerHTML = `
      <section>
        <h3 class="text-sm font-semibold mb-1 tracking-tight">外观模式</h3>
        <p class="text-xs mb-4" style="color: var(--text-muted);">切换浅色、深色，或跟随系统设置自动切换</p>
        <div class="theme-segment flex p-1 rounded-xl" style="background: var(--bg-elevated); border: 1px solid var(--border-default);">
          ${MODES.map(
            (m) => `
            <button type="button" data-theme-mode="${m.id}"
              class="theme-segment-btn flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-all duration-200"
              aria-pressed="false">
              <i data-lucide="${m.icon}" class="w-4 h-4"></i>
              ${m.label}
            </button>`
          ).join('')}
        </div>
      </section>

      <section>
        <h3 class="text-sm font-semibold mb-1 tracking-tight">主题色</h3>
        <p class="text-xs mb-4" style="color: var(--text-muted);">选择强调色，按钮、选中态、标签等将同步更新</p>
        <div class="grid grid-cols-4 gap-3" id="accent-swatches">
          ${ACCENTS.map(
            (a) => `
            <button type="button" data-theme-accent="${a.id}" title="${a.label}"
              class="swatch-btn group flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-200"
              style="background: var(--bg-surface); border: 1px solid var(--border-default);"
              aria-pressed="false">
              <span class="swatch-color w-10 h-10 rounded-full relative flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
                style="background: ${a.color}; box-shadow: 0 4px 14px ${a.color}44;">
                <i data-lucide="check" class="swatch-check w-4 h-4 text-white opacity-0 transition-opacity duration-200"></i>
              </span>
              <span class="text-xs" style="color: var(--text-secondary);">${a.label}</span>
            </button>`
          ).join('')}
        </div>
      </section>

      <section>
        <h3 class="text-sm font-semibold mb-4 tracking-tight">预览</h3>
        <div class="rounded-2xl overflow-hidden" style="background: var(--bg-surface); border: 1px solid var(--border-default);">
          <div class="px-5 py-4 flex items-center gap-3" style="border-bottom: 1px solid var(--border-default); background: var(--bg-elevated);">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: var(--accent-subtle); border: 1px solid var(--border-accent);">
              <i data-lucide="shield-check" class="w-4 h-4" style="color: var(--accent-primary);"></i>
            </div>
            <div>
              <p class="text-sm font-medium">PwdBook</p>
              <p class="text-xs" style="color: var(--text-muted);">
                <span id="theme-preview-mode">深色</span> ·
                主题色 <span id="theme-preview-accent" style="color: var(--accent-primary);">黄铜</span>
              </p>
            </div>
          </div>
          <div class="p-5 space-y-3">
            <button type="button" class="w-full py-2.5 rounded-xl text-sm font-semibold" style="background: var(--btn-primary-bg); color: var(--btn-primary-text);">主要按钮</button>
            <div class="flex gap-2">
              <span class="text-xs px-2.5 py-1 rounded-lg font-medium" style="background: var(--accent-subtle); color: var(--accent-primary);">标签</span>
              <span class="text-xs px-2.5 py-1 rounded-lg" style="background: var(--bg-hover); color: var(--text-secondary);">次要</span>
            </div>
            <div class="rounded-xl px-3 py-2.5 text-sm" style="background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-muted);">输入框预览</div>
          </div>
        </div>
      </section>
    `;

    container.querySelectorAll('[data-theme-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.themeMode));
    });

    container.querySelectorAll('[data-theme-accent]').forEach((btn) => {
      btn.addEventListener('click', () => setAccent(btn.dataset.themeAccent));
    });

    if (window.lucide) lucide.createIcons();
    syncUI();
  }

  window.PwdBookTheme = {
    init: initTheme,
    setMode,
    setAccent,
    syncUI,
    renderAppearancePanel,
    ACCENTS,
    MODES,
  };

  initTheme();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStored(STORAGE_MODE, DEFAULT_MODE) === 'system') {
      applyTheme('system', getStored(STORAGE_ACCENT, DEFAULT_ACCENT));
      syncUI();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    renderAppearancePanel(document.getElementById('appearance-panel'));
    syncUI();
  });
})();
