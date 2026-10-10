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
  let browser;
  const targetUrl = normalizeScanUrl(rawUrl);

  try {
    // Launch browser (chromium or edge fallback)
    try {
      browser = await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ channel: 'msedge', headless: true });
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 PatchworkScanner/1.0',
    });

    const page = await context.newPage();
    const findings: RawFinding[] = [];
    const failedRequests: { url: string; status: number }[] = [];
    const consoleErrors: string[] = [];

    // Track failed HTTP network requests (5xx)
    page.on('response', (response) => {
      const status = response.status();
      if (status >= 500) {
        failedRequests.push({ url: response.url(), status });
      }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Update progress: 20%
    db.prepare('UPDATE scans SET progress = 20, url = ? WHERE id = ?').run(targetUrl, scanId);

    // Navigate to target URL
    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const currentUrl = page.url();
    if (!response || currentUrl.startsWith('chrome-error://') || currentUrl === 'about:blank') {
      throw new Error(`Unable to reach ${targetUrl}. The domain could not be resolved or the server is offline.`);
    }
    await page.waitForTimeout(2000); // Allow dynamic scripts and fonts to settle

    // Update progress: 40%
    db.prepare('UPDATE scans SET progress = 40 WHERE id = ?').run(scanId);

    // Capture viewport screenshot
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

    // Update progress: 60%
    db.prepare('UPDATE scans SET progress = 60 WHERE id = ?').run(scanId);

    // 1. Run Axe Accessibility Audit with expanded rules
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

      const pathname = new URL(targetUrl).pathname || '*';

      for (const violation of axeResults.violations) {
        // Cap duplicate findings per violation type to avoid flooding
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
                operations: [{ op: 'SET_ATTRIBUTE', name: 'aria-label', value: 'Search or Input Field' }],
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
              patch: null, // Structural / semantic report-only
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

    // Update progress: 80%
    db.prepare('UPDATE scans SET progress = 80 WHERE id = ?').run(scanId);

    // 2. Run Custom In-Page Rules with robust selector generator
    const customFindings = await page.evaluate(() => {
      const results: any[] = [];

      function getUniqueSelector(el: Element): string {
        if (el.id) return `#${CSS.escape(el.id)}`;
        if (el === document.body) return 'body';
        if (el === document.documentElement) return 'html';

        let path = '';
        let curr: Element | null = el;
        while (curr && curr !== document.body) {
          let segment = curr.tagName.toLowerCase();
          if (curr.id) {
            segment += `#${CSS.escape(curr.id)}`;
            path = segment + (path ? ` > ${path}` : '');
            break;
          }
          const parent = curr.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter((c) => c.tagName === curr!.tagName);
            if (siblings.length > 1) {
              const index = siblings.indexOf(curr) + 1;
              segment += `:nth-of-type(${index})`;
            }
          }
          path = segment + (path ? ` > ${path}` : '');
          curr = curr.parentElement;
        }
        return path || el.tagName.toLowerCase();
      }

      // 1. Check disabled CTA
      const ctas = document.querySelectorAll('button, input[type="submit"], a.btn, a[class*="button"]');
      const ctaRegex = /buy|checkout|pay|order|submit|sign up|add to cart|continue/i;
      ctas.forEach((el) => {
        const text = (el.textContent || (el as HTMLInputElement).value || '').trim();
        if (ctaRegex.test(text)) {
          const isDisabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
          if (isDisabled) {
            results.push({
              type: 'DISABLED_CTA',
              selector: getUniqueSelector(el),
              html: el.outerHTML.slice(0, 300),
              text,
            });
          }
        }
      });

      // 2. Check broken images (strictly filter out empty, data URI, or hidden/tracking pixels)
      const images = document.querySelectorAll('img');
      images.forEach((img) => {
        const srcAttr = img.getAttribute('src');
        if (
          srcAttr &&
          srcAttr.trim().length > 0 &&
          !srcAttr.startsWith('data:') &&
          img.complete &&
          img.naturalWidth === 0
        ) {
          const style = window.getComputedStyle(img);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            results.push({
              type: 'BROKEN_IMAGE',
              src: img.src,
              selector: getUniqueSelector(img),
            });
          }
        }
      });

      // 3. Check horizontal viewport overflow
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 10) {
        results.push({
          type: 'HORIZONTAL_OVERFLOW',
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        });
      }

      return results;
    }).catch(() => []);

    for (const cf of customFindings) {
      if (cf.type === 'DISABLED_CTA') {
        findings.push({
          ruleId: 'interaction.disabled-cta',
          category: 'INTERACTION',
          severity: 'CRITICAL',
          title: `Critical conversion CTA "${cf.text}" is disabled`,
          description: 'The checkout/conversion button has a disabled attribute preventing user interaction.',
          pageUrl: targetUrl,
          selector: cf.selector,
          fingerprint: {
            cssSelector: cf.selector,
            domPath: cf.selector,
            tag: 'button',
            classes: [],
            attributes: { disabled: 'true' },
            textContent: cf.text,
            nearbyText: [],
            ancestors: [],
            rect: { x: 0, y: 0, width: 200, height: 48 },
          },
          evidence: { html: cf.html },
          patch: {
            title: `Remove disabled state from "${cf.text}" CTA`,
            description: 'Removes the disabled attribute to unblock the conversion flow.',
            operations: [{ op: 'REMOVE_ATTRIBUTE', name: 'disabled' }],
            targetPageUrlPattern: new URL(targetUrl).pathname || '*',
            targetSelector: cf.selector,
          },
        });
      } else if (cf.type === 'BROKEN_IMAGE') {
        findings.push({
          ruleId: 'content.broken-image',
          category: 'CONTENT',
          severity: 'MEDIUM',
          status: 'REPORT_ONLY',
          title: `Broken image asset fails to load (${cf.src})`,
          description: 'The image asset returned an error or 404. Server-side asset required.',
          pageUrl: targetUrl,
          selector: cf.selector,
          fingerprint: null,
          evidence: { src: cf.src },
          patch: null,
        });
      } else if (cf.type === 'HORIZONTAL_OVERFLOW') {
        findings.push({
          ruleId: 'layout.horizontal-overflow',
          category: 'LAYOUT',
          severity: 'MEDIUM',
          title: 'Page content causes horizontal scrollbar',
          description: `Document scrollWidth (${cf.scrollWidth}px) exceeds viewport clientWidth (${cf.clientWidth}px).`,
          pageUrl: targetUrl,
          selector: 'body',
          fingerprint: null,
          evidence: { scrollWidth: cf.scrollWidth, clientWidth: cf.clientWidth },
          patch: {
            title: 'Prevent horizontal page overflow',
            description: 'Enforces overflow-x: hidden on body container.',
            operations: [{ op: 'SET_STYLE', properties: { 'overflow-x': 'hidden' } }],
            targetPageUrlPattern: '*',
            targetSelector: 'body',
          },
        });
      }
    }

    // 3. Network Failed Requests (Backend Symptoms)
    for (const fr of failedRequests) {
      findings.push({
        ruleId: 'net.failed-request',
        category: 'BACKEND_SYMPTOM',
        severity: 'HIGH',
        title: `Backend API request failed with HTTP ${fr.status}`,
        description: `Endpoint ${fr.url} returned server error ${fr.status}. Client retry mitigation proposed.`,
        pageUrl: targetUrl,
        selector: null,
        fingerprint: null,
        evidence: { url: fr.url, status: fr.status },
        patch: {
          title: 'Mitigate failed request with retry fetch handler',
          description: 'Injects runtime fetch wrapper to retry failed API calls.',
          operations: [
            {
              op: 'RUN_SCRIPT_TEMPLATE',
              template: 'RETRY_FETCH_ON_FAIL',
              params: { urlPattern: new URL(fr.url).pathname, retries: 2, delayMs: 500 },
            },
          ],
          targetPageUrlPattern: '*',
          targetSelector: 'body',
        },
      });
    }

    // Insert findings and patches into SQLite
    const summary = {
      total: findings.length,
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

    for (const f of findings) {
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

    // Complete scan
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
