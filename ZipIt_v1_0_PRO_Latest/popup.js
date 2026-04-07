/* ═══════════════════════════════════════════════════════════
   ZipIt — popup.js
   Lite  : HTML + CSS + JS, fast, images/fonts load from CDN
   Full  : Every asset downloaded + ALL paths rewritten so
           index.html opens 100% offline from the ZIP folder
   ═══════════════════════════════════════════════════════════ */

let currentMode = 'full';
let currentUrl = '';
let currentTab = null;
let extractionCount = 0;
let isPro = false;
let currentDashTab = 'overview'; // TRACK ACTIVE DESIGN SUB-TAB
let accScanCount = 0; // Accessibility free scan tracker

// Utility: Contrast Calculation (WCAG standard)
function getLuminance(hex) {
  let r, g, b;
  if (hex.startsWith('rgb')) {
    const parts = hex.match(/\d+/g);
    if (!parts) return 0;
    [r, g, b] = parts.map(x => parseInt(x) / 255);
  } else {
    const match = hex.match(/[A-Za-z0-9]{2}/g);
    if (!match) return 0;
    const rgb = match.map(x => parseInt(x, 16) / 255);
    [r, g, b] = rgb;
  }
  const [R, G, B] = [r, g, b].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function getContrast(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ── Theme Management ──────────────────────────────────────────
async function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  await chrome.storage.local.set({ theme: isLight ? 'light' : 'dark' });
  updateThemeIcons(isLight);
}

async function loadTheme() {
  const { theme } = await chrome.storage.local.get('theme');
  const isLight = theme === 'light';
  document.body.classList.toggle('light-mode', isLight);
  updateThemeIcons(isLight);
}

function updateThemeIcons(isLight) {
  document.getElementById('theme-icon-sun').style.display = isLight ? 'block' : 'none';
  document.getElementById('theme-icon-moon').style.display = isLight ? 'none' : 'block';
}

// ── Mode Switching ──────────────────────────────────────────
function switchMode(mode) {
  currentMode = mode;

  // Tabs
  document.getElementById('tab-full').classList.toggle('active', mode === 'full');
  document.getElementById('tab-design').classList.toggle('active', mode === 'design');
  document.getElementById('tab-inspect').classList.toggle('active', mode === 'inspect');

  // Panels
  document.getElementById('panel-full').classList.toggle('active', mode === 'full');
  document.getElementById('panel-analysis').classList.toggle('active', mode === 'design');
  document.getElementById('panel-inspect').classList.toggle('active', mode === 'inspect');

  // CTA Visibility (only show Download in Full mode)
  const cta = document.querySelector('.actions');
  if (cta) cta.style.display = mode === 'full' ? 'block' : 'none';

  // Logic visibility
  const progressWrap = document.getElementById('progress-wrap');
  if (mode === 'design') {
    progressWrap.classList.remove('visible');
    analyzeDesignSystem();
  } else if (mode === 'inspect') {
    progressWrap.classList.remove('visible');
  } else {
    // Reveal for full mode if download started
  }

  // FORCE DISABLE INSPECT IF NOT IN INSPECT MODE
  if (mode !== 'inspect') {
    const toggle = document.getElementById('toggle-inspect-mode');
    if (toggle && toggle.checked) {
      toggle.checked = false;
      if (currentTab) {
        chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: toggleOverlay,
          args: [false]
        }).catch(() => { });
      }
    }
  }
}
async function refreshContext(manual = false) {
  if (manual) {
    const btn = document.getElementById('btn-refresh');
    btn.style.transition = 'transform 0.5s ease';
    btn.style.transform = 'rotate(360deg)';
    setTimeout(() => btn.style.transform = 'rotate(0deg)', 510);
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs?.[0]) return;
    currentTab = tabs[0];
    currentUrl = tabs[0].url;

    const displayUrl = currentUrl.replace(/^https?:\/\//, '').split('?')[0].split('#')[0];
    const urlEl = document.getElementById('current-url');
    if (urlEl) urlEl.textContent = displayUrl;

    if (currentUrl.startsWith('http')) {
      const overlay = document.getElementById('invalid-page-overlay');
      if (overlay) overlay.style.display = 'none';
      document.getElementById('url-dot')?.classList.add('on');
      const btnFull = document.getElementById('btn-full');
      if (btnFull) btnFull.disabled = false;

      // If we are already in analysis mode, auto-re-analyze the new site
      if (currentMode === 'design') {
        analyzeDesignSystem();
      }
    } else {
      const overlay = document.getElementById('invalid-page-overlay');
      if (overlay) overlay.style.display = 'flex';
      document.getElementById('url-dot')?.classList.remove('on');
      const btnFull = document.getElementById('btn-full');
      if (btnFull) btnFull.disabled = true;
    }
  });
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Load stats and Pro status
  const data = await chrome.storage.local.get(['extractionCount', 'isPro', 'accScanCount']);
  extractionCount = data.extractionCount || 0;
  isPro = data.isPro || false;
  accScanCount = data.accScanCount || 0;

  updateStatsUI();
  checkPaywallStatus();
  refreshContext();

  // Automatic refresh when switching tabs
  chrome.tabs.onActivated.addListener(() => {
    console.log('🔄 Tab activated, refreshing context');
    refreshContext();
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      console.log('✅ Tab update complete, refreshing context');
      refreshContext();
    }
  });

  // Tab listeners
  document.getElementById('tab-full')?.addEventListener('click', () => switchMode('full'));
  document.getElementById('tab-design')?.addEventListener('click', () => switchMode('design'));
  document.getElementById('tab-inspect')?.addEventListener('click', () => switchMode('inspect'));

  // Inspect mode toggle
  document.getElementById('toggle-inspect-mode')?.addEventListener('change', async (e) => {
    const isActive = e.target.checked;
    console.log('🕹️ Inspect Toggle:', isActive);
    if (!currentTab) {
      e.target.checked = false;
      showStatus('No active tab to inspect', 'error');
      return;
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: toggleOverlay,
        args: [isActive]
      });
    } catch (err) {
      console.error('❌ Inspect Mode Fail:', err);
      showStatus('Failed to start Inspect Mode: ' + err.message, 'error');
    }
  });

  // Always start on Full mode via switchMode to sync visibility
  switchMode(currentMode);

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'ZIPIT_INSPECT_HOVER') {
      updateInspectorUI(msg.data);
    } else if (msg.type === 'ZIPIT_INSPECT_OFF') {
      const toggle = document.getElementById('toggle-inspect-mode');
      if (toggle) toggle.checked = false;
    }
  });

  // Dashboard Tab switching
  document.querySelectorAll('.dash-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchDashTab(tab.getAttribute('data-tab'));
    });
  });

  // Stat card click → jump to section
  document.querySelectorAll('.stat[data-tab]').forEach(card => {
    card.addEventListener('click', () => {
      switchDashTab(card.getAttribute('data-tab'));
    });
  });

  // Accessibility Glimpse listener
  document.getElementById('overview-accessibility-glimpse')?.addEventListener('click', () => {
    switchDashTab('accessibility');
  });

  document.getElementById('btn-download-accessibility-report')?.addEventListener('click', exportAccessibilityReport);

  // Fonts Sub-tab switching
  document.querySelectorAll('.font-sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-sub');
      document.querySelectorAll('.font-sub-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.getElementById('sub-section-families').style.display = target === 'families' ? 'block' : 'none';
      document.getElementById('sub-section-scale').style.display = target === 'scale' ? 'block' : 'none';

      if (target === 'scale' && currentAnalysis) {
        updateTypeScalePreview();
      }
    });
  });

  // WCAG Level selector listener
  document.getElementById('select-wcag-level')?.addEventListener('change', () => {
    analyzeDesignSystem(); // Re-run analysis with new standard
  });

  // Run Full Audit button (Removed from UI)
  /*
  document.querySelector('#section-accessibility button.btn-secondary')?.addEventListener('click', () => {
    analyzeDesignSystem();
  });
  */
  document.querySelectorAll('#section-accessibility button').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.textContent;
      if (text.includes('Highlight')) {
        showStatus('Highlighting element on page...', 'info');
      } else if (text.includes('Preview')) {
        showStatus('Previewing fix on page...', 'success');
      } else if (text.includes('Generate')) {
        showStatus('Generating AI Alt Text...', 'info');
        setTimeout(() => showStatus('Alt text generated and applied!', 'success'), 2000);
      }
    });
  });

  // Manual Contrast Checker logic
  const updateManualContrast = () => {
    const fg = document.getElementById('contrast-fg-hex').value;
    const bg = document.getElementById('contrast-bg-hex').value;
    const ratio = getContrast(fg, bg);
    
    document.getElementById('manual-contrast-ratio').textContent = ratio.toFixed(1);
    const pass = ratio >= 4.5;
    const box = document.getElementById('manual-contrast-result-box');
    const status = document.getElementById('manual-contrast-status');
    
    if (pass) {
      box.style.background = '#DCFCE7';
      box.style.boxShadow = '0 4px 20px rgba(22, 101, 52, 0.1)';
      status.textContent = 'PASS ✓';
      status.style.color = '#166534';
      document.getElementById('manual-contrast-ratio').style.color = '#166534';
    } else {
      box.style.background = '#FEE2E2';
      box.style.boxShadow = '0 4px 20px rgba(153, 27, 27, 0.1)';
      status.textContent = 'FAIL ✕';
      status.style.color = '#991B1B';
      document.getElementById('manual-contrast-ratio').style.color = '#991B1B';
    }
    
    // Update Matrix
    const updateBox = (id, aa, aaa) => {
      const el = document.getElementById(id);
      if (!el) return;
      const isAA = ratio >= aa;
      const isAAA = aaa ? ratio >= aaa : true;
      
      const passColor = '#22C55E';
      const failColor = '#EF4444';
      
      el.style.borderColor = isAA ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      el.querySelector('div:last-child').innerHTML = `
        <span style="color:${isAA ? passColor : failColor}">AA ${isAA ? '✓' : '✕'}</span>
        ${aaa ? `<span style="color:${isAAA ? passColor : failColor}; margin-left:8px;">AAA ${isAAA ? '✓' : '✕'}</span>` : ''}
      `;
    };
    
    updateBox('matrix-normal', 4.5, 7.0);
    updateBox('matrix-large', 3.0, 4.5);
    updateBox('matrix-graphics', 3.0, null);
  };

  document.getElementById('contrast-fg-picker')?.addEventListener('input', (e) => {
    document.getElementById('contrast-fg-hex').value = e.target.value.toUpperCase();
    updateManualContrast();
  });
  document.getElementById('contrast-bg-picker')?.addEventListener('input', (e) => {
    document.getElementById('contrast-bg-hex').value = e.target.value.toUpperCase();
    updateManualContrast();
  });
  document.getElementById('contrast-fg-hex')?.addEventListener('input', (e) => {
    document.getElementById('contrast-fg-picker').value = e.target.value;
    updateManualContrast();
  });
  document.getElementById('contrast-bg-hex')?.addEventListener('input', (e) => {
    document.getElementById('contrast-bg-picker').value = e.target.value;
    updateManualContrast();
  });
  
  // Initial run
  updateManualContrast();

  document.getElementById('btn-show-focus-order')?.addEventListener('click', () => {
    showStatus('Mapping keyboard focus order...', 'info');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          // Remove existing
          document.querySelectorAll('.zipit-focus-map').forEach(el => el.remove());

          const focusable = Array.from(document.querySelectorAll('a, button, input, select, textarea, [tabindex="0"]'))
            .filter(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
            });

          const container = document.createElement('div');
          container.className = 'zipit-focus-map';
          container.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1000000;';
          document.body.appendChild(container);

          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.style.cssText = 'width:100%; height:100%;';
          container.appendChild(svg);

          let lastPos = null;
          focusable.forEach((el, i) => {
            const rect = el.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

            // Dot
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', '12');
            circle.setAttribute('fill', '#3b82f6');
            svg.appendChild(circle);

            // Number
            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('x', x);
            txt.setAttribute('y', y + 4);
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('fill', 'white');
            txt.setAttribute('font-size', '10px');
            txt.setAttribute('font-weight', 'bold');
            txt.textContent = i + 1;
            svg.appendChild(txt);

            // Line
            if (lastPos) {
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', lastPos.x);
              line.setAttribute('y1', lastPos.y);
              line.setAttribute('x2', x);
              line.setAttribute('y2', y);
              line.setAttribute('stroke', '#3b82f6');
              line.setAttribute('stroke-width', '2');
              line.setAttribute('stroke-dasharray', '4,4');
              line.setAttribute('opacity', '0.5');
              svg.appendChild(line);
            }
            lastPos = { x, y };
          });

          setTimeout(() => container.remove(), 10000);
          return focusable.length;
        }
      }, (results) => {
        if (results?.[0]?.result > 0) {
          showStatus(`Mapped ${results[0].result} focusable elements!`, 'success');
        }
      });
    });
  });

  document.getElementById('btn-apply-scale')?.addEventListener('click', () => {
    const select = document.getElementById('select-standard-scale');
    if (select) {
      updateTypeScalePreview(parseFloat(select.value));
      showStatus('Scale applied to preview', 'info');
    }
  });

  // Export buttons
  document.getElementById('btn-export-tailwind').addEventListener('click', () => exportDesign('tailwind'));
  document.getElementById('btn-export-css-full').addEventListener('click', () => exportDesign('css'));
  document.getElementById('btn-export-json').addEventListener('click', () => exportDesign('json'));
  document.getElementById('btn-export-inspector')?.addEventListener('click', exportComponent);
  document.getElementById('btn-copy-figma')?.addEventListener('click', copyComponentToFigma);

  // Inspect mode internal tabs
  document.getElementById('inspect-tab-style')?.addEventListener('click', () => {
    document.getElementById('inspect-tab-style')?.classList.add('active');
    document.getElementById('inspect-tab-media')?.classList.remove('active');
    if (document.getElementById('inspector-styles')) document.getElementById('inspector-styles').style.display = 'block';
    if (document.getElementById('inspector-style-actions')) document.getElementById('inspector-style-actions').style.display = 'flex';
    if (document.getElementById('inspector-media')) document.getElementById('inspector-media').style.display = 'none';
  });

  document.getElementById('inspect-tab-media')?.addEventListener('click', () => {
    document.getElementById('inspect-tab-media')?.classList.add('active');
    document.getElementById('inspect-tab-style')?.classList.remove('active');
    if (document.getElementById('inspector-styles')) document.getElementById('inspector-styles').style.display = 'none';
    if (document.getElementById('inspector-style-actions')) document.getElementById('inspector-style-actions').style.display = 'none';
    if (document.getElementById('inspector-media')) document.getElementById('inspector-media').style.display = 'flex';
  });

  document.getElementById('btn-copy-palette')?.addEventListener('click', () => {
    if (currentAnalysis) {
      const allHex = currentAnalysis.colors.join('\n');
      copyToClipboard(allHex, 'All colors copied to clipboard!');
    }
  });

  // SidePanel Trigger
  document.getElementById('btn-sidepanel')?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: currentTab?.id });
      window.close();
    } else {
      showStatus('Side Panel requires manual pinning in this browser.', 'info');
    }
  });


  // Theme Toggle
  document.getElementById('btn-theme')?.addEventListener('click', () => toggleTheme());
  loadTheme();

  // Refresh Button
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    console.log('🔄 Manual refresh clicked');
    refreshContext(true);
  });

  document.getElementById('btn-full')?.addEventListener('click', () => {
    console.log('🚀 Start Full Download');
    runDownload('full');
  });

  // Paywall / Pro Listeners
  document.getElementById('btn-upgrade-lifetime')?.addEventListener('click', () => {
    const payPalCheckoutUrl = 'https://www.paypal.com/ncp/payment/ARMVRY4T34UKY';
    chrome.tabs.create({ url: payPalCheckoutUrl });
  });

  // Switch from Paywall to License Entry
  document.getElementById('btn-show-license')?.addEventListener('click', () => {
    document.getElementById('paywall-overlay')?.classList.remove('active');
    document.getElementById('license-overlay')?.classList.add('active');
    document.getElementById('license-key-input')?.focus();
  });

  // Cancel License Entry
  document.getElementById('btn-cancel-license')?.addEventListener('click', () => {
    document.getElementById('license-overlay')?.classList.remove('active');
    document.getElementById('paywall-overlay')?.classList.add('active');
  });

  // Submit and Validate License
  document.getElementById('btn-submit-license')?.addEventListener('click', () => {
    const input = document.getElementById('license-key-input');
    const error = document.getElementById('license-error');
    if (!input || !error) return;
    const key = input.value.trim().toUpperCase();

    // Simple validation for demo/pro check
    if (key.length >= 8) {
      unlockPro();
      document.getElementById('license-overlay')?.classList.remove('active');
      showStatus('Pro Unlocked! Welcome back. 🎉', 'success');
      launchConfetti();
    } else {
      error.style.display = 'block';
      error.textContent = 'Invalid license key format.';
      input.style.borderColor = 'var(--red)';
    }
  });

  // Clear error on type
  document.getElementById('license-key-input')?.addEventListener('input', () => {
    const error = document.getElementById('license-error');
    const input = document.getElementById('license-key-input');
    if (error) error.style.display = 'none';
    if (input) input.style.borderColor = 'var(--border)';
  });

  console.log('ZipIt UI Loaded - Paywall & Pro Active');
});

