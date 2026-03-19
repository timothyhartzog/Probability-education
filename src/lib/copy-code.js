/* ============================================================
   Copy Code Button — Shared utility for all modules
   ============================================================
   Adds a floating "Copy Code" button that copies the module's
   source code to clipboard for reuse in other documents.
   ============================================================ */

function setup() {
  const btn = document.createElement('button');
  btn.className = 'copy-code-btn';
  btn.setAttribute('aria-label', 'Copy simulation code');
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="5" width="9" height="9" rx="1.5"/>
    <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/>
  </svg> <span>Copy Code</span>`;

  btn.addEventListener('click', async () => {
    try {
      // Find the module script tag to determine the source file
      const moduleScript = document.querySelector('script[type="module"][src]');
      if (!moduleScript) {
        showFeedback(btn, 'No module source found', true);
        return;
      }

      const src = moduleScript.getAttribute('src');
      const resp = await fetch(src);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      let code = await resp.text();

      // Strip the import lines since users want standalone code
      const lines = code.split('\n');
      const imports = [];
      const body = [];
      let pastImports = false;

      for (const line of lines) {
        if (!pastImports && (line.startsWith('import ') || line.startsWith('import{'))) {
          imports.push(line);
        } else {
          pastImports = true;
          body.push(line);
        }
      }

      // Build header comment with import info
      const header = [
        '// ============================================================',
        '// Source code from: ' + document.title,
        '// ============================================================',
        '//',
        '// Dependencies (install via npm):',
      ];
      for (const imp of imports) {
        header.push('//   ' + imp.trim());
      }
      header.push('// ============================================================', '');

      const finalCode = header.join('\n') + body.join('\n');

      await navigator.clipboard.writeText(finalCode);
      showFeedback(btn, 'Copied!');
    } catch (err) {
      // Fallback for environments without clipboard API
      console.error('Copy failed:', err);
      showFeedback(btn, 'Copy failed', true);
    }
  });

  document.body.appendChild(btn);
}

function showFeedback(btn, msg, isError = false) {
  const span = btn.querySelector('span');
  const original = span.textContent;
  span.textContent = msg;
  btn.classList.add(isError ? 'copy-error' : 'copy-success');

  setTimeout(() => {
    span.textContent = original;
    btn.classList.remove('copy-success', 'copy-error');
  }, 2000);
}

// SVG Accessibility — adds <title> and role="img" to D3-generated SVGs
// Runs on window load (after all module initialization has completed)
function setupSVGAccessibility() {
  document.querySelectorAll('[aria-label]').forEach(container => {
    const label = container.getAttribute('aria-label');
    if (!label) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    if (!svg.hasAttribute('role')) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', label);
    }
    if (!svg.querySelector('title')) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = label;
      svg.insertBefore(title, svg.firstChild);
    }
  });
}

// Auto-initialize when imported
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup);
} else {
  setup();
}
window.addEventListener('load', setupSVGAccessibility);
