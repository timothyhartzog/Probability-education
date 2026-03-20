/**
 * param-tooltips.js
 * Lightweight parameter info popup system.
 *
 * Usage (HTML-defined controls):
 *   Add <button class="param-info" data-param="Name" data-tip="Description"
 *              data-default="3" data-range="1–100" data-unit="items">ⓘ</button>
 *   next to any control label.
 *
 * Usage (JS-generated controls):
 *   import { makeInfoBtn } from '../../lib/param-tooltips.js';
 *   const btn = makeInfoBtn({ param: 'Name', tip: 'Description', default: '3', range: '1–100' });
 *   label.appendChild(btn);
 */

// Create singleton popup element
let popup;
let activeBtn = null;
let hideTimer = null;

function ensurePopup() {
  if (popup) return popup;
  popup = document.createElement('div');
  popup.className = 'param-popup';
  popup.setAttribute('role', 'tooltip');
  popup.setAttribute('aria-live', 'polite');
  document.body.appendChild(popup);
  return popup;
}

function showPopup(btn) {
  const p = ensurePopup();
  clearTimeout(hideTimer);
  activeBtn = btn;

  const paramName = btn.dataset.param || 'Parameter';
  const tip = btn.dataset.tip || '';
  const def = btn.dataset.default;
  const range = btn.dataset.range;
  const unit = btn.dataset.unit;

  let metaHTML = '';
  if (def !== undefined) metaHTML += `<div>Default: <span>${def}${unit ? ' ' + unit : ''}</span></div>`;
  if (range !== undefined) metaHTML += `<div>Range: <span>${range}${unit ? ' ' + unit : ''}</span></div>`;

  p.innerHTML = `
    <div class="pp-title">${paramName}</div>
    <div class="pp-body">${tip}</div>
    ${metaHTML ? `<div class="pp-meta">${metaHTML}</div>` : ''}
  `;

  // Position near the button
  const rect = btn.getBoundingClientRect();
  const popupW = 280;
  const margin = 8;

  let left = rect.right + margin;
  if (left + popupW > window.innerWidth - margin) {
    left = rect.left - popupW - margin;
  }
  if (left < margin) left = margin;

  p.style.left = left + 'px';
  p.style.top = rect.top + 'px';
  p.classList.add('visible');

  btn.setAttribute('aria-expanded', 'true');
}

function hidePopup() {
  hideTimer = setTimeout(() => {
    if (popup) popup.classList.remove('visible');
    if (activeBtn) {
      activeBtn.setAttribute('aria-expanded', 'false');
      activeBtn = null;
    }
  }, 120);
}

// Event delegation
document.addEventListener('mouseenter', (e) => {
  const btn = e.target.closest?.('.param-info');
  if (btn) showPopup(btn);
}, true);

document.addEventListener('mouseleave', (e) => {
  if (e.target.closest?.('.param-info')) hidePopup();
}, true);

document.addEventListener('focus', (e) => {
  const btn = e.target.closest?.('.param-info');
  if (btn) showPopup(btn);
}, true);

document.addEventListener('blur', (e) => {
  if (e.target.closest?.('.param-info')) hidePopup();
}, true);

document.addEventListener('click', (e) => {
  const btn = e.target.closest?.('.param-info');
  if (btn) {
    if (popup?.classList.contains('visible') && activeBtn === btn) {
      hidePopup();
    } else {
      showPopup(btn);
    }
    e.stopPropagation();
  } else if (activeBtn) {
    hidePopup();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activeBtn) hidePopup();
});

/**
 * Create an info button element for use in JS-generated controls.
 * @param {Object} config
 * @param {string} config.param  - Parameter name (tooltip title)
 * @param {string} config.tip    - Description text
 * @param {string} [config.default] - Default value
 * @param {string} [config.range]   - Valid range, e.g. "1–100"
 * @param {string} [config.unit]    - Unit string
 * @returns {HTMLButtonElement}
 */
export function makeInfoBtn(config) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'param-info';
  btn.setAttribute('aria-label', `Parameter info for ${config.param || 'control'}`);
  btn.setAttribute('aria-expanded', 'false');
  btn.textContent = 'ⓘ';
  if (config.param)   btn.dataset.param   = config.param;
  if (config.tip)     btn.dataset.tip     = config.tip;
  if (config.default !== undefined) btn.dataset.default = config.default;
  if (config.range)   btn.dataset.range   = config.range;
  if (config.unit)    btn.dataset.unit    = config.unit;
  return btn;
}