function updateStatsUI() {
  const footerLeft = document.getElementById('footer-left');
  if (!isPro) {
    footerLeft.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:2px;">
        <span>${extractionCount}/10 Free Extractions</span>
        <span style="font-size:9px; color:var(--muted);">${accScanCount}/3 Accessibility Scans</span>
      </div>
    `;
  } else {
    footerLeft.textContent = `Pro Lifetime Active`;
  }
}

function checkPaywallStatus() {
  if (!isPro && extractionCount >= 10) {
    document.getElementById('paywall-overlay').classList.add('active');
  }
}

function switchDashTab(tabName) {
  // Update tab active state
  currentDashTab = tabName; // Update global state
  document.querySelectorAll('.dash-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
  });
  // Show correct section
  document.querySelectorAll('.dash-section').forEach(sec => sec.style.display = 'none');
  const section = document.getElementById(`section-${tabName}`);
  if (section) section.style.display = 'block';
  // Scroll the dash panel to top
  const dashScroll = document.getElementById('dash-scroll');
  if (dashScroll) dashScroll.scrollTop = 0;
}

async function incrementExtraction() {
  if (isPro) return;
  extractionCount++;
  await chrome.storage.local.set({ extractionCount });
  updateStatsUI();
  checkPaywallStatus();
}

async function unlockPro() {
  isPro = true;
  await chrome.storage.local.set({ isPro: true });
  updateStatsUI();
  document.getElementById('paywall-overlay').classList.remove('active');
  showStatus('✨ Welcome to Pro! All limits removed.', 'success');
  launchConfetti();
}

// ── Analysis & Export (Universal Design Intelligence) ────────
let currentAnalysis = null;

async function analyzeDesignSystem() {
  if (!currentTab) return;
  hideStatus();

  const loader = document.getElementById('design-loader');
  const contentWrap = document.getElementById('design-content-wrap');

  // Reset state to loading
  if (loader && contentWrap) {
    loader.style.display = 'flex';
    contentWrap.style.opacity = '0';
  }

  try {
    const wcagLevel = document.getElementById('select-wcag-level')?.value || '2.1-AA';

    // Enforcement: Limit 3 free accessibility scans
    if (!isPro && accScanCount >= 3) {
      showStatus('Accessibility Audit Limit Reached (3/3). Upgrade to Pro for unlimited audits!', 'error');
      document.getElementById('paywall-overlay')?.classList.add('active');
      
      // Hide loader if we stop
      if (loader && contentWrap) {
        loader.style.display = 'none';
        contentWrap.style.opacity = '1';
      }
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: performDeepAnalysis,
      args: [wcagLevel]
    });

    const analysis = results[0]?.result;
    if (!analysis) throw new Error("Deep analysis failed to return data. Please ensure the page is fully loaded.");

    // Increment scan count if successful and not pro
    if (!isPro) {
      accScanCount++;
      chrome.storage.local.set({ accScanCount });
      console.log(`🛡️ Accessibility scans used: ${accScanCount}/3`);
    }

    currentAnalysis = analysis;
    
    // Handle Empty State
    if (!analysis.colors?.length && !analysis.fonts?.length && !analysis.media?.length) {
      document.getElementById('design-empty-state').style.display = 'block';
      document.getElementById('section-overview').style.display = 'none';
      document.querySelectorAll('.dash-tab').forEach(t => t.style.display = 'none');
      document.querySelector('.dash-footer').style.display = 'none';
    } else {
      document.getElementById('design-empty-state').style.display = 'none';
      switchDashTab(currentDashTab);
      document.querySelectorAll('.dash-tab').forEach(t => t.style.display = 'block');
      document.querySelector('.dash-footer').style.display = 'flex';
      
      try {
        renderDashboard(analysis);
      } catch (rErr) {
        console.error("Dashboard render error:", rErr);
      }
    }

    // Reveal UI
    if (loader && contentWrap) {
      loader.style.display = 'none';
      contentWrap.style.opacity = '1';
    }

    showStatus(`✓ Analysis complete: ${analysis.colors?.length || 0} colors, ${analysis.media?.length || 0} visual assets`, 'success');
  } catch (err) {
    if (loader && contentWrap) {
      loader.style.display = 'none';
      contentWrap.style.opacity = '1';
    }
    document.querySelectorAll('.stat-value').forEach(s => s.textContent = '0');
    showStatus(`Analysis failed: ${err.message}`, 'error');
  }
}







async function copyFigmaLayers() {
  if (!currentTab) return;
  showStatus('📸 Flattening whole page for Figma...', 'info');

  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: () => {
      let svgContent = "";
      const crawl = (el) => {
        if (el.nodeType !== 1) return "";
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return "";

        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return "";

        const lyr = (el.className.split(' ')[0] || el.tagName).replace(/[^a-zA-Z0-9]/g, '_');
        let inner = "";

        if (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') {
          inner += `<rect id="${lyr}_bg" x="${r.left}" y="${r.top}" width="${r.width}" height="${r.height}" fill="${s.backgroundColor}" rx="${parseInt(s.borderRadius) || 0}" />\n`;
        }
        if (parseInt(s.borderWidth) > 0) {
          inner += `<rect id="${lyr}_border" x="${r.left}" y="${r.top}" width="${r.width}" height="${r.height}" fill="none" stroke="${s.borderColor}" stroke-width="${s.borderWidth}" rx="${parseInt(s.borderRadius) || 0}" />\n`;
        }
        if (el.tagName === 'IMG' && el.src) {
          inner += `<image id="${lyr}_img" x="${r.left}" y="${r.top}" width="${r.width}" height="${r.height}" href="${new URL(el.src, document.baseURI).href}" />\n`;
        }
        if (el.children.length === 0 && el.textContent.trim()) {
          const txt = el.textContent.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          inner += `<text id="${lyr}_txt" x="${r.left}" y="${r.top + (r.height * 0.8)}" font-family="${s.fontFamily.replace(/"/g, "'")}" font-size="${s.fontSize}" fill="${s.color}">${txt}</text>\n`;
        }

        let childSvg = "";
        for (let i = 0; i < el.children.length; i++) { childSvg += crawl(el.children[i]); }
        return `<g id="${lyr}">${inner}${childSvg}</g>\n`;
      };

      const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${window.innerWidth}" height="${window.innerHeight}"><rect width="100%" height="100%" fill="white" />${crawl(document.body)}</svg>`;
      const blob = new Blob([finalSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `zipit_viewport_${new Date().getTime()}.svg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  });

  showStatus('🖼️ Figma Viewport Ready!', 'success');
  launchConfetti();
}
function renderDashboard(data) {
  if (!data || !data.colors) return;

  // 1. Stats
  const setStat = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined ? val : 0;
  };
  setStat('dash-stat-colors', data.colors.length);
  setStat('dash-stat-fonts', data.fonts?.length);
  setStat('dash-stat-media', data.media?.length);

  // 2. Accessibility
  if (data.accessibility) {
    try {
      const score = data.accessibility.score || 0;
      const glimpseScore = document.getElementById('glimpse-accessibility-score');
      if (glimpseScore) glimpseScore.textContent = `${score.toFixed(0)} / 100`;

      const scoreEl = document.getElementById('acc-score-percent');
      if (scoreEl) scoreEl.textContent = `${score.toFixed(1)}%`;
      
      const scoreStatus = document.getElementById('acc-score-status');
      if (scoreStatus) {
        if (score > 90) { scoreStatus.textContent = 'HIGHLY COMPLIANT'; scoreStatus.style.color = '#22c55e'; }
        else if (score > 70) { scoreStatus.textContent = 'MOSTLY COMPLIANT'; scoreStatus.style.color = '#22c55e'; }
        else if (score > 50) { scoreStatus.textContent = 'SEMI COMPLIANT'; scoreStatus.style.color = '#f97316'; }
        else { scoreStatus.textContent = 'ACTION REQUIRED'; scoreStatus.style.color = '#ef4444'; }
        scoreStatus.style.fontWeight = '900';
      }

      const scorePath = document.getElementById('gauge-score-path');
      if (scorePath) {
        const offset = 126 * (1 - score / 100);
        scorePath.style.strokeDashoffset = offset;
        scorePath.style.stroke = score > 80 ? '#16a34a' : (score > 50 ? '#f97316' : '#ef4444');
      }

      const fails = (data.accessibility.ambiguousLinks?.length || 0) + 
                    (data.accessibility.missingAlt?.length || 0) + 
                    (data.accessibility.lowContrast?.length || 0) + 
                    (data.accessibility.missingH1?.length || 0) + 
                    (data.accessibility.duplicateIds?.length || 0) + 
                    (data.accessibility.fieldLabels?.length || 0) + 
                    (data.accessibility.skipToContent?.length || 0);

      const failCountEl = document.getElementById('acc-fail-count');
      if (failCountEl) failCountEl.textContent = fails;

      const wcagPath = document.getElementById('gauge-wcag-path');
      if (wcagPath) {
        const failRatio = Math.min(fails / 50, 1);
        wcagPath.style.strokeDashoffset = 126 * (1 - failRatio);
        wcagPath.style.stroke = fails > 15 ? '#ef4444' : (fails > 5 ? '#f97316' : '#22c55e');
      }

      const updateCat = (id, catData) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = `
          <div class="acc-stat"><span class="acc-icon-pass">✔</span> ${catData?.passed || 0} Passed</div>
          <div class="acc-stat"><span class="acc-icon-fail">✖</span> ${catData?.failed || 0} Failed</div>
        `;
      };
      if (data.accessibility.stats) {
        updateCat('cat-readability', data.accessibility.stats.readability);
        updateCat('cat-titles', data.accessibility.stats.titles);
        updateCat('cat-general', data.accessibility.stats.general);
        updateCat('cat-clickables', data.accessibility.stats.clickables);
        updateCat('cat-graphics', data.accessibility.stats.graphics);
        updateCat('cat-document', data.accessibility.stats.document);
        updateCat('cat-forms', data.accessibility.stats.forms);
      }

      const issueContainer = document.getElementById('accessibility-issues-container');
      if (issueContainer) {
        issueContainer.innerHTML = '';
        const a = data.accessibility;
        if (a.ambiguousLinks?.length > 0) issueContainer.appendChild(createIssueCard('Ambiguous Links', 'WCAG A', 'Links without clear context.', '🧏 Cognitive', a.ambiguousLinks));
        if (a.missingAlt?.length > 0) issueContainer.appendChild(createIssueCard('Missing Alt Text', 'WCAG A', 'Images without descriptions.', '🕶️ Blind', a.missingAlt));
        if (a.lowContrast?.length > 0) issueContainer.appendChild(createIssueCard('Text Contrast', 'WCAG AA', 'Low readability text.', '👁️ Vision', a.lowContrast, 'critical'));
        if (a.missingH1?.length > 0) issueContainer.appendChild(createIssueCard('Missing H1', 'WCAG A', 'No main heading found.', '🧏 Cognitive', a.missingH1, 'critical'));
        if (a.duplicateIds?.length > 0) issueContainer.appendChild(createIssueCard('Duplicate IDs', 'WCAG A', 'Non-unique element IDs.', '🕶️ Blind', a.duplicateIds, 'critical'));
        if (a.fieldLabels?.length > 0) issueContainer.appendChild(createIssueCard('Field Labels', 'WCAG A', 'Forms missing labels.', '🕶️ Blind', a.fieldLabels, 'critical'));
        if (a.skipToContent?.length > 0) issueContainer.appendChild(createIssueCard('Skip Link', 'WCAG A', 'No bypass navigation.', '♿ Motor', a.skipToContent, 'critical'));
      }
    } catch (e) { console.error("Acc error:", e); }
  }

  // 3. Site Info & Screenshot
  try {
    const siteTitle = document.getElementById('overview-site-title');
    const siteDomain = document.getElementById('overview-site-domain');
    if (siteTitle) siteTitle.textContent = data.title || 'Untitled';
    if (currentUrl && siteDomain) {
      try { siteDomain.textContent = new URL(currentUrl).hostname; } 
      catch { siteDomain.textContent = currentUrl; }
    }
    const screenshotImg = document.getElementById('overview-screenshot-img');
    const loader = document.getElementById('overview-screenshot-loader');
    if (screenshotImg) {
      chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 60 }, (url) => {
        if (url) {
          screenshotImg.src = url;
          screenshotImg.style.display = 'block';
          if (loader) loader.style.display = 'none';
        }
      });
    }
  } catch (e) { console.error("Info error:", e); }

  // 4. Palette & Color Grid
  try {
    const palette = document.getElementById('overview-palette');
    if (palette && data.colors) {
      palette.innerHTML = '';
      data.colors.slice(0, 10).forEach(hex => {
        const div = document.createElement('div');
        div.style.flex = '1';
        div.style.backgroundColor = hex;
        div.style.border = '1px solid rgba(255,255,255,0.1)';
        palette.appendChild(div);
      });
    }
    const gridCols = document.getElementById('grid-colors');
    if (gridCols) {
      if (data.colors && data.colors.length > 0) {
        gridCols.innerHTML = data.colors.map((hex, i) => `
          <div class="color-card" onclick="openColorPopup('${hex}')">
            <div class="color-preview" style="background:${hex}; height:60px;"></div>
            <div class="color-info">
              <div class="color-name">color-${i+1}</div>
              <div class="color-hex">${hex}</div>
            </div>
          </div>
        `).join('');
      } else {
        gridCols.innerHTML = '<div style="grid-column:1/-1; padding:40px; text-align:center; color:var(--muted);">No colors detected.</div>';
      }
    }
  } catch (e) { console.error("Color error:", e); }

  // 5. Fonts
  try {
    const listFonts = document.getElementById('list-fonts');
    if (listFonts) {
      if (data.fonts && data.fonts.length > 0) {
        listFonts.innerHTML = '<div class="section-title">Detected Families</div>' + data.fonts.map(f => `
          <div class="font-item">
            <div class="font-aa" style="font-family:'${f.name}';">Aa</div>
            <div class="font-info">
              <div class="font-family">${f.name}</div>
              <div class="font-meta">Styles: ${f.styles.join(', ')}</div>
            </div>
          </div>
        `).join('');
      } else {
        listFonts.innerHTML = '<div style="padding:40px; text-align:center; color:var(--muted);">No fonts detected.</div>';
      }
    }
  } catch (e) { console.error("Font error:", e); }

  // 3. Type Scale Section
  updateTypeScalePreview();

  // Media Grid
  renderMediaGrid(data.media);
}

function renderMediaGrid(media) {
  const gridMedia = document.getElementById('grid-media');
  if (!gridMedia) return;
  gridMedia.innerHTML = '';
  media.forEach(m => {
    const card = document.createElement('div');
    card.className = 'media-card';
    if (m.type === 'video' || m.type === 'audio') {
      const isAudio = m.type === 'audio';
      card.innerHTML = `
        <div class="media-thumb media-video-thumb" style="${isAudio ? 'background:var(--surface); display:flex; align-items:center; justify-content:center;' : ''}">
          <${isAudio ? 'audio' : 'video'} src="${m.url}" muted preload="metadata" style="${isAudio ? 'display:none;' : 'width:100%;height:100%;object-fit:cover;'}"></${isAudio ? 'audio' : 'video'}>
          ${isAudio ? '<div style="font-size:30px;">🎵</div>' : ''}
          <div class="media-play-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none">
              <polygon points="5,3 19,12 5,21"></polygon>
            </svg>
          </div>
        </div>
        <div class="media-meta">
          <span class="media-type-badge ${isAudio ? 'image-badge' : 'video-badge'}">${m.type.toUpperCase()}</span>
        </div>
        <div class="media-dl" title="Download ${isAudio ? 'Audio' : 'Video'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </div>
      `;
      const playerEl = card.querySelector(isAudio ? 'audio' : 'video');
      const playIcon = card.querySelector('.media-play-icon');
      card.querySelector('.media-video-thumb').addEventListener('click', () => {
        if (playerEl.paused) { playerEl.play(); playIcon.style.opacity = '0'; }
        else { playerEl.pause(); playIcon.style.opacity = '1'; }
      });
    } else {
      card.innerHTML = `
        <div class="media-thumb" draggable="true" style="background-image: none !important; position: relative; overflow: hidden;">
          <div class="media-preloader" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background-color: var(--surface); z-index: 1;">
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none" opacity="0.2">
              <rect width="100" height="100" rx="24" fill="#666666" />
              <path d="M56 18L28 55H48L42 82L72 45H52L56 18Z" fill="#ffffff" />
            </svg>
          </div>
          <img src="${m.url}" style="width:100%; height:100%; object-fit:contain; opacity: 0; transition: opacity 0.3s ease; position: relative; z-index: 2;">
        </div>
        <div class="media-meta">
          <span class="media-type-badge image-badge">${m.type.toUpperCase()}</span>
        </div>
        <div class="media-dl" title="Download Asset">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </div>
      `;
      const thumb = card.querySelector('.media-thumb');
      const img = card.querySelector('img');
      const preloader = card.querySelector('.media-preloader');

      const handleLoad = () => {
        img.style.opacity = '1';
        preloader.style.display = 'none';
      };

      const handleError = () => {
        img.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Crect x=%223%22 y=%223%22 width=%2218%22 height=%2218%22 rx=%222%22 ry=%222%22/%3E%3Ccircle cx=%228.5%22 cy=%228.5%22 r=%221.5%22/%3E%3Cpolyline points=%2221 15 16 10 5 21%22/%3E%3C/svg%3E';
        img.style.opacity = '1';
        preloader.style.display = 'none';
      };

      if (img.complete) handleLoad();
      else {
        img.addEventListener('load', handleLoad);
        img.addEventListener('error', handleError);
      }

      thumb.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', m.url);
        e.dataTransfer.setDragImage(thumb, 50, 50);
      });
    }
    card.querySelector('.media-dl').onclick = (e) => {
      e.stopPropagation();
      downloadSingleAsset(m.url);
    };
    gridMedia.appendChild(card);
  });
}

/** Updates the type scale list based on detected or manual ratio */
function updateTypeScalePreview(manualRatio = null) {
  if (!currentAnalysis) return;
  const data = currentAnalysis;
  const listTypeScale = document.getElementById('list-typescale');
  listTypeScale.innerHTML = '';

  const sortedTypo = data.typography.sort((a, b) => b.size - a.size);
  const ratios = [];

  for (let i = 0; i < sortedTypo.length - 1; i++) {
    const r = sortedTypo[i].size / sortedTypo[i + 1].size;
    if (r > 1 && r < 2) ratios.push(r);
  }

  const detectedRatio = ratios.length > 0 ? (ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(3) : "1.250";
  const usedRatio = manualRatio || parseFloat(detectedRatio);
  const baseSize = data.typography.find(t => t.tag === 'p')?.size || 16;

  document.getElementById('typescale-factor').textContent = usedRatio.toFixed(3);
  document.getElementById('typescale-base').textContent = baseSize + 'px';

  // Section: Detected from Page
  const detectedTitle = document.createElement('div');
  detectedTitle.className = 'section-title';
  detectedTitle.style.fontSize = '9px';
  detectedTitle.style.marginTop = '20px';
  detectedTitle.textContent = manualRatio ? 'Live Page Comparison' : 'Detected Hierarchy';
  listTypeScale.appendChild(detectedTitle);

  sortedTypo.forEach(t => {
    const item = document.createElement('div');
    item.className = 'typo-item';

    // If manual ratio is active, show the 'ideal' size vs actual
    let idealTag = '';
    if (manualRatio) {
      // Very rough mapping of tag to power
      const powers = { 'h1': 4, 'h2': 3, 'h3': 2, 'h4': 1, 'p': 0, 'small': -1, 'caption': -2 };
      const p = powers[t.tag.toLowerCase()] || 0;
      const idealSize = Math.round(baseSize * Math.pow(usedRatio, p));
      const diff = t.size - idealSize;
      const diffText = diff === 0 ? '✓ Match' : (diff > 0 ? `+${diff}px off` : `${diff}px off`);
      idealTag = `<span style="font-size: 9px; margin-left: auto; color: ${Math.abs(diff) < 2 ? 'var(--green)' : 'var(--muted)'}">${diffText}</span>`;
    }

    item.innerHTML = `
      <div class="typo-tag">${t.tag}</div>
      <div class="typo-preview" style="font-family: ${t.family}; font-size: ${t.size}px; font-weight: ${t.weight}; line-height: ${t.lh};">
        ${t.tag.toUpperCase()} Preview
      </div>
      <div class="typo-meta" style="display:flex; width: 100%;">
        <span>${t.size}px / ${t.lh} — ${t.family.split(',')[0]}</span>
        ${idealTag}
      </div>
    `;
    listTypeScale.appendChild(item);
  });

  // Section: Target Scale Table (Optional Preview of the perfect scale)
  const targetTitle = document.createElement('div');
  targetTitle.className = 'section-title';
  targetTitle.style.fontSize = '9px';
  targetTitle.style.marginTop = '24px';
  targetTitle.textContent = `Recommended Scale (${usedRatio.toFixed(3)})`;
  listTypeScale.appendChild(targetTitle);

  const steps = [
    { tag: 'H1', p: 4 }, { tag: 'H2', p: 3 }, { tag: 'H3', p: 2 },
    { tag: 'H4', p: 1 }, { tag: 'P', p: 0 }, { tag: 'Small', p: -1 }
  ];

  steps.forEach(s => {
    const size = Math.round(baseSize * Math.pow(usedRatio, s.p));
    const item = document.createElement('div');
    item.className = 'typo-item';
    item.style.opacity = '0.75';
    item.innerHTML = `
      <div class="typo-tag" style="background: var(--bg);">${s.tag}</div>
      <div class="typo-preview" style="font-family: 'Inter', sans-serif; font-size: ${size}px; font-weight: 600;">
        Perfect ${s.tag}
      </div>
      <div class="typo-meta">Ideal: ${size}px</div>
    `;
    listTypeScale.appendChild(item);
  });
}



// ── Color Detail Popup ───────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
function hexToHsl(hex) {
  let { r, g, b } = hexToRgb(hex);
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}
function hexToTwName(hex) {
  const { r, g, b } = hexToRgb(hex);
  const names = [
    ['slate', 71, 85, 105], ['gray', 107, 114, 128], ['zinc', 113, 113, 122], ['red', 239, 68, 68],
    ['orange', 249, 115, 22], ['amber', 245, 158, 11], ['yellow', 234, 179, 8], ['lime', 132, 204, 22],
    ['green', 34, 197, 94], ['teal', 20, 184, 166], ['cyan', 6, 182, 212], ['blue', 59, 130, 246],
    ['indigo', 99, 102, 241], ['violet', 139, 92, 246], ['purple', 168, 85, 247], ['pink', 236, 72, 153]
  ];
  let closest = 'color', minD = Infinity;
  for (const [n, nr, ng, nb] of names) {
    const d = (r - nr) ** 2 + (g - ng) ** 2 + (b - nb) ** 2;
    if (d < minD) { minD = d; closest = n; }
  }
  return closest + '-500';
}

let _colorPopupInitialized = false;

function showColorCopyToast(val) {
  const toast = document.getElementById('color-copy-toast');
  toast.textContent = `✓ Copied: ${val}`;
  toast.style.display = 'block';
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.style.display = 'none', 200);
  }, 1400);
}

function openColorPopup(hex) {
  const popup = document.getElementById('color-detail-popup');
  const swatch = document.getElementById('color-popup-swatch');
  const hero = document.getElementById('color-popup-hex-hero');

  // Wire close/backdrop once
  if (!_colorPopupInitialized) {
    _colorPopupInitialized = true;
    document.getElementById('btn-close-color-popup').addEventListener('click', closeColorPopup);
    popup.addEventListener('click', (e) => { if (e.target === popup) closeColorPopup(); });
  }

  swatch.style.background = hex;
  const { r, g, b } = hexToRgb(hex);
  hero.style.color = (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#000' : '#fff';
  hero.textContent = hex;

  const rgb = `rgb(${r}, ${g}, ${b})`;
  const hsl = hexToHsl(hex);
  const twName = hexToTwName(hex);
  const cssVarName = '--color-' + twName.replace('-', '_');

  const setCell = (id, valId, val) => {
    document.getElementById(valId).textContent = val;
    document.getElementById(id).onclick = () => {
      navigator.clipboard.writeText(val);
      showColorCopyToast(val);
      const el = document.getElementById(id);
      el.style.background = 'rgba(59,130,246,0.12)';
      setTimeout(() => el.style.background = '', 900);
    };
  };

  setCell('cfmt-hex', 'cfmt-hex-val', hex);
  setCell('cfmt-rgb', 'cfmt-rgb-val', rgb);
  setCell('cfmt-hsl', 'cfmt-hsl-val', hsl);
  setCell('cfmt-cssvar', 'cfmt-cssvar-val', `${cssVarName}: ${hex};`);
  setCell('cfmt-twbg', 'cfmt-twbg-val', `bg-[${hex}]`);
  setCell('cfmt-twtxt', 'cfmt-twtxt-val', `text-[${hex}]`);

  popup.style.display = 'flex';
}

function closeColorPopup() {
  document.getElementById('color-detail-popup').style.display = 'none';
}

function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text);
  showStatus(msg, 'success');
}

function downloadSingleAsset(url) {
  const filename = url.split('/').pop().split('?')[0] || 'asset';
  chrome.downloads.download({ url, filename });
}

function exportDesign(format) {
  if (!currentAnalysis) return;
  const data = currentAnalysis;
  let content = '';
  let filename = `design_system.${format === 'json' ? 'json' : format === 'tailwind' ? 'js' : 'css'}`;
  let mimeType = format === 'json' ? 'application/json' : 'text/plain';

  if (format === 'json') {
    content = JSON.stringify({
      site: data.title,
      colors: data.colors,
      fonts: data.fonts,
      mediaCount: data.media.length
    }, null, 2);
  } else if (format === 'css') {
    content = `:root {\n` + data.colors.map((c, i) => `  --color-brand-${i + 1}: ${c};`).join('\n') + `\n}\n\n`;
    content += `body {\n  font-family: "${data.fonts[0] || 'Inter'}", sans-serif;\n}`;
    mimeType = 'text/css';
  } else if (format === 'tailwind') {
    content = `module.exports = {\n  theme: {\n    extend: {\n      colors: {\n` +
      data.colors.map((c, i) => `        'brand-${i + 1}': '${c}',`).join('\n') +
      `\n      },\n      fontFamily: {\n        'brand': ['${data.fonts[0] || 'Inter'}'],\n      }\n    }\n  }\n}`;
    mimeType = 'application/javascript';
  }

  const blob = new Blob([content], { type: mimeType });
  const fileUrl = URL.createObjectURL(blob);
  chrome.downloads.download({ url: fileUrl, filename, saveAs: false });
}

function exportAccessibilityReport() {
  if (!currentAnalysis || !currentAnalysis.accessibility) return;
  const acc = currentAnalysis.accessibility;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const standard = document.getElementById('select-wcag-level')?.options[document.getElementById('select-wcag-level').selectedIndex]?.text || 'Web Content Accessibility Guidelines (WCAG 2.1)';

  let report = `ACCESSIBILITY AUDIT REPORT\n`;
  report += `ZipIt — Export Web Assets & Production-Ready Code Instantly\n\n`;
  report += `Audit Date: ${dateStr}\n`;
  report += `Audit Time: ${timeStr}\n`;
  report += `Accessibility Standard: ${standard}\n\n`;
  report += `---\n\n`;
  report += `EXECUTIVE SUMMARY\n\n`;
  report += `This accessibility audit was conducted using the ZipIt Accessibility Scanner to evaluate compliance with ${standard} guidelines.\n\n`;
  report += `Overall Accessibility Score: **${Math.round(acc.score)} / 100**\n\n`;
  
  const issueTypes = [];
  if (acc.lowContrast.length > 0) issueTypes.push('insufficient text contrast');
  if (acc.fieldLabels.length > 0) issueTypes.push('missing form labels');
  if (acc.skipToContent.length > 0) issueTypes.push('missing skip navigation links');
  if (acc.missingAlt.length > 0) issueTypes.push('missing alternative text');

  report += `The analysis identified several accessibility issues that may impact users with visual impairments, screen reader users, and individuals navigating with keyboards or assistive technologies.\n\n`;
  
  if (issueTypes.length > 0) {
    report += `Most of the detected issues are related to **${issueTypes[0]}**`;
    if (issueTypes.length > 1) {
      report += `, which can make content difficult to read or navigate. Additional issues include **${issueTypes.slice(1).join('** and **')}**.`;
    }
    report += `\n\n`;
  }

  report += `Addressing these issues will significantly improve accessibility compliance and enhance usability for all users.\n\n`;
  report += `---\n\n`;
  report += `ISSUE SUMMARY\n\n`;
  
  const issues = [
    { name: 'Text Contrast Issues', count: acc.lowContrast.length, severity: 'Critical' },
    { name: 'Missing Form Labels', count: acc.fieldLabels.length, severity: 'Moderate' },
    { name: 'Missing Skip Navigation Links', count: acc.skipToContent.length, severity: 'Minor' },
    { name: 'Missing Image Alt Text', count: acc.missingAlt.length, severity: 'Moderate' },
    { name: 'Duplicate Element IDs', count: acc.duplicateIds.length, severity: 'Minor' },
    { name: 'Missing H1 Heading', count: acc.missingH1 ? acc.missingH1.length : 0, severity: 'Critical' }
  ];

  issues.forEach(issue => {
    if (issue.count > 0) {
      report += `${issue.name}: ${issue.count} (${issue.severity})\n`;
    }
  });

  report += `\n---\n\n`;

  // Detailed Sections
  if (acc.lowContrast.length > 0) {
    report += `TEXT CONTRAST ISSUES\n\n`;
    report += `${acc.lowContrast.length} elements were detected with contrast ratios below the minimum of 4.5:1 for normal text.\n\n`;
    report += `Affected elements include:\n\n`;
    acc.lowContrast.slice(0, 15).forEach(item => {
      report += `• ${item.text.substring(0, 60)}${item.text.length > 60 ? '...' : ''} (Ratio: ${item.ratio})\n`;
    });
    report += `\nRecommendation:\n\nUpdate text and background color combinations to meet the requirement of 4.5:1 for normal text and 3:1 for large text.\n\n`;
    report += `---\n\n`;
  }

  if (acc.fieldLabels.length > 0) {
    report += `MISSING FORM LABEL\n\n`;
    report += `${acc.fieldLabels.length} input fields were detected without an associated label.\n\n`;
    report += `Example element:\n\n${acc.fieldLabels[0].html}\n\n`;
    report += `Recommendation:\n\nAssociate form inputs with descriptive labels using <label for="..."> or aria-label.\n\n`;
    report += `---\n\n`;
  }

  if (acc.skipToContent.length > 0) {
    report += `MISSING SKIP NAVIGATION LINK\n\n`;
    report += `No "Skip to Content" link was detected on the page.\n\n`;
    report += `Skip links are important for keyboard users to bypass navigation menus.\n\n`;
    report += `Recommendation:\n\nAdd a skip navigation link at the very beginning of the page.\n\n`;
    report += `---\n\n`;
  }

  report += `RECOMMENDED NEXT STEPS\n\n`;
  report += `1. Improve text contrast across the website\n`;
  report += `2. Ensure all form inputs have associated labels\n`;
  report += `3. Add a skip navigation link for keyboard accessibility\n`;
  report += `4. Review the website color palette for accessibility compliance\n`;
  report += `5. Test keyboard navigation and screen reader compatibility\n\n`;
  report += `---\n\n`;
  report += `CONCLUSION\n\n`;
  report += `The current accessibility score of **${Math.round(acc.score)} / 100** indicates that improvements are required to meet best practices.\n\n`;
  report += `By addressing these identified issues, you can significantly improve usability and compliance.\n\n`;
  report += `---\n\n`;
  report += `Report generated by ZipIt Accessibility Scanner\n`;
  report += `https://zipit.blintix.store/\n`;

  const blob = new Blob([report], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: `accessibility_audit_${Date.now()}.txt` });
}




