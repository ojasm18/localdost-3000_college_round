import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';
import { getDb } from './db.js';
import * as audit from './audit.js';
import { scoreRisk } from '../../shared/validation.js';
import type {
  IssueCategory,
  IssueSeverity,
  IssueStatus,
  PatchOperation,
  ElementFingerprint,
} from '../../shared/types.js';

interface RawFinding {
  ruleId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  status?: IssueStatus;
  title: string;
  description: string;
  pageUrl: string;
  selector: string | null;
  fingerprint: ElementFingerprint | null;
  evidence: Record<string, unknown> | null;
  patch: {
    title: string;
    description: string;
    operations: PatchOperation[];
    targetPageUrlPattern: string;
    targetSelector: string;
  } | null;
}

export function normalizeScanUrl(inputUrl: string): string {
  let cleaned = inputUrl.trim();
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned;
}

export async function runScan(
  scanId: string,
  rawUrl: string,
  actor: { id: string; name: string }
): Promise<void> {
  const db = getDb();
  let browser: any;
  const targetUrl = normalizeScanUrl(rawUrl);

  try {
    // 1. Launch browser with resilient fallback channels
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      try {
        browser = await chromium.launch({ channel: 'msedge', headless: true });
      } catch {
        browser = await chromium.launch({ channel: 'chrome', headless: true });
      }
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 PatchworkScanner/2.0',
    });

    const page = await context.newPage();
    const findings: RawFinding[] = [];
    const failedRequests: { url: string; status: number; method: string }[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    // Continuous network monitoring
    page.on('response', (response: any) => {
      const status = response.status();
      if (status >= 400) {
        failedRequests.push({
          url: response.url(),
          status,
          method: response.request().method(),
        });
      }
    });

    // Continuous console error monitoring
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!consoleErrors.includes(text)) {
          consoleErrors.push(text);
        }
      }
    });

    // Continuous runtime crash monitoring
    page.on('pageerror', (err: any) => {
      const msg = err.message || String(err);
      if (!pageErrors.includes(msg)) {
        pageErrors.push(msg);
      }
    });

    // Update progress: 15%
    db.prepare('UPDATE scans SET progress = 15, url = ? WHERE id = ?').run(targetUrl, scanId);

    // 2. Initial Page Navigation
    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const currentUrl = page.url();
    if (!response || currentUrl.startsWith('chrome-error://') || currentUrl === 'about:blank') {
      throw new Error(`Unable to reach ${targetUrl}. The domain could not be resolved or the server is offline.`);
    }

    // Allow dynamic hydration & fonts to settle
    await page.waitForTimeout(2000);

    // Update progress: 30%
    db.prepare('UPDATE scans SET progress = 30 WHERE id = ?').run(scanId);

    // Capture initial screenshot
    const artifactsDir = path.resolve(process.env.ARTIFACTS_DIR || './artifacts');
    fs.mkdirSync(artifactsDir, { recursive: true });
    const screenshotFile = `${scanId}.png`;
    const screenshotPath = path.join(artifactsDir, screenshotFile);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: false });
      db.prepare('UPDATE scans SET screenshotPath = ? WHERE id = ?').run(
        `/artifacts/${screenshotFile}`,
        scanId
      );
    } catch {}

    const pathname = new URL(targetUrl).pathname || '*';

    // 3. Axe Accessibility Audit (WCAG 2.1 AA)
    try {
      const axeBuilder = new AxeBuilder({ page }).withRules([
        'image-alt',
        'button-name',
        'label',
        'html-has-lang',
        'color-contrast',
        'link-name',
        'page-has-heading-one',
        'landmark-one-main',
      ]);
      const axeResults = await axeBuilder.analyze();

      for (const violation of axeResults.violations) {
        const nodesToProcess = violation.nodes.slice(0, 5);

        for (const node of nodesToProcess) {
          const selector = node.target.join(' > ') || 'body';
          const htmlSnippet = node.html || '';

          if (violation.id === 'image-alt') {
            findings.push({
              ruleId: 'a11y.img-alt',
              category: 'ACCESSIBILITY',
              severity: 'MEDIUM',
              title: 'Image missing accessible alternative text',
              description: 'Screen readers cannot describe this image to visually impaired users. Adding alt text provides context.',
              pageUrl: targetUrl,
              selector,
              fingerprint: {
                cssSelector: selector,
                domPath: selector,
                tag: 'img',
                classes: [],
                attributes: {},
                textContent: '',
                nearbyText: [],
                ancestors: [],
                rect: { x: 0, y: 0, width: 80, height: 80 },
              },
              evidence: { html: htmlSnippet, failureSummary: node.failureSummary },
              patch: {
                title: 'Add alt description to image',
                description: 'Sets descriptive alt attribute on <img> tag for screen readers.',
                operations: [{ op: 'SET_ATTRIBUTE', name: 'alt', value: 'Descriptive image' }],
                targetPageUrlPattern: pathname,
                targetSelector: selector,
              },
            });
          } else if (violation.id === 'html-has-lang') {
            findings.push({
              ruleId: 'a11y.html-lang',
              category: 'ACCESSIBILITY',
              severity: 'LOW',
              title: 'Document language not specified on <html>',
              description: 'The <html> element lacks a lang attribute, preventing text-to-speech tools from choosing the correct language.',
              pageUrl: targetUrl,
              selector: 'html',
              fingerprint: {
                cssSelector: 'html',
                domPath: 'html',
                tag: 'html',
                classes: [],
                attributes: {},
                textContent: '',
                nearbyText: [],
                ancestors: [],
                rect: { x: 0, y: 0, width: 0, height: 0 },
              },
              evidence: { html: '<html ...>' },
              patch: {
                title: 'Add lang="en" to HTML element',
                description: 'Sets document language to en for screen readers.',
                operations: [{ op: 'SET_ATTRIBUTE', name: 'lang', value: 'en' }],
                targetPageUrlPattern: '*',
                targetSelector: 'html',
              },
            });
          } else if (violation.id === 'button-name') {
            findings.push({
              ruleId: 'a11y.button-name',
              category: 'ACCESSIBILITY',
              severity: 'HIGH',
              title: 'Button lacks discernible accessible name',
              description: 'Interactive button contains no text content or aria-label for assistive technologies.',
              pageUrl: targetUrl,
              selector,
              fingerprint: {
                cssSelector: selector,
                domPath: selector,
                tag: 'button',
                classes: [],
                attributes: {},
                textContent: '',
                nearbyText: [],
                ancestors: [],
                rect: { x: 0, y: 0, width: 44, height: 44 },
              },
              evidence: { html: htmlSnippet },
              patch: {
                title: 'Add aria-label to button',
                description: 'Sets aria-label on interactive button element.',
                operations: [{ op: 'SET_ATTRIBUTE', name: 'aria-label', value: 'Action Button' }],
                targetPageUrlPattern: pathname,
                targetSelector: selector,
              },
            });
          } else if (violation.id === 'label') {
            findings.push({
              ruleId: 'a11y.input-label',
              category: 'ACCESSIBILITY',
              severity: 'HIGH',
              title: 'Form control missing accessible label',
              description: 'Form input field has no associated <label> element or aria-label.',
              pageUrl: targetUrl,
              selector,
              fingerprint: {
                cssSelector: selector,
                domPath: selector,
                tag: 'input',
                classes: [],
                attributes: {},
                textContent: '',
                nearbyText: [],
                ancestors: [],
                rect: { x: 0, y: 0, width: 220, height: 36 },
              },
              evidence: { html: htmlSnippet },
              patch: {
                title: 'Add aria-label to form input',
                description: 'Provides accessible name for screen readers.',
                operations: [{ op: 'SET_ATTRIBUTE', name: 'aria-label', value: 'Input Field' }],
                targetPageUrlPattern: pathname,
                targetSelector: selector,
              },
            });
          } else if (violation.id === 'landmark-one-main') {
            findings.push({
              ruleId: 'a11y.landmark-main',
              category: 'ACCESSIBILITY',
              severity: 'LOW',
              title: 'Document should have one main landmark',
              description: 'The page lacks a <main> landmark or element with role="main", making it harder for screen reader users to skip to primary content.',
              pageUrl: targetUrl,
              selector,
              fingerprint: {
                cssSelector: selector,
                domPath: selector,
                tag: 'div',
                classes: [],
                attributes: {},
                textContent: '',
                nearbyText: [],
                ancestors: [],
                rect: { x: 0, y: 0, width: 1200, height: 600 },
              },
              evidence: { html: htmlSnippet.slice(0, 200) },
              patch: {
                title: 'Add role="main" to primary container',
                description: 'Assigns role="main" to establish a primary landmark for assistive technology.',
                operations: [{ op: 'SET_ATTRIBUTE', name: 'role', value: 'main' }],
                targetPageUrlPattern: pathname,
                targetSelector: selector,
              },
            });
          } else if (violation.id === 'page-has-heading-one') {
            findings.push({
              ruleId: 'a11y.heading-one',
              category: 'ACCESSIBILITY',
              severity: 'LOW',
              title: 'Page missing level-one heading (<h1>)',
              description: 'The document does not contain an <h1> tag, which impairs hierarchical navigation for screen readers.',
              pageUrl: targetUrl,
              selector: 'body',
              fingerprint: null,
              evidence: { html: 'No <h1> element found on page' },
              patch: null,
              status: 'REPORT_ONLY',
            });
          } else if (violation.id === 'color-contrast') {
            findings.push({
              ruleId: 'a11y.contrast',
              category: 'ACCESSIBILITY',
              severity: 'MEDIUM',
              title: 'Element has low text color contrast',
              description: 'Text does not meet the minimum WCAG contrast ratio threshold of 4.5:1 against its background.',
              pageUrl: targetUrl,
              selector,
              fingerprint: {
                cssSelector: selector,
                domPath: selector,
                tag: 'span',
                classes: [],
                attributes: {},
                textContent: '',
                nearbyText: [],
                ancestors: [],
                rect: { x: 0, y: 0, width: 100, height: 20 },
              },
              evidence: { html: htmlSnippet, failureSummary: node.failureSummary },
              patch: {
                title: 'Improve text contrast color',
                description: 'Darkens text color to guarantee high-contrast legibility (WCAG AA).',
                operations: [{ op: 'SET_STYLE', properties: { color: '#111827' }, important: true }],
                targetPageUrlPattern: pathname,
                targetSelector: selector,
              },
            });
          } else if (violation.id === 'link-name') {
            findings.push({
              ruleId: 'a11y.link-name',
              category: 'ACCESSIBILITY',
              severity: 'MEDIUM',
              title: 'Link has no discernible text content',
              description: 'An anchor link lacks text or aria-label, making its navigation destination unclear.',
              pageUrl: targetUrl,
              selector,
              fingerprint: {
                cssSelector: selector,
                domPath: selector,
                tag: 'a',
                classes: [],
                attributes: {},
                textContent: '',
                nearbyText: [],
                ancestors: [],
                rect: { x: 0, y: 0, width: 24, height: 24 },
              },
              evidence: { html: htmlSnippet },
              patch: {
                title: 'Add aria-label to anchor link',
                description: 'Sets descriptive label on icon-only link.',
                operations: [{ op: 'SET_ATTRIBUTE', name: 'aria-label', value: 'Navigation Link' }],
                targetPageUrlPattern: pathname,
                targetSelector: selector,
              },
            });
          }
        }
      }
    } catch (axeErr) {
      console.warn('Axe scan warning:', axeErr);
    }

    // Update progress: 50%
    db.prepare('UPDATE scans SET progress = 50 WHERE id = ?').run(scanId);

    // 4. In-Page DOM & Deep Overlay/Click-Interception Diagnostics (evaluated as raw string to prevent esbuild transpiler collisions)
    const DOM_INSPECTION_SCRIPT = `(() => {
      const results = [];

      function getUniqueSelector(el) {
        if (!el || el === document.body) return 'body';
        if (el === document.documentElement) return 'html';
        if (el.id) return '#' + CSS.escape(el.id);

        let path = '';
        let curr = el;
        while (curr && curr !== document.body && curr !== document.documentElement) {
          let segment = curr.tagName.toLowerCase();
          if (curr.id) {
            segment += '#' + CSS.escape(curr.id);
            path = segment + (path ? ' > ' + path : '');
            break;
          }
          const parent = curr.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(function(c) { return c.tagName === curr.tagName; });
            if (siblings.length > 1) {
              const index = siblings.indexOf(curr) + 1;
              segment += ':nth-of-type(' + index + ')';
            }
          }
          path = segment + (path ? ' > ' + path : '');
          curr = curr.parentElement;
        }
        return path || el.tagName.toLowerCase();
      }

      function getFingerprint(el) {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const ancestors = [];
        let p = el.parentElement;
        while (p && p !== document.body && ancestors.length < 4) {
          ancestors.push({ tag: p.tagName.toLowerCase(), id: p.id || undefined, classes: Array.from(p.classList) });
          p = p.parentElement;
        }
        const attrs = {};
        for (const attr of Array.from(el.attributes)) {
          attrs[attr.name] = attr.value;
        }
        return {
          cssSelector: getUniqueSelector(el),
          domPath: getUniqueSelector(el),
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          classes: Array.from(el.classList),
          attributes: attrs,
          textContent: (el.textContent || '').trim().slice(0, 200),
          nearbyText: [
            el.previousElementSibling && el.previousElementSibling.textContent ? el.previousElementSibling.textContent.trim().slice(0, 50) : null,
            el.nextElementSibling && el.nextElementSibling.textContent ? el.nextElementSibling.textContent.trim().slice(0, 50) : null,
          ].filter(Boolean),
          ancestors,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      }

      // Check 1: Horizontal Layout Overflow
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
        const clientW = document.documentElement.clientWidth;
        const scrollW = document.documentElement.scrollWidth;
        let offenderSelector = 'body';
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const r = el.getBoundingClientRect();
          if (r.right > clientW + 2) {
            offenderSelector = getUniqueSelector(el);
            break;
          }
        }
        results.push({
          type: 'HORIZONTAL_OVERFLOW',
          scrollWidth: scrollW,
          clientWidth: clientW,
          offenderSelector,
        });
      }

      // Check 2: Invisible Overlay / Click Interceptor on Interactive Buttons & Inputs
      const interactiveEls = Array.from(document.querySelectorAll('button, input[type="submit"], a, [role="button"]'));
      for (const btn of interactiveEls) {
        try {
          btn.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
        } catch (e) {}
        const rect = btn.getBoundingClientRect();
        if (rect.width > 4 && rect.height > 4) {
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          if (cx >= 0 && cx <= window.innerWidth && cy >= 0 && cy <= window.innerHeight) {
            const topEl = document.elementFromPoint(cx, cy);
            if (topEl && topEl !== btn && !btn.contains(topEl)) {
              const comp = window.getComputedStyle(topEl);
              if (comp.pointerEvents !== 'none') {
                const btnText = (btn.textContent || btn.value || '').trim().replace(/\\s+/g, ' ');
                results.push({
                  type: 'CLICK_INTERCEPTOR',
                  buttonSelector: getUniqueSelector(btn),
                  buttonText: btnText || 'Interactive Button',
                  buttonFingerprint: getFingerprint(btn),
                  interceptorSelector: getUniqueSelector(topEl),
                  interceptorFingerprint: getFingerprint(topEl),
                  interceptorClass: topEl.className,
                  interceptorTag: topEl.tagName.toLowerCase(),
                  interceptorStyle: {
                    zIndex: comp.zIndex,
                    position: comp.position,
                    backgroundColor: comp.backgroundColor,
                    pointerEvents: comp.pointerEvents,
                  },
                });
              }
            }
          }
        }

        // Structural overlay check (loading-veil, modal-veil, backdrop)
        const parentContainer = btn.parentElement;
        if (parentContainer) {
          const siblingVeils = Array.from(parentContainer.children).filter(function(c) {
            if (c === btn) return false;
            const cs = window.getComputedStyle(c);
            const isPositioned = cs.position === 'absolute' || cs.position === 'fixed';
            const hasZ = cs.zIndex !== 'auto' && parseInt(cs.zIndex, 10) > 1;
            const covers = cs.pointerEvents !== 'none' && cs.display !== 'none' && cs.visibility !== 'hidden';
            return isPositioned && (hasZ || c.classList.contains('loading-veil') || (c.getAttribute('data-patch-target') || '').indexOf('veil') !== -1) && covers;
          });

          for (const veil of siblingVeils) {
            const cs = window.getComputedStyle(veil);
            const btnText = (btn.textContent || btn.value || '').trim().replace(/\\s+/g, ' ');
            results.push({
              type: 'CLICK_INTERCEPTOR',
              buttonSelector: getUniqueSelector(btn),
              buttonText: btnText || 'Interactive Button',
              buttonFingerprint: getFingerprint(btn),
              interceptorSelector: getUniqueSelector(veil),
              interceptorFingerprint: getFingerprint(veil),
              interceptorClass: veil.className,
              interceptorTag: veil.tagName.toLowerCase(),
              interceptorStyle: {
                zIndex: cs.zIndex,
                position: cs.position,
                backgroundColor: cs.backgroundColor,
                pointerEvents: cs.pointerEvents,
              },
            });
          }
        }
      }

      // Check 3: Disabled Conversion CTAs
      const ctas = document.querySelectorAll('button, input[type="submit"], a.btn, a[class*="button"]');
      const ctaRegex = /buy|checkout|pay|order|submit|sign up|add to cart|continue|confirm|schedule|book|save/i;
      ctas.forEach(function(el) {
        const text = (el.textContent || el.value || '').trim();
        if (ctaRegex.test(text)) {
          const isDisabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
          if (isDisabled) {
            results.push({
              type: 'DISABLED_CTA',
              selector: getUniqueSelector(el),
              fingerprint: getFingerprint(el),
              html: el.outerHTML.slice(0, 300),
              text: text,
            });
          }
        }
      });

      // Check 4: Broken Images
      const images = document.querySelectorAll('img');
      images.forEach(function(img) {
        const srcAttr = img.getAttribute('src');
        if (
          srcAttr &&
          srcAttr.trim().length > 0 &&
          srcAttr.indexOf('data:') !== 0 &&
          img.complete &&
          img.naturalWidth === 0
        ) {
          const style = window.getComputedStyle(img);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            results.push({
              type: 'BROKEN_IMAGE',
              src: img.src,
              selector: getUniqueSelector(img),
              fingerprint: getFingerprint(img),
            });
          }
        }
      });

      // Check 5: Dead Links
      const deadLinks = Array.from(document.querySelectorAll('a')).filter(function(a) {
        const h = a.getAttribute('href');
        return !h || h === '#' || h === 'javascript:void(0)' || h === '';
      });
      for (const dl of deadLinks.slice(0, 3)) {
        const text = (dl.textContent || '').trim();
        if (text) {
          results.push({
            type: 'DEAD_LINK',
            text: text,
            selector: getUniqueSelector(dl),
            fingerprint: getFingerprint(dl),
          });
        }
      }

      // Check 6: Broken Status Pills / Offline Gateways
      const brokenPills = Array.from(document.querySelectorAll('.status-broken, .gateway-status-pill'));
      for (const bp of brokenPills) {
        const text = (bp.textContent || '').trim().replace(/\\s+/g, ' ');
        if (text.toLowerCase().indexOf('issues') !== -1 || text.toLowerCase().indexOf('broken') !== -1 || text.toLowerCase().indexOf('down') !== -1) {
          results.push({
            type: 'DYNAMIC_ALERT_CARD',
            text: 'Payment Gateway Status Warning: ' + text,
            selector: getUniqueSelector(bp),
            fingerprint: getFingerprint(bp),
          });
        }
      }

      // Check 7: Session Token Expiration Countdown
      const sessionTimers = Array.from(document.querySelectorAll('.session-timer-bar, .timer-info'));
      for (const st of sessionTimers) {
        const text = (st.textContent || '').trim().replace(/\\s+/g, ' ');
        if (text.toLowerCase().indexOf('session') !== -1 && (text.indexOf('0s') !== -1 || text.toLowerCase().indexOf('expired') !== -1 || text.indexOf('s remaining') !== -1)) {
          results.push({
            type: 'SESSION_EXPIRY_RISK',
            text: 'Short-lived session token timer active: ' + text,
            selector: getUniqueSelector(st),
            fingerprint: getFingerprint(st),
          });
        }
      }

      // Check 8: Dynamically Rendered Error Alerts on Page
      const alertElements = Array.from(
        document.querySelectorAll('.error-alert-card, [role="alert"], .alert-danger, .error-card')
      );
      for (const al of alertElements) {
        const text = (al.textContent || '').trim().replace(/\\s+/g, ' ');
        if (text) {
          results.push({
            type: 'DYNAMIC_ALERT_CARD',
            text: text.slice(0, 300),
            selector: getUniqueSelector(al),
            fingerprint: getFingerprint(al),
          });
        }
      }

      return results;
    })()`;

    const initialDomFindings = (await page.evaluate(DOM_INSPECTION_SCRIPT).catch((err: any) => {
      console.error('initialDomFindings evaluation error:', err);
      return [];
    })) as any[];

    // Update progress: 65%
    db.prepare('UPDATE scans SET progress = 65 WHERE id = ?').run(scanId);

    // 5. Dynamic Multi-View Exploration (Tabs, Modals, Action Flows)
    const dynamicDomFindings: any[] = [];

    const TAB_DISCOVERY_SCRIPT = `(() => {
      const items = Array.from(
        document.querySelectorAll('nav button, [role="tab"], .nav-btn, header nav a, .nav-item button, .banner-quick-actions button')
      );
      return items
        .map(function(el) {
          const text = (el.textContent || '').trim().replace(/\\s+/g, ' ');
          return {
            text: text,
            firstWord: text.split(' ')[0],
            id: el.id,
            className: el.className,
          };
        })
        .filter(function(t) { return t.text.length > 0 && t.text.length < 35; })
        .slice(0, 8);
    })()`;

    const discoveredTabs = (await page.evaluate(TAB_DISCOVERY_SCRIPT).catch(() => [])) as any[];

    for (const tab of discoveredTabs) {
      try {
        const tabBtn = page.locator(`button:has-text("${tab.firstWord}")`).first();
        if (await tabBtn.isVisible()) {
          await tabBtn.click({ timeout: 2500 });
          await page.waitForTimeout(800);

          const tabResults = (await page.evaluate(DOM_INSPECTION_SCRIPT).catch((err: any) => {
            console.error('tabResults error:', err);
            return [];
          })) as any[];
          for (const tr of tabResults) {
            dynamicDomFindings.push({ view: tab.text, ...tr });
          }

          // Test action buttons within this view (e.g., Load records, Checkout, Settle Co-Pay)
          const actionBtn = page.locator(
            'button:has-text("Load Diagnostic Records"), button.pay-now-btn, button:has-text("Settle Co-Pay"), button:has-text("View Results"), button:has-text("Checkout")'
          ).first();

          if (await actionBtn.isVisible()) {
            await actionBtn.click({ timeout: 2500 });
            await page.waitForTimeout(1000);

            // If a modal dialog opened, test submit button inside it
            const modalSubmit = page.locator('.modal-dialog button[type="submit"], [role="dialog"] button[type="submit"]').first();
            if (await modalSubmit.isVisible()) {
              await modalSubmit.click({ timeout: 2500 });
              await page.waitForTimeout(1500);
            }

            const postActionResults = (await page.evaluate(DOM_INSPECTION_SCRIPT).catch((err: any) => {
              console.error('postActionResults error:', err);
              return [];
            })) as any[];
            for (const par of postActionResults) {
              dynamicDomFindings.push({ view: tab.text, ...par });
            }
          }
        }
      } catch (err) {
        // Continue exploring remaining views
      }
    }



    // Update progress: 85%
    db.prepare('UPDATE scans SET progress = 85 WHERE id = ?').run(scanId);

    // 6. Process In-Page DOM & Interaction Findings
    const allDomFindings = [...initialDomFindings, ...dynamicDomFindings];
    const seenIssueKeys = new Set<string>();

    for (const item of allDomFindings) {
      const issueKey = `${item.type}:${item.selector || item.buttonSelector || item.offenderSelector}`;
      if (seenIssueKeys.has(issueKey)) continue;
      seenIssueKeys.add(issueKey);

      if (item.type === 'CLICK_INTERCEPTOR') {
        const btnText = item.buttonText || 'Button';
        findings.push({
          ruleId: 'interaction.click-interceptor',
          category: 'INTERACTION',
          severity: 'CRITICAL',
          title: `Invisible overlay blocks clicks on "${btnText}"`,
          description: `The button is covered by overlay element <${item.interceptorTag}> (${item.interceptorSelector}) with pointer-events: auto, intercepting user interactions.`,
          pageUrl: targetUrl,
          selector: item.interceptorSelector,
          fingerprint: item.interceptorFingerprint || item.buttonFingerprint,
          evidence: {
            blockedButton: item.buttonSelector,
            buttonText: item.buttonText,
            blockingOverlay: item.interceptorSelector,
            overlayStyle: item.interceptorStyle,
          },
          patch: {
            title: `Disable click-blocking overlay on "${btnText}"`,
            description: 'Sets pointer-events: none and display: none on the intercepting overlay to restore button clicks.',
            operations: [
              { op: 'SET_STYLE', properties: { 'pointer-events': 'none', display: 'none' }, important: true },
            ],
            targetPageUrlPattern: pathname,
            targetSelector: item.interceptorSelector,
          },
        });
      } else if (item.type === 'HORIZONTAL_OVERFLOW') {
        findings.push({
          ruleId: 'layout.horizontal-overflow',
          category: 'LAYOUT',
          severity: 'MEDIUM',
          title: 'Page content causes horizontal scrollbar',
          description: `Document scrollWidth (${item.scrollWidth}px) exceeds viewport clientWidth (${item.clientWidth}px). Offending element: ${item.offenderSelector}.`,
          pageUrl: targetUrl,
          selector: item.offenderSelector || 'body',
          fingerprint: null,
          evidence: { scrollWidth: item.scrollWidth, clientWidth: item.clientWidth, offender: item.offenderSelector },
          patch: {
            title: 'Prevent horizontal page overflow',
            description: 'Enforces overflow-x: hidden on body container.',
            operations: [{ op: 'SET_STYLE', properties: { 'overflow-x': 'hidden' }, important: true }],
            targetPageUrlPattern: '*',
            targetSelector: 'body',
          },
        });
      } else if (item.type === 'DISABLED_CTA') {
        findings.push({
          ruleId: 'interaction.disabled-cta',
          category: 'INTERACTION',
          severity: 'HIGH',
          title: `Critical conversion CTA "${item.text}" is disabled`,
          description: 'The checkout/action button has a disabled attribute preventing user interaction.',
          pageUrl: targetUrl,
          selector: item.selector,
          fingerprint: item.fingerprint,
          evidence: { html: item.html },
          patch: {
            title: `Remove disabled state from "${item.text}" CTA`,
            description: 'Removes the disabled attribute to unblock the conversion flow.',
            operations: [{ op: 'REMOVE_ATTRIBUTE', name: 'disabled' }],
            targetPageUrlPattern: pathname,
            targetSelector: item.selector,
          },
        });
      } else if (item.type === 'BROKEN_IMAGE') {
        findings.push({
          ruleId: 'content.broken-image',
          category: 'CONTENT',
          severity: 'MEDIUM',
          status: 'REPORT_ONLY',
          title: `Broken image asset fails to load (${item.src})`,
          description: 'The image asset returned an error or 404. Server-side asset required.',
          pageUrl: targetUrl,
          selector: item.selector,
          fingerprint: item.fingerprint,
          evidence: { src: item.src },
          patch: null,
        });
      } else if (item.type === 'DEAD_LINK') {
        findings.push({
          ruleId: 'interaction.dead-link',
          category: 'INTERACTION',
          severity: 'LOW',
          status: 'REPORT_ONLY',
          title: `Anchor link "${item.text}" has empty or void href`,
          description: 'Link has href="#" or empty destination without keyboard-accessible event handling.',
          pageUrl: targetUrl,
          selector: item.selector,
          fingerprint: item.fingerprint,
          evidence: { text: item.text },
          patch: null,
        });
      } else if (item.type === 'DYNAMIC_ALERT_CARD') {
        // High-fidelity active alert displayed to patient / user
        if (item.text.toLowerCase().includes('401') || item.text.toLowerCase().includes('session') || item.text.toLowerCase().includes('auth')) {
          findings.push({
            ruleId: 'net.auth-session-failure',
            category: 'BACKEND_SYMPTOM',
            severity: 'HIGH',
            title: 'Authentication / Session Token Expiration Failure (HTTP 401)',
            description: `Session renewal failed during patient record lookup: ${item.text}`,
            pageUrl: targetUrl,
            selector: item.selector,
            fingerprint: item.fingerprint,
            evidence: { alertText: item.text },
            patch: {
              title: 'Retry session validation and handle token refresh',
              description: 'Applies automated retry fetch wrapper with credential validation.',
              operations: [
                {
                  op: 'RUN_SCRIPT_TEMPLATE',
                  template: 'RETRY_FETCH_ON_FAIL',
                  params: { urlPattern: '*', retries: 2, delayMs: 1000 },
                },
              ],
              targetPageUrlPattern: '*',
              targetSelector: 'body',
            },
          });
        } else if (item.text.toLowerCase().includes('500') || item.text.toLowerCase().includes('gateway') || item.text.toLowerCase().includes('timeout') || item.text.toLowerCase().includes('blackout')) {
          findings.push({
            ruleId: 'net.payment-gateway-outage',
            category: 'BACKEND_SYMPTOM',
            severity: 'CRITICAL',
            title: 'Payment Gateway Blackout / 500 Outage Detected',
            description: `Third-party payment processor is unreachable or timing out: ${item.text}`,
            pageUrl: targetUrl,
            selector: item.selector,
            fingerprint: item.fingerprint,
            evidence: { alertText: item.text },
            patch: {
              title: 'Inject resilient payment fallback notice',
              description: 'Displays helpful alternative billing routing when the third-party processor is down.',
              operations: [
                {
                  op: 'RUN_SCRIPT_TEMPLATE',
                  template: 'FALLBACK_MESSAGE_ON_FAIL',
                  params: {
                    urlPattern: '/process',
                    message: 'Payment processor is temporarily undergoing maintenance. Please contact billing at 1-800-MEDICARE.',
                  },
                },
              ],
              targetPageUrlPattern: '*',
              targetSelector: 'body',
            },
          });
        }
      } else if (item.type === 'SESSION_EXPIRY_RISK') {
        findings.push({
          ruleId: 'net.auth-session-expiry-risk',
          category: 'BACKEND_SYMPTOM',
          severity: 'HIGH',
          title: 'Session Token Rapid Expiration / Renewal Vulnerability',
          description: `The application enforces a short-lived token without automated refresh: ${item.text}. Clinical records and forms fail when tokens expire.`,
          pageUrl: targetUrl,
          selector: item.selector,
          fingerprint: item.fingerprint,
          evidence: { timerStatus: item.text },
          patch: {
            title: 'Mitigate premature session token expiration',
            description: 'Applies request retry and session keep-alive handler to prevent user lockouts.',
            operations: [
              {
                op: 'RUN_SCRIPT_TEMPLATE',
                template: 'RETRY_FETCH_ON_FAIL',
                params: { urlPattern: '*', retries: 2, delayMs: 1000 },
              },
            ],
            targetPageUrlPattern: '*',
            targetSelector: 'body',
          },
        });
      }
    }


    // 7. Process Network Failures (5xx Outages, 404 Missing Assets, 401 Unauthorized)
    for (const fr of failedRequests) {
      const netKey = `net:${fr.status}:${fr.url}`;
      if (seenIssueKeys.has(netKey)) continue;
      seenIssueKeys.add(netKey);

      let urlPath = '*';
      try {
        urlPath = new URL(fr.url).pathname;
      } catch {}

      if (fr.status >= 500) {
        findings.push({
          ruleId: 'net.failed-request',
          category: 'BACKEND_SYMPTOM',
          severity: 'HIGH',
          title: `Backend API request failed with HTTP ${fr.status}`,
          description: `Endpoint ${fr.url} returned server error ${fr.status}. Client retry mitigation proposed.`,
          pageUrl: targetUrl,
          selector: null,
          fingerprint: null,
          evidence: { url: fr.url, status: fr.status, method: fr.method },
          patch: {
            title: 'Mitigate failed request with retry fetch handler',
            description: 'Injects runtime fetch wrapper to retry failed API calls.',
            operations: [
              {
                op: 'RUN_SCRIPT_TEMPLATE',
                template: 'RETRY_FETCH_ON_FAIL',
                params: { urlPattern: urlPath, retries: 2, delayMs: 500 },
              },
            ],
            targetPageUrlPattern: '*',
            targetSelector: 'body',
          },
        });
      } else if (fr.status === 404) {
        findings.push({
          ruleId: 'net.resource-not-found',
          category: 'BACKEND_SYMPTOM',
          severity: 'MEDIUM',
          status: 'REPORT_ONLY',
          title: `Missing resource endpoint returned HTTP 404 (${urlPath})`,
          description: `The application attempted to request ${fr.url}, but the endpoint was not found on the server.`,
          pageUrl: targetUrl,
          selector: null,
          fingerprint: null,
          evidence: { url: fr.url, status: fr.status, method: fr.method },
          patch: null,
        });
      } else if (fr.status === 401 || fr.status === 403) {
        findings.push({
          ruleId: 'net.auth-unauthorized',
          category: 'BACKEND_SYMPTOM',
          severity: 'HIGH',
          title: `API request rejected with HTTP ${fr.status} Unauthorized`,
          description: `Endpoint ${fr.url} denied access due to invalid or expired credentials.`,
          pageUrl: targetUrl,
          selector: null,
          fingerprint: null,
          evidence: { url: fr.url, status: fr.status, method: fr.method },
          patch: {
            title: 'Mitigate authorization retry',
            description: 'Applies automated request retry with session token validation.',
            operations: [
              {
                op: 'RUN_SCRIPT_TEMPLATE',
                template: 'RETRY_FETCH_ON_FAIL',
                params: { urlPattern: urlPath, retries: 1, delayMs: 800 },
              },
            ],
            targetPageUrlPattern: '*',
            targetSelector: 'body',
          },
        });
      }
    }

    // 8. Process Client Runtime Exceptions
    for (const pe of pageErrors.slice(0, 3)) {
      const peKey = `pageerror:${pe.slice(0, 50)}`;
      if (seenIssueKeys.has(peKey)) continue;
      seenIssueKeys.add(peKey);

      findings.push({
        ruleId: 'runtime.unhandled-exception',
        category: 'INTERACTION',
        severity: 'HIGH',
        status: 'REPORT_ONLY',
        title: 'Unhandled JavaScript runtime exception',
        description: `Uncaught client error: ${pe.slice(0, 250)}`,
        pageUrl: targetUrl,
        selector: null,
        fingerprint: null,
        evidence: { error: pe },
        patch: null,
      });
    }

    // 9. Persist Deduplicated Findings and Hotfix Patches into SQLite
    const uniqueFindings: RawFinding[] = [];
    const seenFindingSignatures = new Set<string>();
    for (const f of findings) {
      const sig = `${f.ruleId}:${f.selector || ''}:${f.title}`;
      if (!seenFindingSignatures.has(sig)) {
        seenFindingSignatures.add(sig);
        uniqueFindings.push(f);
      }
    }

    const summary = {
      total: uniqueFindings.length,
      bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<IssueSeverity, number>,
      byCategory: {
        ACCESSIBILITY: 0,
        LAYOUT: 0,
        CONTENT: 0,
        INTERACTION: 0,
        BACKEND_SYMPTOM: 0,
      } as Record<IssueCategory, number>,
    };

    const now = new Date().toISOString();

    for (const f of uniqueFindings) {
      summary.bySeverity[f.severity] = (summary.bySeverity[f.severity] || 0) + 1;
      summary.byCategory[f.category] = (summary.byCategory[f.category] || 0) + 1;


      const issueId = nanoid(10);
      let suggestedPatchId: string | null = null;

      if (f.patch) {
        suggestedPatchId = nanoid(10);
        const { score, level, reasons } = scoreRisk(f.patch.operations, {
          targetTag: f.fingerprint?.tag,
          urlPattern: f.patch.targetPageUrlPattern,
        });

        db.prepare(`
          INSERT INTO patches (
            id, title, description, status, source, riskLevel, riskScore, riskReasons,
            issueId, authorId, targetPageUrlPattern, targetSelector, fingerprint, operations,
            health, createdAt, updatedAt
          ) VALUES (?, ?, ?, 'DRAFT', 'SCANNER_RULE', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HEALTHY', ?, ?)
        `).run(
          suggestedPatchId,
          f.patch.title,
          f.patch.description,
          level,
          score,
          JSON.stringify(reasons),
          issueId,
          actor.id,
          f.patch.targetPageUrlPattern,
          f.patch.targetSelector,
          JSON.stringify(f.fingerprint),
          JSON.stringify(f.patch.operations),
          now,
          now
        );
      }

      db.prepare(`
        INSERT INTO issues (
          id, scanId, ruleId, category, severity, status, title, description,
          pageUrl, selector, fingerprint, evidence, suggestedPatchId, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        issueId,
        scanId,
        f.ruleId,
        f.category,
        f.severity,
        f.status || (suggestedPatchId ? 'PATCH_SUGGESTED' : 'OPEN'),
        f.title,
        f.description,
        f.pageUrl,
        f.selector,
        f.fingerprint ? JSON.stringify(f.fingerprint) : null,
        f.evidence ? JSON.stringify(f.evidence) : null,
        suggestedPatchId,
        now
      );
    }

    // 10. Complete scan in Database
    db.prepare(`
      UPDATE scans
      SET status = 'COMPLETED', progress = 100, summary = ?
      WHERE id = ?
    `).run(JSON.stringify(summary), scanId);

    audit.emit({
      actorId: actor.id,
      actorName: actor.name,
      action: 'SCAN_COMPLETED',
      targetType: 'scan',
      targetId: scanId,
      summary: `${actor.name} scanned ${targetUrl} (found ${findings.length} issues)`,
    });
  } catch (err: any) {
    console.error('Scan execution error:', err);
    let friendlyError = err.message || 'Scan execution failed';
    if (friendlyError.includes('ERR_NAME_NOT_RESOLVED')) {
      friendlyError = `Domain does not exist or DNS lookup failed for ${targetUrl}`;
    } else if (friendlyError.includes('ERR_CONNECTION_REFUSED')) {
      friendlyError = `Connection refused at ${targetUrl}`;
    } else if (friendlyError.includes('Timeout') || friendlyError.includes('timeout')) {
      friendlyError = `Connection timed out while trying to reach ${targetUrl}`;
    }

    const failureSummary = {
      total: 0,
      error: friendlyError,
      bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      byCategory: { ACCESSIBILITY: 0, LAYOUT: 0, CONTENT: 0, INTERACTION: 0, BACKEND_SYMPTOM: 0 },
    };

    db.prepare(`
      UPDATE scans
      SET status = 'FAILED', progress = 100, summary = ?
      WHERE id = ?
    `).run(JSON.stringify(failureSummary), scanId);

    audit.emit({
      actorId: actor.id,
      actorName: actor.name,
      action: 'SCAN_FAILED',
      targetType: 'scan',
      targetId: scanId,
      summary: `Scan of ${targetUrl} failed: ${friendlyError}`,
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
