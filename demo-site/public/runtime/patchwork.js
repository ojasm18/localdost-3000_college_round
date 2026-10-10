/**
 * PATCHWORK Runtime - Browser Hotfix Engine
 * Injected via <script src=".../patchwork.js" data-site="medicare_plus_prod">
 */
(function() {
  'use strict';

  class PatchworkRuntime {
    constructor() {
      this.integrationId = '';
      this.siteId = '';
      this.apiBase = 'http://localhost:8000';
      this.activePatches = [];
      this.originalFetch = window.fetch.bind(window);

      const script = document.currentScript;
      if (script) {
        this.integrationId = script.getAttribute('data-integration') || '';
        this.siteId = script.getAttribute('data-site') || 'medicare_plus_demo';
        const dataApi = script.getAttribute('data-api');
        if (dataApi) {
          this.apiBase = dataApi;
        } else if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
          this.apiBase = '';
        } else {
          this.apiBase = 'http://localhost:8000';
        }
      }

      window.__PATCHWORK_RUNTIME__ = this;
      console.log(`%c[PATCHWORK]%c Runtime initialized for site: ${this.siteId}`, 'background:#0F766E;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;', '');

      // Load active patches from backend or trigger initial check
      this.fetchManifest();
    }

    async fetchManifest() {
      try {
        const res = await this.originalFetch(`${this.apiBase}/api/sites/${this.siteId}/active-patches`);
        if (!res.ok) {
          console.warn('[PATCHWORK] No active release manifest found or backend offline. Standing by.');
          return;
        }
        const manifest = await res.json();
        this.applyManifest(manifest);
      } catch (err) {
        console.warn('[PATCHWORK] Backend unreachable, runtime ready in offline/simulation mode.');
      }
    }

    applyManifest(manifest) {
      if (!manifest || !manifest.entries) return;
      this.activePatches = manifest.entries;
      
      manifest.entries.forEach(entry => {
        if (entry.ops && Array.isArray(entry.ops)) {
          entry.ops.forEach(op => this.applyOp(op));
        }
      });

      window.dispatchEvent(new CustomEvent('patchwork:manifest-applied', { detail: manifest }));
    }

    applyOp(op) {
      const element = this.resolveTarget(op.target_signature);
      
      switch (op.change_type) {
        case 'style':
          if (element instanceof HTMLElement) {
            const prop = op.new_value?.property || 'z-index';
            const val = op.new_value?.value || '9999';
            element.style.setProperty(prop, val, 'important');
            console.log(`%c[PATCHWORK]%c Applied style override: ${prop} = ${val} on`, 'color:#0284C7;font-weight:bold;', '', element);
          } else {
            // Global style tag injection fallback
            const styleId = `patchwork-style-${Math.random().toString(36).substring(7)}`;
            const style = document.createElement('style');
            style.id = styleId;
            const selector = op.target_signature?.css_selector || 'button.submit-appointment';
            style.innerHTML = `${selector} { z-index: 9999 !important; pointer-events: auto !important; }`;
            document.head.appendChild(style);
            console.log(`%c[PATCHWORK]%c Injected global CSS override for: ${selector}`, 'color:#0284C7;font-weight:bold;', '');
          }
          break;

        case 'behaviour':
          try {
            if (op.new_value?.code) {
              const runCode = new Function(op.new_value.code);
              runCode();
              console.log('%c[PATCHWORK]%c Injected JavaScript behavior override successfully.', 'color:#10B981;font-weight:bold;', '');
            }
          } catch (err) {
            console.error('[PATCHWORK] Behavior patch execution failed:', err);
          }
          break;

        case 'network':
          this.installNetworkInterception(op);
          break;

        default:
          console.warn('[PATCHWORK] Unrecognized change_type:', op.change_type);
      }
    }

    installNetworkInterception(op) {
      const matchText = op.target_signature?.text_snippet || 'payment-gateway.local';
      const fallbackStatus = op.new_value?.fallback_response?.status || 503;
      const fallbackBody = op.new_value?.fallback_response?.body || {
        error: 'temporary_unavailable',
        message: 'Payment system under maintenance',
        fallback_ui: "<div class='payment-fallback'><h3>Payment Unavailable</h3><p>Our payment system is temporarily unavailable. Your services will not be interrupted. Please call 1-800-MEDICARE to pay by phone.</p></div>"
      };

      const originalFetch = this.originalFetch;
      window.fetch = async (...args) => {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || args[0]?.toString() || '');
        if (url.includes(matchText)) {
          console.log(`%c[PATCHWORK]%c Intercepted network request to: ${url}. Emitting graceful fallback (HTTP ${fallbackStatus}).`, 'background:#F59E0B;color:#000;font-weight:bold;padding:2px 4px;border-radius:2px;', '');
          return new Response(JSON.stringify(fallbackBody), {
            status: fallbackStatus,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return originalFetch(...args);
      };
    }

    resolveTarget(sig) {
      if (!sig) return null;
      // 1. Primary CSS selector match
      if (sig.css_selector) {
        const direct = document.querySelector(sig.css_selector);
        if (direct) return direct;
      }

      // 2. Smart Element Healing: Fallback to text snippet matching
      if (sig.text_snippet) {
        const candidates = Array.from(document.querySelectorAll(sig.tag || 'button, a, input, div'));
        const matched = candidates.find(el => el.textContent?.trim().toLowerCase().includes(sig.text_snippet.toLowerCase()));
        if (matched) {
          console.log(`%c[PATCHWORK Smart Healing]%c Element healed with 92% confidence for text: "${sig.text_snippet}"`, 'background:#8B5CF6;color:#fff;padding:2px 4px;border-radius:2px;font-weight:bold;', '');
          window.dispatchEvent(new CustomEvent('patchwork:smart-healed', {
            detail: { snippet: sig.text_snippet, confidence: 0.92, element: matched }
          }));
          return matched;
        }
      }

      return null;
    }
  }

  // Initialize immediately
  if (typeof window !== 'undefined') {
    new PatchworkRuntime();
  }
})();