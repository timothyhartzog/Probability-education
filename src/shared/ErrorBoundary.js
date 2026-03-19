/**
 * ErrorBoundary.js
 * A shared UI component to trap and display simulation errors gracefully.
 * Dumps state to 'window.ANTIGRAVITY_LOG' for AI diagnostics.
 */

export class ErrorBoundary {
  static init() {
    window.ANTIGRAVITY_LOG = window.ANTIGRAVITY_LOG || [];
    
    // Global Unhandled Rejection Trap (for async simulations)
    window.addEventListener('unhandledrejection', (event) => {
      this.report('Unhandled Rejection', event.reason);
    });

    // Global Error Trap
    window.addEventListener('error', (event) => {
      this.report('JavaScript Error', event.error);
    });
  }

  static report(type, error) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      type: type,
      message: error?.message || 'Unknown Failure',
      stack: error?.stack,
      url: window.location.href,
      simulatorState: window.SIM_STATE || 'No State Snapshot Found'
    };

    window.ANTIGRAVITY_LOG.push(errorRecord);

    // Dynamic Display of Error for User
    let display = document.getElementById('antigravity-error-overlay');
    if (!display) {
      display = document.createElement('div');
      display.id = 'antigravity-error-overlay';
      display.style = `
        position: fixed; top: 20px; right: 20px; width: 320px;
        background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px;
        padding: 16px; z-index: 10000; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        font-family: system-ui, -apple-system, sans-serif; display: none;
      `;
      document.body.appendChild(display);
    }

    display.style.display = 'block';
    // Build DOM nodes manually to avoid XSS from error message content
    display.innerHTML = '';
    const title = document.createElement('div');
    title.style.cssText = 'color:#991b1b;font-weight:700;font-size:14px;margin-bottom:8px';
    title.textContent = '⚠️ Simulator Exception Detected';
    const msg = document.createElement('div');
    msg.style.cssText = 'font-size:12px;color:#7f1d1d;line-height:1.4;margin-bottom:12px';
    msg.textContent = errorRecord.message;
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px';
    const reloadBtn = document.createElement('button');
    reloadBtn.style.cssText = 'background:#ef4444;color:white;border:none;padding:4px 12px;border-radius:4px;font-size:11px;cursor:pointer';
    reloadBtn.textContent = 'Reload System';
    reloadBtn.addEventListener('click', () => location.reload());
    const dismissBtn = document.createElement('button');
    dismissBtn.style.cssText = 'background:transparent;border:1px solid #ef4444;color:#ef4444;padding:4px 12px;border-radius:4px;font-size:11px;cursor:pointer';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.addEventListener('click', () => { display.style.display = 'none'; });
    actions.appendChild(reloadBtn);
    actions.appendChild(dismissBtn);
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:12px;font-size:10px;color:#b91c1c;opacity:0.7';
    footer.textContent = `Reported to Antigravity v1.0. ID: ${Math.random().toString(36).substr(2, 9)}`;
    display.appendChild(title);
    display.appendChild(msg);
    display.appendChild(actions);
    display.appendChild(footer);
  }
}