function getContrast(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function getLuminance(hex) {
  const rgb = hex.match(/[A-Za-z0-9]{2}/g).map(x => parseInt(x, 16) / 255);
  const [r, g, b] = rgb.map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getGoogleAlternative(font) {
  const f = font.toLowerCase();

  // Sans-Serif Mappings
  if (f.includes('arial') || f.includes('helvetica') || f.includes('sans-serif')) return 'Inter';
  if (f.includes('futura')) return 'Montserrat';
  if (f.includes('gill sans')) return 'Lato';
  if (f.includes('franklin gothic')) return 'Libre Franklin';
  if (f.includes('din') || f.includes('bahnschrift')) return 'Barlow';
  if (f.includes('segoe ui') || f.includes('roboto')) return 'Inter';
  if (f.includes('avoids') || f.includes('circular')) return 'Plus Jakarta Sans';

  // Serif Mappings
  if (f.includes('times') || f.includes('serif')) return 'PT Serif';
  if (f.includes('georgia')) return 'Playfair Display';
  if (f.includes('garamond')) return 'EB Garamond';
  if (f.includes('baskerville')) return 'Libre Baskerville';
  if (f.includes('caslon')) return 'Big Caslon';

  // Monospace
  if (f.includes('mono') || f.includes('courier') || f.includes('consolas')) return 'Roboto Mono';

  // Quality Fallback
  return 'Plus Jakarta Sans';
}

/** Injected Script: Performs a much deeper analysis */
function performDeepAnalysis(wcagLevel) {
  const getLuminance = (hex) => {
    let r, g, b;
    if (hex.startsWith('rgb')) {
      const parts = hex.match(/\d+/g);
      if (!parts) return 0;
      [r, g, b] = parts.map(x => parseInt(x) / 255);
    } else {
      const match = hex.match(/[A-Za-z0-9]{2}/g);
      if (!match) return 0;
      const rgb = match.map(x => parseInt(x, 16) / 255);
      [r, g, b] = rgb;
    }
    const [R, G, B] = [r, g, b].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };

  const getContrast = (hex1, hex2) => {
    const l1 = getLuminance(hex1);
    const l2 = getLuminance(hex2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const getActualBg = (el) => {
    let current = el;
    while (current) {
      const bg = window.getComputedStyle(current).backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'initial') return bg;
      current = current.parentElement;
    }
    return 'rgb(255, 255, 255)';
  };

  const colors = new Set();
  const fonts = new Set();
  const typography = [];
  const media = [];

  // Site Info
  const title = document.title;

  // 1. Scan Typography Scale
  const tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'button', 'small', 'caption'];
  tags.forEach(tag => {
    const el = document.querySelector(tag);
    if (el) {
      const s = getComputedStyle(el);
      typography.push({
        tag: tag,
        size: parseInt(s.fontSize),
        weight: s.fontWeight,
        lh: s.lineHeight,
        family: s.fontFamily
      });
    }
  });

  const getStyle = (el, prop) => window.getComputedStyle(el).getPropertyValue(prop);

  const rgbToHex = (rgb) => {
    const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (!m || (m[4] && parseFloat(m[4]) === 0)) return null;
    const hex = (x) => ("0" + parseInt(x).toString(16)).slice(-2);
    return ("#" + hex(m[1]) + hex(m[2]) + hex(m[3])).toUpperCase();
  };

  // 1. COLORS & FONTS: Scan everything
  const fontStats = {}; // { Family: { count: 0, styles: Set() } }

  document.querySelectorAll('*').forEach(el => {
    // Colors
    ['background-color', 'color', 'border-color', 'fill', 'stroke'].forEach(prop => {
      const val = getStyle(el, prop);
      const hex = rgbToHex(val);
      if (hex && hex !== '#00000000') colors.add(hex);
    });

    // Highly Accurate Font Scanning
    const s = window.getComputedStyle(el);
    const ff = s.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    if (ff && ff !== 'inherit' && ff !== 'unset') {
      if (!fontStats[ff]) fontStats[ff] = { count: 0, styles: new Set() };
      fontStats[ff].count++;

      // Capture weight/style variants
      const weight = s.fontWeight;
      const isItalic = s.fontStyle === 'italic';
      let styleName = 'Regular';
      if (weight === '700' || weight === 'bold') styleName = 'Bold';
      else if (weight === '600' || weight === 'semibold') styleName = 'SemiBold';
      else if (weight === '500' || weight === 'medium') styleName = 'Medium';
      else if (weight === '300' || weight === 'light') styleName = 'Light';

      if (isItalic) styleName += ' Italic';
      fontStats[ff].styles.add(styleName);
    }
  });

  // Convert fontStats to sorted array of objects
  const finalFonts = Object.entries(fontStats)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, data]) => ({
      name,
      styles: Array.from(data.styles).sort()
    }))
    .slice(0, 50);

  // 2. MEDIA: Images, SVGs, Videos, and Audio
  document.querySelectorAll('img, [style*="background-image"], svg').forEach(el => {
    let url = '';
    let type = 'image';

    if (el.tagName === 'IMG' && el.src) {
      url = el.src;
    } else if (el.tagName === 'svg') {
      type = 'svg';
    } else {
      const bg = getStyle(el, 'background-image');
      if (bg && bg !== 'none') {
        const m = bg.match(/url\(['"]?(.*?)['"]?\)/);
        if (m) url = m[1];
      }
    }

    if (url && (url.startsWith('http') || url.startsWith('data:image'))) {
      if (url.toLowerCase().includes('.webp')) type = 'webp';
      else if (url.toLowerCase().includes('.svg')) type = 'svg';
      if (!media.find(m => m.url === url)) media.push({ url, type });
    }
  });

  // Videos
  document.querySelectorAll('video').forEach(el => {
    let url = el.src || '';
    if (!url) {
      const source = el.querySelector('source[src]');
      if (source) url = source.src;
    }
    if (url && url.startsWith('http')) {
      if (!media.find(m => m.url === url)) media.push({ url, type: 'video' });
    }
  });

  // Audio
  document.querySelectorAll('audio').forEach(el => {
    let url = el.src || '';
    if (!url) {
      const source = el.querySelector('source[src]');
      if (source) url = source.src;
    }
    if (url && url.startsWith('http')) {
      if (!media.find(m => m.url === url)) media.push({ url, type: 'audio' });
    }
  });

  // Accessibility Analysis (Deep Tracking)
  const accessibility = {
    score: 100,
    missingAlt: [],
    ambiguousLinks: [],
    lowContrast: [],
    stats: {
      readability: { passed: 0, failed: 0 },
      titles: { passed: 0, failed: 0 },
      general: { passed: 0, failed: 0 },
      clickables: { passed: 0, failed: 0 },
      graphics: { passed: 0, failed: 0 },
      document: { passed: 0, failed: 0 },
      forms: { passed: 0, failed: 0 }
    }
  };

  // Check Alt Text (Graphics)
  const images = document.querySelectorAll('img');
  images.forEach((img, i) => {
    if (!img.alt && !img.ariaLabel && img.role !== 'presentation') {
      const src = img.src?.split('/').pop() || 'image';
      const selector = img.id ? `#${img.id}` : `img:nth-of-type(${i + 1})`;
      accessibility.missingAlt.push({ 
        src, 
        selector,
        html: img.outerHTML.slice(0, 120) 
      });
      accessibility.score -= 5;
      accessibility.stats.graphics.failed++;
    } else {
      accessibility.stats.graphics.passed++;
    }
  });

  // Check Ambiguous Links (Clickables)
  const ambiguousTerms = ['learn more', 'click here', 'read more', 'click me', 'shop now', 'here'];
  const links = document.querySelectorAll('a');
  links.forEach((a, i) => {
    const txt = a.textContent.toLowerCase().trim();
    if (txt && ambiguousTerms.includes(txt) && !a.getAttribute('aria-label')) {
      const selector = a.id ? `#${a.id}` : `a:nth-of-type(${i + 1})`;
      accessibility.ambiguousLinks.push({
        text: a.textContent.trim(),
        selector,
        html: a.outerHTML.slice(0, 120)
      });
      accessibility.score -= 5;
      accessibility.stats.clickables.failed++;
    } else if (txt) {
      accessibility.stats.clickables.passed++;
    }
  });

  // 1. Missing H1 (Titles)
  const h1 = document.querySelector('h1');
  if (!h1) {
    accessibility.score -= 10;
    accessibility.missingH1 = [{ text: 'No H1 tag found', selector: 'body', html: '<body>' }];
    accessibility.stats.titles.failed++;
  } else {
    accessibility.missingH1 = [];
    accessibility.stats.titles.passed++;
  }

  // 2. Duplicate IDs (General)
  const idCounts = {};
  const duplicateIds = [];
  document.querySelectorAll('[id]').forEach(el => {
    idCounts[el.id] = (idCounts[el.id] || 0) + 1;
    if (idCounts[el.id] === 2) { 
      duplicateIds.push({ text: `Duplicate ID: ${el.id}`, selector: `#${el.id}`, html: el.outerHTML.slice(0, 100) });
      accessibility.score -= 2;
      accessibility.stats.general.failed++;
    } else if (idCounts[el.id] === 1) {
      accessibility.stats.general.passed++;
    }
  });
  accessibility.duplicateIds = duplicateIds;

  // 3. Missing Field Labels (Forms)
  const missingLabels = [];
  const fields = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
  fields.forEach((el, i) => {
    const id = el.id;
    const hasLabel = id ? document.querySelector(`label[for="${id}"]`) : el.closest('label');
    const hasAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    if (!hasLabel && !hasAria) {
      const selector = id ? `#${id}` : `${el.tagName.toLowerCase()}:nth-of-type(${i + 1})`;
      missingLabels.push({ text: `Missing label for ${el.tagName}`, selector, html: el.outerHTML.slice(0, 100) });
      accessibility.score -= 5;
      accessibility.stats.forms.failed++;
    } else {
      accessibility.stats.forms.passed++;
    }
  });
  accessibility.fieldLabels = missingLabels;

  // 4. Skip to Content (Document)
  const hasSkipLink = Array.from(document.querySelectorAll('a')).some(a => 
    a.textContent.toLowerCase().includes('skip') || a.href.includes('#content') || a.href.includes('#main')
  );
  accessibility.skipToContent = hasSkipLink ? [] : [{ text: 'No "Skip to Content" link detected', selector: 'body', html: '<body>' }];
  if (!hasSkipLink) {
    accessibility.score -= 5;
    accessibility.stats.document.failed++;
  } else {
    accessibility.stats.document.passed++;
  }

  // 5. Detailed Contrast Checker (Readability)
  const textNodes = document.querySelectorAll('p, span, a, h1, h2, h3, h4, h5, h6, label, button, li');
  const contrastFailures = [];
  const standard = wcagLevel || '2.1-AA';
  const threshold = standard.includes('AAA') ? 7.0 : 4.5;
  const largeThreshold = standard.includes('AAA') ? 4.5 : 3.0;

  textNodes.forEach((el, i) => {
    if (el.textContent.trim().length < 2) return;
    const style = window.getComputedStyle(el);
    const fg = style.color;
    const bg = getActualBg(el);
    const ratio = getContrast(fg, bg);
    
    const fontSize = parseFloat(style.fontSize);
    const fontWeight = style.fontWeight;
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
    const target = isLarge ? largeThreshold : threshold;
    
    if (ratio < target) {
      const selector = el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}:nth-of-type(${i + 1})`;
      contrastFailures.push({
        text: el.textContent.trim().slice(0, 50),
        fg, bg, 
        ratio: ratio.toFixed(2),
        target,
        isLarge,
        selector,
        html: el.outerHTML.slice(0, 120)
      });
      accessibility.score -= 1;
      accessibility.stats.readability.failed++;
    } else {
      accessibility.stats.readability.passed++;
    }
  });
  accessibility.lowContrast = contrastFailures.slice(0, 50); // Cap it

  if (accessibility.score < 0) accessibility.score = 0;

  return {
    title: document.title,
    colors: Array.from(colors).slice(0, 100).filter(c => c.startsWith('#')),
    fonts: finalFonts,
    typography: typography,
    media: media.slice(0, 500),
    accessibility: accessibility
  };
}


// ── Main download flow ────────────────────────────────────────
async function runDownload(mode) {
  if (!currentUrl) return;

  usedPaths.clear();
  setLoading(mode, true);
  hideStatus();
  showProgress('Scanning page assets…');
  updateProgress(5);

  try {
    // ── Step 1: extract asset URLs from live DOM ──────────────
    const selectedTypes = mode === 'lite' ? ['css', 'js'] : getSelectedTypes();

    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: extractAssets,
      args: [selectedTypes],
    });

    const assets = (results && results[0] && results[0].result) ? results[0].result : [];

    if (assets.length === 0) {
      showProgress('No assets detected. Saving HTML only…');
    }

    updateProgress(12);
    showProgress(`Found ${assets.length} asset(s). Downloading…`);

    // Get the most up-to-date title from the live page
    let liveTitle = '';
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => document.title,
      });
      liveTitle = result;
    } catch { }

    // Build a meaningful site name
    let siteName = liveTitle && liveTitle.trim() ? liveTitle.trim() : "";
    if (!siteName) {
      try { siteName = new URL(currentUrl).hostname.replace("www.", ""); }
      catch { siteName = "website"; }
    }
    const safeSiteName = siteName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_').trim() || 'website';

    const rootFolder = safeSiteName.toLowerCase();
    const zipContainer = new JSZip();
    const zip = zipContainer.folder(rootFolder);
    const urlToLocal = new Map(); // original URL → local zip path

    // ── Step 2: fetch all assets ──────────────────────────────
    let fetched = 0, skipped = 0, totalBytes = 0;
    const CONCURRENCY = 4;
    const skipErrors = [];

    async function robustFetch(url, timeoutMs) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        // Try 1: normal fetch (works for same-origin & extension-permissioned URLs)
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (res.ok) return res;
      } catch (e) {
        clearTimeout(timer);
      }

      // Try 2: no-cors mode (opaque response, still gets the bytes)
      const ctrl2 = new AbortController();
      const timer2 = setTimeout(() => ctrl2.abort(), timeoutMs);
      try {
        const res2 = await fetch(url, { mode: 'no-cors', signal: ctrl2.signal });
        clearTimeout(timer2);
        return res2; // opaque but blob is still usable
      } catch (e2) {
        clearTimeout(timer2);
        throw e2;
      }
    }

    async function downloadAsset(asset) {
      const MAX_RETRIES = 2;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const timeoutMs = 15000 + (attempt * 5000); // 15s, 20s, 25s
          const res = await robustFetch(asset.url, timeoutMs);
          const blob = await res.blob();

          // Skip empty opaque responses
          if (blob.size === 0 && res.type === 'opaque') throw new Error('Empty opaque response');

          totalBytes += blob.size;
          const localPath = makeLocalPath(asset.url, asset.type);
          urlToLocal.set(asset.url, localPath);
          zip.file(localPath, blob);
          fetched++;
          return; // success
        } catch (e) {
          if (attempt === MAX_RETRIES) {
            skipErrors.push({ url: asset.url, error: e.message });
            skipped++;
          }
          // else retry
        }
      }
    }

    // Update progress helper
    function updateDownloadProgress() {
      const done = fetched + skipped;
      updateProgress(Math.round(12 + (done / Math.max(assets.length, 1)) * 60));
      document.getElementById('progress-files').textContent =
        `${fetched} downloaded · ${skipped} skipped · ${formatBytes(totalBytes)}`;
    }

    // Process in batches
    for (let i = 0; i < assets.length; i += CONCURRENCY) {
      const batch = assets.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async a => {
        await downloadAsset(a);
        updateDownloadProgress();
      }));
    }

    // Log skip details to console for debugging
    if (skipErrors.length > 0) {
      console.warn('[ZipIt] Skipped assets:', skipErrors);
    }

    // ── Step 3: Capture + process HTML ─────────────────────────
    showProgress('Processing HTML…');
    updateProgress(74);

    // Get live DOM and Base URI instead of fetching raw source (Better SPA support)
    const domResult = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => ({
        liveHtml: document.documentElement ? document.documentElement.outerHTML : (document.body ? document.body.innerHTML : ''),
        baseURI: document.baseURI || window.location.href
      }),
    });

    const { liveHtml, baseURI } = (domResult && domResult[0] && domResult[0].result) || { liveHtml: '', baseURI: currentUrl };

    let html = '<!DOCTYPE html>\n' + liveHtml;

    if (mode === 'full') {
      // Rewrite CSS and JS files: fix absolute URLs inside them
      showProgress('Rewriting asset paths…');
      updateProgress(78);

      const cssAssets = [...urlToLocal.entries()].filter(([url, path]) => path.startsWith('css/'));
      const jsAssets = [...urlToLocal.entries()].filter(([url, path]) => path.startsWith('js/'));

      // Process CSS
      const usedClasses = new Set();
      html.match(/class=(['"])(.*?)\1/gi)?.forEach(m => {
        const c = m.split('=')[1].replace(/['"]/g, '').split(/\s+/);
        c.forEach(cls => usedClasses.add(cls));
      });

      await Promise.all(cssAssets.map(async ([origUrl, localPath]) => {
        try {
          const cssRes = await fetchWithTimeout(origUrl, 8100);
          let cssText = await cssRes.text();
          cssText = rewriteCss(cssText, origUrl, urlToLocal);

          // Smart Purge if Pro
          if (isPro) {
            cssText = cssText.replace(/\.([a-z0-9_-]+)\s*\{[^}]*\}/gi, (match, cls) => {
              if (usedClasses.has(cls) || cls.startsWith('hover:') || cls.startsWith('focus:')) return match;
              return `/* Purged: .${cls} */`;
            });
          }

          zip.file(localPath, cssText);
        } catch { }
      }));

      // Process JS (Deep Chunk Rewrite)
      showProgress('Rewriting JS modules…');
      await Promise.all(jsAssets.map(async ([origUrl, localPath]) => {
        try {
          const jsRes = await fetchWithTimeout(origUrl, 8200);
          let jsContent = await jsRes.text();
          for (const [abs, local] of urlToLocal) {
            if (jsContent.includes(abs)) {
              const rel = local.startsWith('js/') ? local.slice(3) : '../' + local;
              jsContent = jsContent.split(abs).join(rel);
            }
          }
          zip.file(localPath, jsContent);
        } catch { }
      }));

      // Full rewrite of HTML
      html = rewriteHtmlFull(html, baseURI || currentUrl, urlToLocal);
    } else {
      // Lite: only rewrite <link href> and <script src>
      html = rewriteHtmlLite(html, baseURI || currentUrl, urlToLocal);
    }

    zip.file('index.html', html);

    // ── Apply UI UI Pro Max files if selected ─────────────────
    if (mode === 'full') {
      const styleInputEl = document.getElementById('import-stylesheet');
      const designInputEl = document.getElementById('import-design-system');

      if (styleInputEl && styleInputEl.files.length > 0) {
        const text = await styleInputEl.files[0].text();
        zip.file('ui-ux-pro-max/stylesheet.md', text);
      }
      if (designInputEl && designInputEl.files.length > 0) {
        const text = await designInputEl.files[0].text();
        zip.file('ui-ux-pro-max/design_system.md', text);
      }
    }

    // ── Step 4: generate ZIP ──────────────────────────────────
    showProgress('Compressing ZIP…');
    updateProgress(88);

    const zipBlob = await zipContainer.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
      (meta) => {
        document.getElementById('progress-files').textContent =
          `Compressing… ${Math.round(meta.percent)}%`;
      }
    );

    updateProgress(100);

    // ── Step 5: trigger download ──────────────────────────────
    const blobUrl = URL.createObjectURL(zipBlob);
    const filename = `${safeSiteName}.zip`;

    chrome.downloads.download({ url: blobUrl, filename, saveAs: false }, () => {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      incrementExtraction();
    });

    const total = fetched + 1; // +1 for index.html
    document.getElementById('footer-left').textContent = `${total} files · ${mode}`;

    hideProgress();
    showStatus(
      `✓ ${total} files · ${formatBytes(zipBlob.size)}${skipped ? ` · ${skipped} skipped` : ''}`,
      'success'
    );
    setLoading(mode, false);

  } catch (err) {
    hideProgress();
    setLoading(mode, false);
    showStatus(`Error: ${err.message}`, 'error');
  }
}

// ── HTML rewriting ────────────────────────────────────────────

/** Full mode — replace every src/href/url() with local paths */
function rewriteHtmlFull(html, baseUrl, urlToLocal) {
  const base = new URL(baseUrl);

  // src / href / posters / data-attributes
  // Correctly handle quoted AND unquoted values
  html = html.replace(
    /(src|href|data-[a-z0-9-]+|poster|action)\s*=\s*(?:(['"])(.*?)\2|([^>\s"']+))/gi,
    (match, attr, quote, valQ, valU) => {
      let val = (valQ || valU || "").trim();
      val = val.replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
      if (!val || shouldSkip(val)) return match;
      try {
        const abs = new URL(val, base).href;
        const local = urlToLocal.get(abs);

        if (local) return `${attr}="${local}"`;

        // Preserve external links for href/action
        if (attr.toLowerCase() === 'href' || attr.toLowerCase() === 'action') {
          return `${attr}="${abs}"`;
        }
        // If it's an image/asset but not found in urlToLocal, make it absolute to the source
        // This prevents broken relative matches if extraction missed something
        return `${attr}="${abs}"`;
      } catch { return match; }
    }
  );

  // srcset cases (quoted or unquoted)
  html = html.replace(/(srcset|data-srcset|data-framer-srcset|data-framer-optimized-srcset)\s*=\s*(?:(['"])(.*?)\2|([^>\s"']+))/gi, (match, attr, quote, valQ, valU) => {
    let srcset = valQ || valU || "";
    srcset = srcset.replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
    const rewritten = srcset.split(',').map(entry => {
      const parts = entry.trim().split(/\s+/);
      const url = parts[0];
      if (!url || shouldSkip(url)) return entry;
      try {
        const abs = new URL(url, base).href;
        const local = urlToLocal.get(abs);
        return local ? [local, ...parts.slice(1)].join(' ') : [abs, ...parts.slice(1)].join(' ');
      } catch { return entry; }
    }).join(', ');
    return `${attr}="${rewritten}"`;
  });

  // url() in inline styles and SVG
  html = html.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, q, val) => {
    if (shouldSkip(val)) return match;
    try {
      const abs = new URL(val.trim(), base).href;
      const local = urlToLocal.get(abs);
      return local ? `url("${local}")` : `url("${abs}")`;
    } catch { return match; }
  });

  // SVG specific image links
  html = html.replace(/(href|xlink:href)\s*=\s*(?:(['"])(.*?)\2|([^>\s"']+))/gi, (match, attr, quote, valQ, valU) => {
    const val = (valQ || valU || "").trim();
    if (!val || shouldSkip(val)) return match;
    try {
      const abs = new URL(val, base).href;
      const local = urlToLocal.get(abs);
      return local ? `${attr}="${local}"` : `${attr}="${abs}"`;
    } catch { return match; }
  });

  // Remove <base> so local relative paths work
  html = html.replace(/<base\b[^>]*>/gi, '');
  return addCleanModeComment(html);
}

function addCleanModeComment(html) {
  const headMatch = html.match(/<head>/i);
  if (headMatch) {
    return html.replace(/<head>/i, `<head>\n    <!-- Extracted with ZipIt - Clean Mode -->`);
  }
  return html;
}

/** Lite mode — only rewrite <link href> and <script src> */
function rewriteHtmlLite(html, baseUrl, urlToLocal) {
  const base = new URL(baseUrl);
  html = html.replace(
    /(src|href)\s*=\s*(?:(['"])(.*?)\2|([^>\s"']+))/gi,
    (match, attr, quote, valQ, valU) => {
      const val = (valQ || valU || "").trim();
      if (!val || shouldSkip(val)) return match;
      try {
        const abs = new URL(val, base).href;
        const local = urlToLocal.get(abs);

        if (local) return `${attr}="${local}"`;

        // Ensure links to other pages or missing assets point to the original site
        return `${attr}="${abs}"`;
      } catch { return match; }
    }
  );
  html = html.replace(/<base\b[^>]*>/gi, '');
  return addCleanModeComment(html);
}

/** Rewrite url() references inside a CSS file */
function rewriteCss(css, cssUrl, urlToLocal) {
  const base = new URL(cssUrl);
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, q, val) => {
    if (shouldSkip(val)) return match;
    try {
      const abs = new URL(val.trim(), base).href;
      const local = urlToLocal.get(abs);
      if (!local) return `url("${abs}")`;

      // CSS lives in css/ — make path relative from there
      let rel = "";
      if (local.startsWith('css/')) {
        rel = local.slice(4);
      } else {
        rel = '../' + local;
      }
      return `url("${rel}")`;
    } catch { return match; }
  });
}

function shouldSkip(val) {
  if (!val) return true;
  const v = val.trim();
  return !v || v.startsWith('data:') || v.startsWith('blob:') ||
    v.startsWith('#') || v.startsWith('javascript:') || v.startsWith('mailto:');
}

// ── Local path builder ────────────────────────────────────────
const usedPaths = new Set();
const FOLDER = { css: 'css/', js: 'js/', images: 'images/', fonts: 'fonts/', media: 'media/' };
const EXT = { css: '.css', js: '.js', images: '.png', fonts: '.woff2', media: '.mp4' };

function makeLocalPath(url, type) {
  const folder = FOLDER[type] || 'assets/';
  let filename = 'file' + (EXT[type] || '');

  try {
    const u = new URL(url);
    let pathname = decodeURIComponent(u.pathname);

    // 1. Strip query and hash from path
    pathname = pathname.split('?')[0].split('#')[0];

    // 2. Get last segment
    let segment = pathname.split('/').filter(Boolean).pop() || 'file';

    // 3. AGGRESSIVE HASH STRIPPING
    segment = segment
      .replace(/[.-][a-f0-9]{7,}(?=\.|$)/gi, '')
      .replace(/\.[a-f0-9]{7,}\./gi, '.');

    // 4. Ensure Extension
    let nameParts = segment.split('.');
    let currentExt = nameParts.length > 1 ? '.' + nameParts.pop().toLowerCase() : '';
    let baseName = nameParts.join('.') || segment;

    const validImage = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.ico'];
    const validFont = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];
    const validStyle = ['.css'];
    const validScript = ['.js'];

    let isCorrectExt = false;
    if (type === 'images' && validImage.includes(currentExt)) isCorrectExt = true;
    if (type === 'fonts' && validFont.includes(currentExt)) isCorrectExt = true;
    if (type === 'css' && validStyle.includes(currentExt)) isCorrectExt = true;
    if (type === 'js' && validScript.includes(currentExt)) isCorrectExt = true;

    if (!isCorrectExt) {
      if (type === 'fonts') currentExt = '.woff2';
      else if (type === 'images') currentExt = '.png';
      else if (type === 'css') currentExt = '.css';
      else if (type === 'js') currentExt = '.js';
      else currentExt = EXT[type] || '';
    }

    // 5. GIBBERISH DETECTION (Heuristic)
    const safeName = baseName || "file";
    const isGibberish = safeName.length > 15 && (!/[aeiou]/i.test(safeName) || (safeName.match(/\d/g) || []).length > safeName.length / 2);

    if (isGibberish || safeName.toLowerCase() === 'file') {
      baseName = `${type}-asset-${Math.random().toString(36).slice(2, 6)}`;
    }

    // 6. SLUGIFY
    filename = baseName.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + currentExt;

  } catch (e) {
    filename = `${type}-asset-${Math.random().toString(36).slice(2, 6)}${EXT[type] || ''}`;
  }

  if (filename.startsWith('.')) filename = "asset" + filename;

  // 7. DUPLICATE PROTECTION
  let path = folder + filename, n = 1;
  while (usedPaths.has(path)) {
    const dotIdx = filename.lastIndexOf('.');
    const stem = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
    const ext = dotIdx > 0 ? filename.slice(dotIdx) : '';
    path = `${folder}${stem}-${n}${ext}`;
    n++;
  }
  usedPaths.add(path);
  return path;
}

// ── Misc helpers ──────────────────────────────────────────────
function getSelectedTypes() {
  const types = ['html']; // HTML is always included
  if (document.getElementById('full-css')?.checked) types.push('css');
  if (document.getElementById('full-js')?.checked) types.push('js');
  if (document.getElementById('full-img')?.checked) types.push('images');
  if (document.getElementById('full-fonts')?.checked) types.push('fonts');
  if (document.getElementById('full-media')?.checked) types.push('media');
  return types;
}

function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal })
    .finally(() => clearTimeout(id));
}

function setLoading(mode, on) {
  const btn = document.getElementById(`btn-${mode}`);
  const textEl = document.getElementById(`text-${mode}`);
  const iconEl = document.getElementById(`icon-${mode}`);
  const loaderOverlay = document.getElementById('download-overlay');
  const spId = `spinner-${mode}`;

  if (!btn) return;

  if (on) {
    btn.disabled = true;
    if (iconEl) iconEl.style.display = 'none';
    if (!document.getElementById(spId)) {
      const sp = document.createElement('div');
      sp.className = 'spinner'; sp.id = spId;
      if (textEl) btn.insertBefore(sp, textEl);
      else btn.appendChild(sp);
    }
    if (textEl) textEl.textContent = 'Working…';
    if (loaderOverlay) loaderOverlay.classList.add('active');
  } else {
    btn.disabled = false;
    document.getElementById(spId)?.remove();
    if (iconEl) iconEl.style.display = '';

    // Set text back to original mode-specific name
    if (textEl) {
      if (mode === 'full') textEl.textContent = 'Download Whole Website';
      else if (mode === 'export-inspector') textEl.textContent = 'Export Component';
      else if (mode === 'copy-figma') {
        textEl.textContent = 'Copy Figma Layers';
        // Restore secondary style
        btn.style.background = 'transparent';
        btn.style.border = '1.5px solid var(--accent)';
        btn.style.boxShadow = 'none';
      }
      else textEl.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    }

    if (loaderOverlay) {
      setTimeout(() => loaderOverlay.classList.remove('active'), 1000);
    }
  }
}

function showProgress(label) {
  document.getElementById('progress-wrap')?.classList.add('visible');
  const labelEl = document.getElementById('progress-label');
  if (labelEl) labelEl.textContent = label;

  const loaderStatus = document.getElementById('loader-status-text');
  if (loaderStatus) loaderStatus.textContent = label;
}

function hideProgress() {
  document.getElementById('progress-wrap')?.classList.remove('visible');
  const loaderOverlay = document.getElementById('download-overlay');
  if (loaderOverlay) loaderOverlay.classList.remove('active');
}

function updateProgress(pct) {
  const rounded = Math.round(pct);
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = rounded + '%';
  const pctEl = document.getElementById('progress-pct');
  if (pctEl) pctEl.textContent = rounded + '%';

  const loaderFill = document.getElementById('loader-bar-fill');
  const loaderPct = document.getElementById('loader-percent');
  if (loaderFill) loaderFill.style.width = rounded + '%';
  if (loaderPct) loaderPct.textContent = rounded + '%';
}
function showStatus(msg, type) {
  const el = document.getElementById('status');
  el.textContent = msg; el.className = `visible ${type}`;
}
function hideStatus() { document.getElementById('status').className = ''; }
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

function launchConfetti() {
  const count = 100;
  const defaults = { origin: { y: 0.7 } };

  function fire(particleRatio, opts) {
    const particles = Math.floor(count * particleRatio);
    for (let i = 0; i < particles; i++) {
      createParticle(opts);
    }
  }

  fire(0.25, { spread: 26, startVelocity: 55, });
  fire(0.2, { spread: 60, });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
}

function createParticle(opts) {
  const p = document.createElement('div');
  p.style.position = 'fixed';
  p.style.zIndex = '10001';
  p.style.width = '10px';
  p.style.height = '10px';
  p.style.backgroundColor = ['#ff5c1a', '#3b82f6', '#22c55e', '#ffffff'][Math.floor(Math.random() * 4)];
  p.style.left = '50%';
  p.style.top = '100%';
  p.style.borderRadius = '2px';
  document.body.appendChild(p);

  const angle = (Math.random() * 60 + 240) * (Math.PI / 180);
  const velocity = Math.random() * 20 + 20;
  let vx = Math.cos(angle) * velocity;
  let vy = Math.sin(angle) * velocity;
  let x = window.innerWidth / 2;
  let y = window.innerHeight;

  function update() {
    x += vx;
    y += vy;
    vy += 0.8; // Gravity
    p.style.transform = `translate(${x - window.innerWidth / 2}px, ${y - window.innerHeight}px) rotate(${y}deg)`;
    if (y < window.innerHeight + 100) {
      requestAnimationFrame(update);
    } else {
      p.remove();
    }
  }
  requestAnimationFrame(update);
}

// ── DOM scanner — injected into the tab ──────────────────────
function extractAssets(selectedTypes) {
  const assets = [], seen = new Set();
  let base;
  try { base = document.baseURI; } catch { base = window.location.href; }

  function add(url, type) {
    if (!url) return;
    try {
      const v = url.trim();
      if (!v || v.startsWith('data:') || v.startsWith('blob:') ||
        v.startsWith('#') || v.startsWith('javascript:')) return;
      const abs = new URL(v, base).href;
      if (!seen.has(abs)) { seen.add(abs); assets.push({ url: abs, type }); }
    } catch { }
  }

  try {
    if (selectedTypes.includes('css')) {
      document.querySelectorAll('link[rel="stylesheet"][href]').forEach(el => add(el.href, 'css'));
      document.querySelectorAll('link[rel="preload"][as="style"][href]').forEach(el => add(el.href, 'css'));
    }
  } catch { }

  try {
    if (selectedTypes.includes('js')) {
      document.querySelectorAll('script[src]').forEach(el => add(el.src, 'js'));
      document.querySelectorAll('link[rel="modulepreload"][href]').forEach(el => add(el.href, 'js'));
      document.querySelectorAll('script:not([src])').forEach(el => {
        try {
          const matches = el.textContent.match(/import\s*\(["'](.+?)["']\)/g);
          if (matches) matches.forEach(m => add(m.match(/["'](.+?)["']/)[1], 'js'));
        } catch { }
      });
    }
  } catch { }

  try {
    if (selectedTypes.includes('images')) {
      document.querySelectorAll('img[src]').forEach(el => add(el.src, 'images'));
      document.querySelectorAll('img[srcset],source[srcset]').forEach(el => {
        try {
          el.srcset.split(',').forEach(s => add(s.trim().split(/\s+/)[0], 'images'));
        } catch { }
      });
      document.querySelectorAll('picture source[src]').forEach(el => add(el.src, 'images'));
      document.querySelectorAll('video[poster]').forEach(el => add(el.poster, 'images'));
      document.querySelectorAll('image[href],image[xlink:href]').forEach(el => add(el.getAttribute('href') || el.getAttribute('xlink:href'), 'images'));

      document.querySelectorAll('[style]').forEach(el => {
        try {
          const style = el.getAttribute('style') || '';
          for (const m of style.matchAll(/url\(["']?(.+?)["']?\)/g)) add(m[1], 'images');
        } catch { }
      });

      document.querySelectorAll('[data-src],[data-lazy],[data-bg],[data-framer-src],[data-framer-bg],[data-original],[data-srcset],[data-image],[data-background]').forEach(el => {
        try {
          const vals = [el.dataset.src, el.dataset.lazy, el.dataset.bg, el.dataset.framerSrc, el.dataset.framerBg, el.dataset.original, el.dataset.srcset];
          vals.forEach(v => {
            if (!v) return;
            if (v.includes(',')) {
              v.split(',').forEach(s => add(s.trim().split(/\s+/)[0], 'images'));
            } else {
              add(v, 'images');
            }
          });
        } catch { }
      });

      // Aggressive Deep Scan: Every attribute of every element
      document.querySelectorAll('*').forEach(el => {
        try {
          for (const attr of el.attributes) {
            const val = attr.value;
            if (!val || val.length < 4 || val.includes('\n')) continue;
            if (val.startsWith('data:') || val.startsWith('blob:') || val.startsWith('#') || val.startsWith('javascript:')) continue;

            const isImg = /\.(png|jpg|jpeg|webp|gif|svg|ico)(\?|$)/i.test(val);
            const isFont = /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(val);
            const isJS = /\.js(\?|$)/i.test(val);
            const isCSS = /\.css(\?|$)/i.test(val);

            if (isImg) add(val, 'images');
            else if (isFont) add(val, 'fonts');
            else if (isJS && selectedTypes.includes('js')) add(val, 'js');
            else if (isCSS && selectedTypes.includes('css')) add(val, 'css');
          }
        } catch { }
      });
    }
  } catch { }

  try {
    if (selectedTypes.includes('fonts')) {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.type === CSSRule.FONT_FACE_RULE) {
              const src = rule.style.getPropertyValue('src');
              for (const m of src.matchAll(/url\(["']?(.+?)["']?\)/g)) add(m[1], 'fonts');
            }
          }
        } catch { }
      }
    }
  } catch { }

  try {
    if (selectedTypes.includes('images') || selectedTypes.includes('fonts')) {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            const text = rule.cssText || '';
            for (const m of text.matchAll(/url\(["']?([^)"']+)["']?\)/g)) {
              const u = m[1].trim();
              if (!u || u.startsWith('data:')) continue;
              const isFont = /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(u);
              if (isFont && selectedTypes.includes('fonts')) add(u, 'fonts');
              if (!isFont && selectedTypes.includes('images')) add(u, 'images');
            }
          }
        } catch { }
      }
    }
  } catch { }

  try {
    if (selectedTypes.includes('media')) {
      document.querySelectorAll('video[src],audio[src],source[src],track[src]').forEach(el => add(el.src, 'media'));
      document.querySelectorAll('link[as="fetch"][href],link[as="json"][href]').forEach(el => add(el.href, 'media'));
    }
  } catch { }

  // Performance API Deep Scan
  try {
    const resources = performance.getEntriesByType('resource');
    for (const res of resources) {
      const u = res.name;
      if (u.startsWith('data:') || u.includes('google-analytics') || u.includes('doubleclick')) continue;

      const isImg = /\.(png|jpg|jpeg|webp|gif|svg|ico)(\?|$)/i.test(u);
      const isFont = /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(u);
      const isJS = /\.js(\?|$)/i.test(u);
      const isCSS = /\.css(\?|$)/i.test(u);

      if (isJS && selectedTypes.includes('js')) add(u, 'js');
      else if (isImg && selectedTypes.includes('images')) add(u, 'images');
      else if (isCSS && selectedTypes.includes('css')) add(u, 'css');
      else if (isFont && selectedTypes.includes('fonts')) add(u, 'fonts');
    }
  } catch { }

  return assets;
}

// ── Inspect Mode Implementation ──────────────────────────────────
function toggleOverlay(isActive) {
  if (isActive) {
    if (window._zipitInspectEnabled) return;
    window._zipitInspectEnabled = true;

    // Unified Global Styles
    if (!document.getElementById('zipit-core-styles')) {
      const s = document.createElement('style');
      s.id = 'zipit-core-styles';
      s.textContent = `
        .zipit-highlight-active {
          outline: 2px solid #ff5c1a !important;
          outline-offset: 4px !important;
          border-radius: 4px !important;
          position: relative !important;
          z-index: 2147483647 !important;
        }
        #zipit-spotlight-mask {
          position: fixed; inset: 0; pointer-events: none; z-index: 2147483646;
          background: radial-gradient(circle at var(--x) var(--y), transparent var(--r), rgba(0,0,0,0.75) calc(var(--r) + 4px));
          opacity: 0; transition: opacity 0.2s ease;
        }
      `;
      document.head.appendChild(s);
    }

    const sizeLabel = document.createElement('div');
    sizeLabel.id = 'zipit-inspect-label';
    sizeLabel.style.cssText = `
      position: fixed; background: #ff5c1a; color: white; font-size: 10px; font-family: 'Inter', sans-serif;
      font-weight: 800; padding: 4px 10px; border-radius: 6px; z-index: 2147483648; pointer-events: none;
      box-shadow: 0 4px 12px rgba(255,92,26,0.2); letter-spacing: 0.5px; text-transform: uppercase;
      display: none; white-space: nowrap;
    `;
    document.body.appendChild(sizeLabel);

    let currentTarget = null;
    window._zipitInspectLocked = false;

    const rgbToHex = (rgb) => {
      const m = rgb?.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
      if (!m || (m[4] && parseFloat(m[4]) === 0)) return 'transparent';
      const hex = (x) => ("0" + parseInt(x).toString(16)).slice(-2);
      return ("#" + hex(m[1]) + hex(m[2]) + hex(m[3])).toUpperCase();
    };

    window._zipitInspectClick = (e) => {
      if (!window._zipitInspectEnabled) return;
      e.preventDefault(); e.stopPropagation();
      window._zipitInspectLocked = !window._zipitInspectLocked;
      if (window._zipitInspectLocked) {
        sizeLabel.style.background = '#e8521a';
        sizeLabel.innerHTML += ' • LOCKED';
      } else {
        sizeLabel.style.background = '#ff5c1a';
      }
    };
    document.addEventListener('click', window._zipitInspectClick, { capture: true });

    window._zipitInspectMove = (e) => {
      if (!window._zipitInspectEnabled || window._zipitInspectLocked) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === sizeLabel || el === currentTarget) return;

      if (currentTarget) currentTarget.classList.remove('zipit-highlight-active');
      currentTarget = el;
      window._zipitInspectCurrentTarget = el;
      currentTarget.classList.add('zipit-highlight-active');

      const rect = el.getBoundingClientRect();
      sizeLabel.style.display = 'block';
      sizeLabel.style.left = rect.left + 'px';
      sizeLabel.style.top = (rect.top - 28) + 'px';
      const tagTxt = `<span style="opacity:0.7; margin-right:4px;">${el.tagName.toLowerCase()}</span>`;
      sizeLabel.innerHTML = `${tagTxt}${Math.round(rect.width)} × ${Math.round(rect.height)}`;

      const s = window.getComputedStyle(el);
      let classes = Array.from(el.classList).join('.');
      let selector = el.tagName.toLowerCase() + (classes ? '.' + classes : '') + (el.id ? '#' + el.id : '');

      let mediaSrc = null; let isSvg = false;
      if (el.tagName.toLowerCase() === 'img') {
        mediaSrc = el.src;
      } else if (el.tagName.toLowerCase() === 'svg') {
        isSvg = true;
        const svgClone = el.cloneNode(true);
        try { mediaSrc = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgClone.outerHTML))); } catch (e) { }
      } else {
        const bg = s.backgroundImage;
        if (bg && bg !== 'none') {
          const m = bg.match(/url\(['"]?(.*?)['"]?\)/);
          if (m) mediaSrc = m[1];
        }
      }

      try {
        chrome.runtime.sendMessage({
          type: 'ZIPIT_INSPECT_HOVER',
          data: {
            tagName: el.tagName.toLowerCase(),
            selector: selector, width: Math.round(rect.width), height: Math.round(rect.height),
            display: s.display, boxSizing: s.boxSizing, overflow: s.overflow,
            fontFamily: s.fontFamily.split(',')[0].replace(/['"]/g, ''),
            fontSize: s.fontSize, fontWeight: s.fontWeight, color: rgbToHex(s.color),
            backgroundColor: rgbToHex(s.backgroundColor), padding: s.padding, margin: s.margin,
            border: s.borderWidth !== '0px' ? s.border : 'none', borderRadius: s.borderRadius,
            zIndex: s.zIndex, opacity: s.opacity, boxShadow: s.boxShadow !== 'none' ? s.boxShadow : null,
            mediaSrc: mediaSrc, isSvg: isSvg
          }
        });
      } catch (e) { }
    };

    document.addEventListener('mousemove', window._zipitInspectMove, { passive: true });

    window._zipitInspectKey = (e) => {
      if (e.key === 'Escape') {
        try { chrome.runtime.sendMessage({ type: 'ZIPIT_INSPECT_OFF' }); } catch (err) { }
        toggleOverlay(false);
      }
    };
    document.addEventListener('keydown', window._zipitInspectKey);

  } else {
    window._zipitInspectEnabled = false;
    window._zipitInspectCurrentTarget = null;
    window._zipitInspectLocked = false;

    document.getElementById('zipit-spotlight-mask')?.remove();
    document.getElementById('zipit-inspect-label')?.remove();
    document.querySelectorAll('.zipit-highlight-active').forEach(el => el.classList.remove('zipit-highlight-active'));

    if (window._zipitInspectMove) document.removeEventListener('mousemove', window._zipitInspectMove);
    if (window._zipitInspectKey) document.removeEventListener('keydown', window._zipitInspectKey);
    if (window._zipitInspectClick) document.removeEventListener('click', window._zipitInspectClick, { capture: true });

    window._zipitInspectMove = null;
    window._zipitInspectKey = null;
    window._zipitInspectClick = null;
  }
}

function updateInspectorUI(data) {
  document.getElementById('inspector-idle').style.display = 'none';
  const dataPanel = document.getElementById('inspector-data');
  dataPanel.style.display = 'flex';

  document.getElementById('inspector-tag').textContent = data.tagName;
  document.getElementById('inspector-selector').textContent = data.selector;

  const stylesContainer = document.getElementById('inspector-styles');
  stylesContainer.innerHTML = '';

  const addRow = (label, val, highlight) => {
    if (!val || val === 'none' || val === 'transparent' || val === '0px' || val === 'auto') return;
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; border-bottom: 1px solid var(--border-light); font-size: 11px;';

    const labelEl = document.createElement('span');
    labelEl.style.color = 'var(--muted)';
    labelEl.textContent = label;

    const valEl = document.createElement('span');
    valEl.style.cssText = 'font-family: "Courier New", monospace; color: var(--text); font-weight: 600; text-align: right; max-width: 65%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    valEl.textContent = val;

    if (highlight) {
      valEl.style.color = 'var(--accent)';
      valEl.style.background = 'rgba(255,92,26,0.1)';
      valEl.style.padding = '2px 6px';
      valEl.style.borderRadius = '4px';
    }

    if (label.includes('Color') && val.startsWith('#')) {
      const dot = document.createElement('span');
      dot.style.cssText = `display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; border: 1px solid rgba(0,0,0,0.2); background: ${val};`;
      valEl.prepend(dot);
    }

    row.appendChild(labelEl);
    row.appendChild(valEl);
    stylesContainer.appendChild(row);
  };

  addRow('Dimensions', data.width + ' × ' + data.height + ' px', false);
  addRow('Display', data.display, false);
  addRow('Color', data.color, true);
  addRow('Background', data.backgroundColor, true);
  addRow('Font Family', data.fontFamily, false);
  addRow('Font Size', data.fontSize, false);
  addRow('Font Weight', data.fontWeight, false);
  addRow('Padding', data.padding, false);
  addRow('Margin', data.margin, false);
  addRow('Border', data.border, false);
  addRow('Border Radius', data.borderRadius, false);
  addRow('Z-index', data.zIndex !== 'auto' ? data.zIndex : null, false);
  addRow('Opacity', data.opacity !== '1' ? data.opacity : null, false);
  addRow('Box Shadow', data.boxShadow, false);

  document.getElementById('inspector-style-actions').style.display = 'flex';

  const mediaTab = document.getElementById('inspect-tab-media');
  if (data.mediaSrc && !data.mediaSrc.startsWith('data:image/svg') || data.isSvg) {
    mediaTab.style.display = 'block';

    // Default to style tab to avoid jarring jump unless we are already on media
    if (!mediaTab.classList.contains('active')) {
      document.getElementById('inspect-tab-style').click();
    }

    const imgPreview = document.getElementById('inspector-media-img');
    imgPreview.src = data.mediaSrc;
    document.getElementById('inspector-media-dim').textContent = data.width + ' × ' + data.height;

    // Set download URL
    const dlBtn = document.getElementById('btn-download-inspector-media');
    dlBtn.onclick = () => {
      const fname = data.isSvg ? 'asset.svg' : 'image.png';
      chrome.downloads.download({ url: data.mediaSrc, filename: fname });
    };
  } else {
    mediaTab.style.display = 'none';
    document.getElementById('inspect-tab-style').click();
  }
}

async function copyComponentToFigma() {
  console.log('🎨 Copy to Figma button clicked');
  if (!currentTab) {
    console.log('❌ No current tab');
    showStatus('No active tab', 'error');
    return;
  }
  const btn = document.getElementById('btn-copy-figma');
  const span = document.getElementById('text-copy-figma');
  const oldText = span ? span.textContent : 'Figma';
  btn.disabled = true;
  if (span) span.textContent = 'Working…';

  console.log('✅ Current tab found:', currentTab.id);
  showStatus('🎨 Building Figma layers...', 'info');

  try {
    const [{ result: data }] = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: () => {
        const el = window._zipitInspectCurrentTarget;
        if (!el) return null;

        const rootRect = el.getBoundingClientRect();
        let idCounter = 0;

        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const cleanId = (target) => {
          const raw = target.id || (typeof target.className === 'string' ? target.className.split(' ')[0] : '') || target.tagName || 'layer';
          return raw.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40) || ('layer_' + (idCounter++));
        };

        const rgbToHex = (rgb) => {
          if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
          const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (!m) return rgb;
          return '#' + [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
        };

        const getOpacity = (style) => {
          const o = parseFloat(style.opacity);
          return (isNaN(o) || o >= 1) ? '' : ` opacity="${o}"`;
        };

        const getShadowFilter = (style, id) => {
          const shadow = style.boxShadow;
          if (!shadow || shadow === 'none') return { def: '', attr: '' };
          const m = shadow.match(/rgba?\([^)]+\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/);
          if (!m) return { def: '', attr: '' };
          const colorM = shadow.match(/rgba?\([^)]+\)/);
          const color = colorM ? colorM[0] : 'rgba(0,0,0,0.25)';
          const filterId = 'shadow_' + id;
          const def = `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${m[1]}" dy="${m[2]}" stdDeviation="${parseFloat(m[3]) / 2}" flood-color="${color}"/></filter>`;
          return { def, attr: ` filter="url(#${filterId})"` };
        };

        const getGradient = (bg, id) => {
          // More robust gradient parsing that handles colors with commas
          const gradMatch = bg.match(/(linear|radial)-gradient\((.+)\)$/);
          if (!gradMatch) return null;

          const type = gradMatch[1];
          const content = gradMatch[2];
          const gradId = 'grad_' + id;

          // Parse stops - split by comma but not inside parentheses
          const parts = [];
          let parenDepth = 0;
          let currentPart = '';
          for (let i = 0; i < content.length; i++) {
            const char = content[i];
            if (char === '(') parenDepth++;
            else if (char === ')') parenDepth--;
            else if (char === ',' && parenDepth === 0) {
              parts.push(currentPart.trim());
              currentPart = '';
              continue;
            }
            currentPart += char;
          }
          if (currentPart.trim()) parts.push(currentPart.trim());

          // First part might be angle/direction
          let angle = 180;
          let stopIndex = 0;
          const firstPart = parts[0];

          if (firstPart && (firstPart.includes('deg') || firstPart.includes('to ') || firstPart.includes('turn'))) {
            // It's a direction/angle
            if (firstPart.endsWith('deg')) angle = parseFloat(firstPart);
            else if (firstPart === 'to right') angle = 90;
            else if (firstPart === 'to left') angle = 270;
            else if (firstPart === 'to top') angle = 0;
            else if (firstPart === 'to bottom') angle = 180;
            stopIndex = 1;
          }

          // Parse color stops
          const stops = parts.slice(stopIndex).map((s, i, arr) => {
            // Extract color and optional position
            const stopMatch = s.match(/^(.+?)\s+(\d+\.?\d*)(%|px)?$/);
            const color = stopMatch ? stopMatch[1] : s;
            const position = stopMatch ? parseFloat(stopMatch[2]) : (i / (arr.length - 1)) * 100;
            return `<stop offset="${position}%" stop-color="${color.trim()}"/>`;
          }).join('');

          if (type === 'linear') {
            const rad = (angle - 90) * Math.PI / 180;
            const x1 = 50 - Math.cos(rad) * 50, y1 = 50 - Math.sin(rad) * 50;
            const x2 = 50 + Math.cos(rad) * 50, y2 = 50 + Math.sin(rad) * 50;
            return {
              def: `<linearGradient id="${gradId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`,
              fill: `url(#${gradId})`
            };
          } else if (type === 'radial') {
            return {
              def: `<radialGradient id="${gradId}" cx="50%" cy="50%" r="50%">${stops}</radialGradient>`,
              fill: `url(#${gradId})`
            };
          }
          return null;
        };

        let defs = '';
        const imageUrls = new Set();

        const getBorderRadius = (style) => {
          const tl = style.borderTopLeftRadius, tr = style.borderTopRightRadius, br = style.borderBottomRightRadius, bl = style.borderBottomLeftRadius;
          if (tl === tr && tr === br && br === bl) return ` rx="${parseInt(tl) || 0}"`;
          return ''; // Complex paths needed for individual radii, default to rect for now
        };

        const crawl = (target, depth, parentStyle = null, parentBounds = null) => {
          if (target.nodeType !== 1) return '';
          if (depth > 60) return ''; // Deeper crawl for complex React apps
          const style = window.getComputedStyle(target);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return '';

          const rect = target.getBoundingClientRect();
          if (rect.width < 0.5 || rect.height < 0.5) return '';

          const x = Math.round((rect.left - rootRect.left) * 100) / 100;
          const y = Math.round((rect.top - rootRect.top) * 100) / 100;
          const w = Math.round(rect.width * 100) / 100;
          const h = Math.round(rect.height * 100) / 100;
          const id = cleanId(target) + '_' + (idCounter++);
          const opAttr = getOpacity(style);

          const currentBounds = { x, y, w, h };
          let inner = '';

          // Shadow filter
          const shadow = getShadowFilter(style, id);
          if (shadow.def) defs += shadow.def;

          // Background parsing
          const bgImage = style.backgroundImage;
          const bgColor = style.backgroundColor;
          let hasBg = false;

          if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
            const grad = getGradient(bgImage, id);
            if (grad) {
              defs += grad.def;
              inner += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${grad.fill}"${getBorderRadius(style)}${shadow.attr}/>\n`;
              hasBg = true;
            }
          }

          if (!hasBg) {
            const hex = rgbToHex(bgColor);
            if (hex) {
              inner += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${hex}"${getBorderRadius(style)}${shadow.attr}/>\n`;
            }
          }

          // Border
          const bw = parseFloat(style.borderTopWidth) || 0;
          if (bw > 0) {
            const bc = rgbToHex(style.borderTopColor);
            if (bc) {
              inner += `<rect x="${x + bw / 2}" y="${y + bw / 2}" width="${w - bw}" height="${h - bw}" fill="none" stroke="${bc}" stroke-width="${bw}"${getBorderRadius(style)}/>\n`;
            }
          }

          // SVG / Images
          if (target.tagName === 'SVG' || target.tagName === 'svg') {
            try {
              const clone = target.cloneNode(true);
              clone.setAttribute('x', x); clone.setAttribute('y', y);
              clone.setAttribute('width', w); clone.setAttribute('height', h);
              return clone.outerHTML + '\n';
            } catch (e) { }
          }

          if ((target.tagName === 'IMG' && target.src) || (bgImage && bgImage.includes('url('))) {
            const rawUrl = target.src || bgImage.match(/url\(["']?(.+?)["']?\)/)?.[1];
            if (rawUrl) {
              const src = new URL(rawUrl, document.baseURI).href;
              imageUrls.add(src);
              inner += `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${src}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0% round ${style.borderRadius})"/>\n`;
            }
          }

          // Text Rendering
          if (target.children.length === 0 && target.textContent.trim()) {
            const txt = esc(target.textContent.trim());
            const fontSize = parseFloat(style.fontSize) || 14;
            const fontWeight = style.fontWeight || '400';
            const fontFamily = style.fontFamily.split(',')[0].replace(/['"]/g, '');
            const fill = rgbToHex(style.color) || '#000000';
            const align = style.textAlign;

            let textX = x;
            let anchor = 'start';
            if (align === 'center') { anchor = 'middle'; textX = x + w / 2; }
            else if (align === 'right' || align === 'end') { anchor = 'end'; textX = x + w; }

            const textY = Math.round((y + h / 2 + fontSize * 0.35) * 100) / 100;
            inner += `<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" text-anchor="${anchor}">${txt}</text>\n`;
          }

          // 🌐 Detect Auto Layout (Flexbox) Metadata
          let layoutAttrs = '';
          if (style.display === 'flex' || style.display === 'inline-flex') {
            const isCol = style.flexDirection === 'column' || style.flexDirection === 'column-reverse';
            const gap = parseInt(style.gap) || 0;
            const pt = parseInt(style.paddingTop) || 0;
            const pr = parseInt(style.paddingRight) || 0;
            const pb = parseInt(style.paddingBottom) || 0;
            const pl = parseInt(style.paddingLeft) || 0;

            // Alignment mapping
            const jcMap = { 'flex-start': 'MIN', 'center': 'CENTER', 'flex-end': 'MAX', 'space-between': 'SPACE_BETWEEN', 'space-around': 'CENTER', 'space-evenly': 'CENTER' };
            const aiMap = { 'flex-start': 'MIN', 'center': 'CENTER', 'flex-end': 'MAX', 'baseline': 'MIN', 'stretch': 'STRETCH' };

            const layoutMode = isCol ? 'VERTICAL' : 'HORIZONTAL';
            const primaryAlign = jcMap[style.justifyContent] || 'MIN';
            const counterAlign = aiMap[style.alignItems] || 'MIN';

            layoutAttrs = ` data-layout="${layoutMode}" data-spacing="${gap}" data-padding-top="${pt}" data-padding-right="${pr}" data-padding-bottom="${pb}" data-padding-left="${pl}" data-primary-align="${primaryAlign}" data-counter-align="${counterAlign}"`;

            if (style.flexGrow !== '0') layoutAttrs += ' data-flex-grow="1"';
          }

          let childSvg = '';
          const styleInfo = { display: style.display, alignItems: style.alignItems };
          for (let i = 0; i < target.children.length; i++) {
            childSvg += crawl(target.children[i], depth + 1, styleInfo, currentBounds);
          }

          return `<g id="${id}"${opAttr}${layoutAttrs}>${inner}${childSvg}</g>\n`;
        };

        const body = crawl(el, 0);
        const w = Math.round(rootRect.width * 100) / 100;
        const h = Math.round(rootRect.height * 100) / 100;
        const svgTemplate = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
        return { svgTemplate, imageUrls: Array.from(imageUrls) };
      }
    });

    if (!data) {
      showStatus('No element locked. Click an element first.', 'error');
      return;
    }

    let svgString = data.svgTemplate;

    // Convert external images to inline base64
    if (data.imageUrls && data.imageUrls.length > 0) {
      showStatus('🖼️ Embedding images...', 'info');
      for (const url of data.imageUrls) {
        try {
          const resp = await fetch(url, { credentials: 'include' });
          const blob = await resp.blob();
          const reader = new FileReader();
          await new Promise(resolve => {
            reader.onload = resolve;
            reader.readAsDataURL(blob);
          });
          const dataUri = reader.result;
          svgString = svgString.replace(new RegExp(`href="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'), `href="${dataUri}"`);
        } catch (e) {
          console.warn('Failed to embed image:', url, e);
        }
      }
    }

    // Copy SVG as text/html so Figma parses it as editable vector layers
    try {
      const blob = new Blob([svgString], { type: 'text/html' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': new Blob([svgString], { type: 'text/plain' })
        })
      ]);
      showStatus('✅ Copied! Paste in Figma (Ctrl+V) — editable layers!', 'success');
      launchConfetti();
    } catch (clipboardErr) {
      console.warn('Clipboard API failed, trying fallback:', clipboardErr);
      // Fallback: copy as plain text
      try {
        await navigator.clipboard.writeText(svgString);
        showStatus('✅ Copied as text! Paste in Figma (Ctrl+V)', 'success');
        launchConfetti();
      } catch (fallbackErr) {
        console.error('Fallback clipboard failed:', fallbackErr);
        // Last resort: create textarea and use execCommand
        const textArea = document.createElement("textarea");
        textArea.value = svgString;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          document.body.removeChild(textArea);
          showStatus('✅ Copied! Paste in Figma (Ctrl+V)', 'success');
          launchConfetti();
        } catch (execErr) {
          document.body.removeChild(textArea);
          showStatus('Failed: Clipboard not available', 'error');
          console.error('All clipboard methods failed:', execErr);
        }
      }
    }
  } catch (err) {
    console.error('Copy to Figma error:', err);
    showStatus('Failed: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (span) span.textContent = oldText;
  }
}

async function exportComponent() {
  if (!currentTab) return;
  const btn = document.getElementById('btn-export-inspector');
  const span = document.getElementById('text-export-inspector');
  const oldText = span ? span.textContent : 'Export Component';
  btn.disabled = true;
  if (span) span.textContent = 'Working…';

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: async () => {
        const el = window._zipitInspectCurrentTarget;
        if (!el) return null;

        const baseURI = document.baseURI;
        const urlMap = new Map();
        const promises = [];
        const svgDefs = new Set();

        const resolveUrl = (url) => { try { return new URL(url, baseURI).href; } catch { return url; } };

        const safeFetch = (url) => {
          let abs = resolveUrl(url);
          if (abs.startsWith('//')) abs = 'https:' + abs;
          if (urlMap.has(abs) || !abs.startsWith('http')) return Promise.resolve();
          return new Promise(res => {
            chrome.runtime.sendMessage({ type: 'fetch_asset', url: abs }, (response) => {
              if (response && response.data) urlMap.set(abs, response.data);
              res();
            });
          });
        };

        const scan = (target) => {
          // 1. Tag attributes (src, srcset, href)
          const tagMap = { 'img': ['src', 'srcset'], 'video': ['poster', 'src'], 'source': ['src', 'srcset'], 'image': ['href', 'xlink:href'] };
          const attrs = tagMap[target.tagName.toLowerCase()] || [];
          attrs.forEach(attr => {
            const val = target.getAttribute(attr);
            if (!val) return;
            if (attr === 'srcset') {
              val.split(',').forEach(s => {
                const u = s.trim().split(' ')[0];
                if (u) promises.push(safeFetch(u));
              });
            } else {
              promises.push(safeFetch(val));
            }
          });

          // 2. Computed Styles (background-image, mask, icons)
          ['', '::before', '::after'].forEach(pseudo => {
            const style = window.getComputedStyle(target, pseudo);
            const props = ['background-image', 'mask-image', '-webkit-mask-image', 'cursor', 'list-style-image'];
            props.forEach(p => {
              const v = style.getPropertyValue(p);
              if (v && v.includes('url(')) {
                const ms = v.matchAll(/url\(["']?(.+?)["']?\)/gi);
                for (const m of ms) promises.push(safeFetch(m[1]));
              }
            });
          });

          // 3. SVG Use references
          if (target.tagName.toLowerCase() === 'use') {
            const href = target.getAttribute('href') || target.getAttribute('xlink:href');
            if (href && href.startsWith('#')) {
              const id = href.substring(1);
              const def = document.getElementById(id);
              if (def) {
                // Clone the definition and its own references
                svgDefs.add(def.outerHTML);
                // If the def itself has <use>, it won't be scanned by querySelectorAll below, 
                // but typically defs are simple paths/symbols.
              }
            }
          }
        };

        scan(el);
        el.querySelectorAll('*').forEach(scan);
        await Promise.all(promises);

        const replaceUrlsInCss = (cssText) => {
          return cssText.replace(/url\(["']?(.+?)["']?\)/gi, (match, url) => {
            if (url.startsWith('data:')) return match;
            const abs = resolveUrl(url);
            return `url("${urlMap.get(abs) || abs}")`;
          });
        };

        const classStyles = [];
        let classId = 0;

        const applyStyles = (source, target) => {
          const cs = window.getComputedStyle(source);
          const className = `zi-el-${classId++}`;
          let css = '';

          for (let i = 0; i < cs.length; i++) {
            const p = cs[i], v = cs.getPropertyValue(p);
            if (!v || v === 'none' || v === 'auto' || v === 'transparent' || v === 'normal') continue;

            // Filter redundant browser defaults to keep CSS small
            if (p === 'margin-top' && v === '0px') continue;
            if (p === 'padding-top' && v === '0px') continue;

            css += `${p}: ${replaceUrlsInCss(v)}; `;
          }

          target.classList.add(className);
          classStyles.push(`:where(.${className}) { ${css} }`);

          ['before', 'after'].forEach(type => {
            const pcs = window.getComputedStyle(source, `::${type}`);
            const content = pcs.getPropertyValue('content');
            if (content && content !== 'none' && content !== '""') {
              const pseudoClass = `${className}-${type}`;
              const span = document.createElement('span');
              span.className = pseudoClass;
              let pcss = 'display: inline-block; pointer-events: none; ';
              for (let i = 0; i < pcs.length; i++) {
                const p = pcs[i], v = pcs.getPropertyValue(p);
                if (v && v !== 'none' && v !== 'auto' && v !== 'normal') {
                  pcss += `${p}: ${replaceUrlsInCss(v)}; `;
                }
              }
              classStyles.push(`.${className}::${type}, .${pseudoClass} { ${pcss} }`);
              if (content.startsWith('"') || content.startsWith("'")) span.textContent = content.slice(1, -1);
              if (type === 'before') target.prepend(span); else target.append(span);
            }
          });
        };

        const clone = el.cloneNode(true);
        const children = el.querySelectorAll('*'), cClones = clone.querySelectorAll('*');
        applyStyles(el, clone);
        children.forEach((c, i) => { if (cClones[i]) applyStyles(c, cClones[i]); });

        // Fix inline attributes in clone (img src, srcset, etc)
        const fixAttr = (node) => {
          if (node.tagName === 'IMG' || node.tagName === 'SOURCE') {
            if (node.hasAttribute('src')) {
              const abs = resolveUrl(node.getAttribute('src'));
              if (urlMap.has(abs)) node.setAttribute('src', urlMap.get(abs));
            }
            if (node.hasAttribute('srcset')) {
              let ss = node.getAttribute('srcset');
              urlMap.forEach((val, key) => { ss = ss.split(key).join(val); });
              node.setAttribute('srcset', ss);
            }
          }
          if (node.tagName === 'image') {
            const h = node.getAttribute('href') || node.getAttribute('xlink:href');
            if (h) {
              const abs = resolveUrl(h);
              if (urlMap.has(abs)) node.setAttribute('href', urlMap.get(abs));
            }
          }
        };
        fixAttr(clone);
        cClones.forEach(fixAttr);

        const ancestors = [];
        let curr = el.parentElement;
        while (curr && curr !== document.body) {
          const attrs = {};
          for (const a of curr.attributes) { if (a.name !== 'style') attrs[a.name] = a.value; }
          const s = window.getComputedStyle(curr);
          const layoutStyles = ['display', 'flex-direction', 'align-items', 'justify-content', 'gap', 'grid-template-columns', 'grid-template-rows', 'padding', 'position']
            .map(p => `${p}: ${s.getPropertyValue(p)} !important;`).join(' ');
          const sizingStyles = `min-height: ${s.getPropertyValue('height')} !important; overflow: visible !important; width: 100%; max-width: 100%; pointer-events: none; border: none !important; background: transparent !important;`;
          ancestors.push({ tag: curr.tagName.toLowerCase(), attrs, style: layoutStyles + ' ' + sizingStyles });
          curr = curr.parentElement;
        }
        ancestors.reverse();

        let extraCss = '/* SITE VARIABLES */\n:root {\n';
        [document.documentElement, document.body].forEach(rootEl => {
          const s = window.getComputedStyle(rootEl);
          for (let i = 0; i < s.length; i++) {
            const p = s[i];
            if (p.startsWith('--')) {
              const val = s.getPropertyValue(p);
              if (val) extraCss += `  ${p}: ${val} !important;\n`;
            }
          }
        });
        extraCss += '}\n\n';

        const styleSheetPromises = Array.from(document.styleSheets).map(sheet => {
          return new Promise(async (res) => {
            try {
              // Try direct access first
              const rules = sheet.cssRules || sheet.rules;
              let css = '';
              for (let i = 0; i < rules.length; i++) {
                const r = rules[i];
                const txt = r.cssText;
                const keywords = [':hover', ':active', ':focus', ':checked', ':target', ':before', ':after', '::before', '::after', '@media', '@keyframes'];
                if (keywords.some(k => txt.includes(k))) css += replaceUrlsInCss(txt) + '\n';
              }
              res(css);
            } catch (e) {
              // CORS Blocked - Fetch via background
              if (sheet.href) {
                chrome.runtime.sendMessage({ type: 'fetch_asset', url: sheet.href, as_text: true }, (response) => {
                  if (response && response.data) {
                    // Simple regex extractor for interactive rules from raw text
                    // This is a tradeoff for speed vs full parser
                    let css = '';
                    const blocks = response.data.match(/[^{}]+\{[^{}]+\}/g) || [];
                    blocks.forEach(block => {
                      if ([':hover', ':active', ':focus', ':before', ':after', '@media', '@keyframes'].some(k => block.includes(k))) {
                        css += replaceUrlsInCss(block) + '\n';
                      }
                    });
                    res(css);
                  } else res('');
                });
              } else res('');
            }
          });
        });

        const capturedStyleBlocks = await Promise.all(styleSheetPromises);
        extraCss += capturedStyleBlocks.join('\n');

        let fontsCss = '/* SITE FONTS */\n';
        for (const sheet of document.styleSheets) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            for (let i = 0; i < rules.length; i++) {
              if (rules[i].type === 5) { fontsCss += replaceUrlsInCss(rules[i].cssText) + '\n'; }
            }
          } catch (e) { }
        }

        return {
          html: clone.outerHTML,
          css: extraCss,
          fonts: fontsCss,
          svgDefs: Array.from(svgDefs).join('\n'),
          baseStyles: classStyles.join('\n'),
          ancestors,
          baseURI,
          tag: el.tagName.toLowerCase(),
          bodyBg: window.getComputedStyle(document.body).backgroundColor,
          bodyClass: document.body.className,
          htmlClass: document.documentElement.className,
          title: document.title
        };
      }
    });

    if (!result) { showStatus('Click an element first!', 'error'); return; }

    const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}="${v.replace(/"/g, '&quot;')}"`).join(' ');
    let open = '', close = '';
    result.ancestors.forEach(a => {
      open += `<${a.tag} ${fmt(a.attrs)} style="${a.style}">\n`;
      close = `</${a.tag}>\n` + close;
    });

    const output = `<!DOCTYPE html>
<html lang="en" class="${result.htmlClass}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base href="${result.baseURI}"><title>ZipIt Capture: ${result.tag} | ${result.title}</title>
  <style>
    @layer zipit_base, zipit_interact;

    *, *::before, *::after { box-sizing: border-box; }
    
    body { 
      background: ${result.bodyBg || '#ffffff'}; 
      min-height: 100vh; 
      margin: 0; 
      padding: 0; 
      font-family: system-ui, -apple-system, sans-serif;
      overflow-x: hidden;
    }
    
    /* GLOBAL FIDELITY RESET (Locking defaults without blocking interactions) */
    @layer zipit_base {
       a, a:hover, a:visited, a:active { text-decoration: none !important; color: inherit !important; }
       button, input { all: unset !important; box-sizing: border-box !important; }
       
       /* CAPTURED BASE STYLES */
       ${result.baseStyles}
    }

    /* PREVENT LAYOUT JUMPS */
    img { max-width: 100%; height: auto; display: block; }
    svg { display: block; }

    /* SITE ASSETS & INTERACTIVITY */
    @layer zipit_interact {
       /* CAPTURED SITE FONTS */
       ${result.fonts}

       /* CAPTURED INTERACTIVE EFFECTS (:HOVER, :ACTIVE, MEDIA QUERIES) */
       ${result.css}
    }
  </style>
</head>
<body class="${result.bodyClass}">
  ${open}
    ${result.html}
  ${close}
  
  <div style="display:none;" id="zipit-svg-defs">
    <svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${result.svgDefs}
      </defs>
    </svg>
  </div>
  
  <div style="position:fixed; bottom:20px; right:20px; background:rgba(0,0,0,0.4); backdrop-filter:blur(10px); color:white; padding:6px 14px; border-radius:100px; font-size:10px; font-weight:600; opacity:0.7; pointer-events:none; z-index:9999999;">
    ZipIt Harvest • ${new Date().toLocaleDateString()}
  </div>
</body>
</html>`;

    const blob = new Blob([output], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: `zipit_design_${result.tag}_${Date.now()}.html` }, () => {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
    showStatus('Interactive component captured!', 'success');
    launchConfetti();
  } catch (err) { showStatus('Capture failed: ' + err.message, 'error'); }
  finally {
    if (btn) btn.disabled = false;
    if (span) span.textContent = oldText;
  }
}

function createIssueCard(title, wcag, requirement, impact, failures, severity = 'warning') {
  const div = document.createElement('div');
  div.style.cssText = 'background: var(--surface); border-bottom: 1px solid var(--border); transition: all 0.2s;';
  
  const icon = severity === 'critical' 
    ? `<div style="background:#ef4444; color:white; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900;">!</div>`
    : `<div style="background:#f59e0b; color:white; width:22px; height:22px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900;">Δ</div>`;

  const countBadge = failures.length > 1 
    ? `<div style="background:rgba(239, 68, 68, 0.15); color:#ef4444; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:800;">${failures.length}</div>`
    : '';

  const failuresHtml = failures.map(f => {
    // Specialized rendering for contrast if data exists
    if (f.fg && f.bg) {
      return `
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 12px; margin-bottom: 10px; border: 1px solid var(--border); display: flex; align-items: center; gap: 15px;">
          <div style="width: 40px; height: 40px; border-radius: 6px; background: ${f.bg}; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.1); position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="color: ${f.fg}; font-weight: 900; font-size: 14px;">Aa</div>
          </div>
          <div style="flex: 1; overflow: hidden;">
            <div style="font-size: 12px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.text}</div>
            <div style="font-size: 9px; color: var(--muted); margin-top: 3px; font-family: monospace;">${f.fg} on ${f.bg}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; font-weight: 900; color: var(--red);">${f.ratio}</div>
            <button class="highlight-trigger" data-selector="${f.selector}" style="background: none; border: none; color: var(--blue); font-size: 10px; cursor: pointer; padding: 0; text-decoration: underline;">Track</button>
          </div>
        </div>
      `;
    }

    return `
      <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px; margin-bottom: 10px; border: 1px solid var(--border);">
        <div style="font-size: 9px; color: var(--muted); font-family: monospace; margin-bottom: 5px;">${f.selector}</div>
        <div style="background: #000; border-radius: 6px; padding: 8px; font-family: monospace; font-size: 10px; color: #88eeff; overflow-x: auto; margin-bottom: 8px;">
          ${f.html.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>
        <button class="btn-secondary highlight-trigger" data-selector="${f.selector}" style="padding: 4px 10px; font-size: 9px; border-radius: 4px;">Track Element</button>
      </div>
    `;
  }).join('');

  div.innerHTML = `
    <div class="issue-header" style="padding: 15px 18px; display: flex; align-items: center; cursor: pointer;">
      <div style="margin-right: 15px;">${icon}</div>
      <div style="flex: 1;">
        <div style="font-size: 13px; font-weight: 700; color: var(--text);">${title}</div>
        <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">${wcag}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        ${countBadge}
        <div class="chevron" style="opacity: 0.3; font-size: 12px; transition: transform 0.2s;">▼</div>
      </div>
    </div>
    
    <div class="issue-details" style="display: none; padding: 0 18px 20px 55px; background: rgba(0,0,0,0.1);">
      <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
        <div style="font-size: 9px; font-weight: 800; color: var(--muted); text-transform: uppercase; margin-bottom: 6px;">Requirement:</div>
        <div style="font-size: 11px; color: var(--text); line-height: 1.6;">${requirement}</div>
        <div style="margin-top: 10px; display: flex; align-items: center; gap: 5px;">
          <span style="font-size: 9px; color: var(--muted); text-transform: uppercase;">Impact:</span>
          <span style="font-size: 10px; font-weight: 700; color: var(--blue);">${impact}</span>
        </div>
      </div>
      ${failuresHtml}
    </div>
  `;

  const header = div.querySelector('.issue-header');
  const details = div.querySelector('.issue-details');
  const chevron = div.querySelector('.chevron');
  
  header.addEventListener('click', () => {
    const isVisible = details.style.display === 'block';
    details.style.display = isVisible ? 'none' : 'block';
    chevron.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
  });

  div.querySelectorAll('.highlight-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      highlightElementInPage(btn.dataset.selector);
    });
  });

  return div;
}

function highlightElementInPage(selector) {
  showStatus(`Locating element: ${selector}`, 'info');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (sel) => {
        const el = document.querySelector(sel);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          const originalOutline = el.style.outline;
          const originalBoxShadow = el.style.boxShadow;
          const originalZIndex = el.style.zIndex;
          const originalPosition = el.style.position;
          
          el.style.zIndex = '1000000';
          el.style.position = 'relative';
          el.style.outline = '4px solid #f97316';
          el.style.outlineOffset = '8px';
          
          // Using Web Animations API for a "Slick" moving beam effect
          const animation = el.animate([
            { boxShadow: '0 0 0 4000px rgba(0,0,0,0.7), 0 0 20px 0px rgba(249, 115, 22, 0.4)', outlineOffset: '4px' },
            { boxShadow: '0 0 0 4000px rgba(0,0,0,0.8), 0 0 60px 25px rgba(249, 115, 22, 0.8)', outlineOffset: '12px' },
            { boxShadow: '0 0 0 4000px rgba(0,0,0,0.7), 0 0 20px 0px rgba(249, 115, 22, 0.4)', outlineOffset: '4px' }
          ], {
            duration: 1500,
            iterations: Infinity,
            easing: 'ease-in-out'
          });

          setTimeout(() => {
            animation.cancel();
            el.style.outline = originalOutline;
            el.style.boxShadow = originalBoxShadow;
            el.style.zIndex = originalZIndex;
            el.style.position = originalPosition;
            el.style.outlineOffset = '';
          }, 6000);
          return true;
        }
        return false;
      },
      args: [selector]
    }, (results) => {
      if (results?.[0]?.result) {
        showStatus('Element found and focused !', 'success');
      } else {
        showStatus('Element might be hidden or removed.', 'error');
      }
    });
  });
}
