/**
 * Playwright MCP Integration for Bug Reproduction
 *
 * Provides recording, replay, and self-healing test capabilities
 * for deterministic bug reproduction.
 */

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
  type Locator,
} from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';

// ============================================================================
// Types & Schemas
// ============================================================================

/**
 * Action types that can be recorded and replayed
 */
export enum ActionType {
  NAVIGATE = 'navigate',
  CLICK = 'click',
  FILL = 'fill',
  SELECT = 'select',
  HOVER = 'hover',
  SCROLL = 'scroll',
  SCREENSHOT = 'screenshot',
  WAIT = 'wait',
  ASSERT = 'assert',
}

/**
 * Element fingerprint for self-healing locators
 */
export interface ElementFingerprint {
  /** Primary CSS selector */
  selector: string;
  /** XPath fallback */
  xpath?: string;
  /** Text content for matching */
  textContent?: string;
  /** Aria label if available */
  ariaLabel?: string;
  /** Test ID if available */
  testId?: string;
  /** Placeholder text for inputs */
  placeholder?: string;
  /** Element tag name */
  tagName: string;
  /** Nearby landmark elements */
  landmarks?: string[];
  /** Data attributes */
  dataAttributes?: Record<string, string>;
}

/**
 * A recorded action with metadata
 */
export interface RecordedAction {
  /** Unique action ID */
  id: string;
  /** Type of action */
  type: ActionType;
  /** Timestamp when recorded */
  timestamp: number;
  /** Element fingerprint for self-healing */
  fingerprint?: ElementFingerprint;
  /** Action-specific parameters */
  params: Record<string, unknown>;
  /** Screenshot before action (base64 or path) */
  screenshotBefore?: string;
  /** Screenshot after action */
  screenshotAfter?: string;
  /** Duration of action in ms */
  duration?: number;
}

/**
 * A recorded session containing multiple actions
 */
export interface RecordedSession {
  /** Session ID */
  id: string;
  /** Starting URL */
  startUrl: string;
  /** When recording started */
  startTime: number;
  /** When recording ended */
  endTime?: number;
  /** Viewport size */
  viewport: { width: number; height: number };
  /** User agent */
  userAgent: string;
  /** Recorded actions */
  actions: RecordedAction[];
  /** HAR file path */
  harPath?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Replay result for a single action
 */
export interface ActionReplayResult {
  actionId: string;
  success: boolean;
  /** Which locator strategy succeeded */
  locatorUsed?: string;
  /** If self-healing was needed */
  selfHealed?: boolean;
  /** Error message if failed */
  error?: string;
  /** Time taken to replay */
  duration: number;
}

/**
 * Full replay result
 */
export interface ReplayResult {
  sessionId: string;
  success: boolean;
  /** Individual action results */
  actionResults: ActionReplayResult[];
  /** Total duration */
  totalDuration: number;
  /** Number of self-healed actions */
  selfHealedCount: number;
  /** Detected issues during replay */
  issues: ReplayIssue[];
}

/**
 * Issue detected during replay
 */
export interface ReplayIssue {
  type: 'element_not_found' | 'action_failed' | 'timing_diff' | 'visual_diff';
  actionId: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  details?: Record<string, unknown>;
}

// Zod schemas for validation
export const ElementFingerprintSchema = z.object({
  selector: z.string(),
  xpath: z.string().optional(),
  textContent: z.string().optional(),
  ariaLabel: z.string().optional(),
  testId: z.string().optional(),
  placeholder: z.string().optional(),
  tagName: z.string(),
  landmarks: z.array(z.string()).optional(),
  dataAttributes: z.record(z.string()).optional(),
});

export const RecordedActionSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(ActionType),
  timestamp: z.number(),
  fingerprint: ElementFingerprintSchema.optional(),
  params: z.record(z.unknown()),
  screenshotBefore: z.string().optional(),
  screenshotAfter: z.string().optional(),
  duration: z.number().optional(),
});

export const RecordedSessionSchema = z.object({
  id: z.string(),
  startUrl: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
  viewport: z.object({ width: z.number(), height: z.number() }),
  userAgent: z.string(),
  actions: z.array(RecordedActionSchema),
  harPath: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Element Fingerprinting
// ============================================================================

/**
 * Create a fingerprint for an element that enables self-healing locators
 */
export async function createElementFingerprint(
  page: Page,
  selector: string
): Promise<ElementFingerprint | null> {
  try {
    const element = page.locator(selector).first();
    const isVisible = await element.isVisible().catch(() => false);

    if (!isVisible) {
      return null;
    }

    // Use page.evaluate to run DOM operations in browser context
    const fingerprint = await element.evaluate((el: Element): ElementFingerprint => {
      // Helper to get unique selector
      const getSelector = (element: Element): string => {
        if (element.id) {
          return `#${element.id}`;
        }
        const classes = Array.from(element.classList).join('.');
        if (classes) {
          return `${element.tagName.toLowerCase()}.${classes}`;
        }
        return element.tagName.toLowerCase();
      };

      // Get XPath
      const getXPath = (element: Element): string => {
        const parts: string[] = [];
        let current: Element | null = element;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let index = 1;
          let sibling: Element | null = current.previousElementSibling;

          while (sibling) {
            if (sibling.tagName === current.tagName) {
              index++;
            }
            sibling = sibling.previousElementSibling;
          }

          const tagName = current.tagName.toLowerCase();
          const part = index > 1 ? `${tagName}[${index}]` : tagName;
          parts.unshift(part);
          current = current.parentElement;
        }

        return '/' + parts.join('/');
      };

      // Get data attributes
      const dataAttrs: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('data-')) {
          dataAttrs[attr.name] = attr.value;
        }
      }

      // Get nearby landmarks
      const landmarks: string[] = [];
      const nearbyElements = el.parentElement?.querySelectorAll(
        '[role], [aria-label], h1, h2, h3, nav, main, aside, footer, header'
      );
      if (nearbyElements) {
        for (const landmark of Array.from(nearbyElements).slice(0, 3)) {
          const role = landmark.getAttribute('role');
          const ariaLabel = landmark.getAttribute('aria-label');
          if (role || ariaLabel) {
            landmarks.push(
              `${landmark.tagName.toLowerCase()}[${role || ariaLabel}]`
            );
          }
        }
      }

      // Check if element is an input for placeholder
      const isInput = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

      return {
        selector: getSelector(el),
        xpath: getXPath(el),
        textContent: el.textContent?.trim().slice(0, 100) || undefined,
        ariaLabel: el.getAttribute('aria-label') || undefined,
        testId:
          el.getAttribute('data-testid') ||
          el.getAttribute('data-test-id') ||
          undefined,
        placeholder: isInput ? (el as HTMLInputElement).placeholder || undefined : undefined,
        tagName: el.tagName.toLowerCase(),
        landmarks: landmarks.length > 0 ? landmarks : undefined,
        dataAttributes: Object.keys(dataAttrs).length > 0 ? dataAttrs : undefined,
      };
    });

    return fingerprint;
  } catch {
    return null;
  }
}

// ============================================================================
// Self-Healing Locator
// ============================================================================

/**
 * Attempts to find an element using multiple strategies
 * Returns the first successful locator
 */
export async function findElementWithHealing(
  page: Page,
  fingerprint: ElementFingerprint
): Promise<{ locator: Locator; strategy: string } | null> {
  const strategies: Array<{ name: string; getLocator: () => Locator | null }> = [
    // 1. Test ID (most stable)
    {
      name: 'testId',
      getLocator: () => {
        const testId = fingerprint.testId || fingerprint.dataAttributes?.['data-testid'];
        return testId ? page.getByTestId(testId) : null;
      },
    },
    // 2. Aria label
    {
      name: 'ariaLabel',
      getLocator: () => {
        return fingerprint.ariaLabel ? page.getByLabel(fingerprint.ariaLabel) : null;
      },
    },
    // 3. Placeholder (for inputs)
    {
      name: 'placeholder',
      getLocator: () => {
        return fingerprint.placeholder ? page.getByPlaceholder(fingerprint.placeholder) : null;
      },
    },
    // 4. Text content
    {
      name: 'text',
      getLocator: () => {
        return fingerprint.textContent
          ? page.getByText(fingerprint.textContent, { exact: false })
          : null;
      },
    },
    // 5. Original selector
    {
      name: 'selector',
      getLocator: () => page.locator(fingerprint.selector),
    },
    // 6. XPath fallback
    {
      name: 'xpath',
      getLocator: () => {
        return fingerprint.xpath ? page.locator(`xpath=${fingerprint.xpath}`) : null;
      },
    },
  ];

  for (const strategy of strategies) {
    try {
      const locator = strategy.getLocator();
      if (!locator) continue;

      const isVisible = await locator.first().isVisible({ timeout: 1000 }).catch(() => false);

      if (isVisible) {
        return { locator: locator.first(), strategy: strategy.name };
      }
    } catch {
      // Strategy failed, try next
    }
  }

  return null;
}

// ============================================================================
// Recording Session
// ============================================================================

export interface RecorderOptions {
  /** Output directory for recordings */
  outputDir: string;
  /** Whether to capture screenshots */
  screenshots?: boolean;
  /** Whether to record HAR */
  recordHar?: boolean;
  /** Viewport size */
  viewport?: { width: number; height: number };
  /** Headless mode */
  headless?: boolean;
}

/**
 * Session recorder for capturing user interactions
 */
export class SessionRecorder {
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private session?: RecordedSession;
  private options: Required<RecorderOptions>;
  private actionCounter = 0;

  constructor(options: RecorderOptions) {
    this.options = {
      outputDir: options.outputDir,
      screenshots: options.screenshots ?? true,
      recordHar: options.recordHar ?? true,
      viewport: options.viewport ?? { width: 1280, height: 720 },
      headless: options.headless ?? false, // Show browser for manual recording
    };
  }

  /**
   * Start a recording session
   */
  async start(startUrl: string): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sessionDir = path.join(this.options.outputDir, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    // Launch browser
    this.browser = await chromium.launch({ headless: this.options.headless });

    // Create context with HAR recording
    const contextOptions: {
      viewport: { width: number; height: number };
      recordHar?: { path: string; mode: 'minimal' | 'full' };
    } = {
      viewport: this.options.viewport,
    };

    if (this.options.recordHar) {
      contextOptions.recordHar = {
        path: path.join(sessionDir, 'recording.har'),
        mode: 'full',
      };
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();

    // Initialize session
    this.session = {
      id: sessionId,
      startUrl,
      startTime: Date.now(),
      viewport: this.options.viewport,
      userAgent: await this.page.evaluate(() => navigator.userAgent),
      actions: [],
      harPath: this.options.recordHar
        ? path.join(sessionDir, 'recording.har')
        : undefined,
    };

    // Set up event listeners for automatic recording
    await this.setupEventListeners();

    // Navigate to start URL and record it
    await this.recordAction(ActionType.NAVIGATE, { url: startUrl });
    await this.page.goto(startUrl, { waitUntil: 'networkidle' });

    return sessionId;
  }

  /**
   * Set up listeners for automatic action recording
   */
  private async setupEventListeners(): Promise<void> {
    if (!this.page) return;

    // Inject recording script
    await this.page.exposeFunction(
      '__recordAction',
      async (action: RecordedAction) => {
        if (this.session) {
          this.session.actions.push(action);
        }
      }
    );

    // Add client-side recording script
    await this.page.addInitScript(() => {
      const recordAction = (
        window as unknown as { __recordAction: (action: unknown) => void }
      ).__recordAction;

      document.addEventListener('click', (e) => {
        const target = e.target as Element;
        if (!target) return;

        recordAction({
          id: `action-${Date.now()}`,
          type: 'click',
          timestamp: Date.now(),
          params: {
            x: e.clientX,
            y: e.clientY,
            selector: target.id ? `#${target.id}` : target.tagName.toLowerCase(),
          },
        });
      });

      document.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        if (!target) return;

        recordAction({
          id: `action-${Date.now()}`,
          type: 'fill',
          timestamp: Date.now(),
          params: {
            value: target.value,
            selector: target.id ? `#${target.id}` : target.tagName.toLowerCase(),
          },
        });
      });
    });
  }

  /**
   * Record an action manually
   */
  async recordAction(
    type: ActionType,
    params: Record<string, unknown>,
    selector?: string
  ): Promise<RecordedAction> {
    if (!this.page || !this.session) {
      throw new Error('Recording session not started');
    }

    const actionId = `action-${++this.actionCounter}`;
    const startTime = Date.now();

    // Create fingerprint if selector provided
    let fingerprint: ElementFingerprint | undefined;
    if (selector) {
      fingerprint =
        (await createElementFingerprint(this.page, selector)) ?? undefined;
    }

    // Take screenshot before if enabled
    let screenshotBefore: string | undefined;
    if (this.options.screenshots) {
      const screenshotPath = path.join(
        this.options.outputDir,
        this.session.id,
        `${actionId}-before.png`
      );
      await this.page.screenshot({ path: screenshotPath });
      screenshotBefore = screenshotPath;
    }

    const action: RecordedAction = {
      id: actionId,
      type,
      timestamp: startTime,
      fingerprint,
      params,
      screenshotBefore,
    };

    this.session.actions.push(action);
    return action;
  }

  /**
   * Perform and record a click action
   */
  async click(selector: string): Promise<void> {
    if (!this.page) throw new Error('Session not started');

    const action = await this.recordAction(ActionType.CLICK, { selector }, selector);
    const startTime = Date.now();

    await this.page.locator(selector).click();

    action.duration = Date.now() - startTime;

    if (this.options.screenshots && this.session) {
      const screenshotPath = path.join(
        this.options.outputDir,
        this.session.id,
        `${action.id}-after.png`
      );
      await this.page.screenshot({ path: screenshotPath });
      action.screenshotAfter = screenshotPath;
    }
  }

  /**
   * Perform and record a fill action
   */
  async fill(selector: string, value: string): Promise<void> {
    if (!this.page) throw new Error('Session not started');

    const action = await this.recordAction(
      ActionType.FILL,
      { selector, value },
      selector
    );
    const startTime = Date.now();

    await this.page.locator(selector).fill(value);

    action.duration = Date.now() - startTime;
  }

  /**
   * Take a screenshot and record it
   */
  async screenshot(name?: string): Promise<string> {
    if (!this.page || !this.session) throw new Error('Session not started');

    const filename = name || `screenshot-${Date.now()}.png`;
    const screenshotPath = path.join(
      this.options.outputDir,
      this.session.id,
      filename
    );

    await this.page.screenshot({ path: screenshotPath, fullPage: true });

    await this.recordAction(ActionType.SCREENSHOT, { path: screenshotPath });

    return screenshotPath;
  }

  /**
   * Stop recording and save session
   */
  async stop(): Promise<RecordedSession> {
    if (!this.session) {
      throw new Error('No recording session to stop');
    }

    this.session.endTime = Date.now();

    // Close context to finalize HAR
    if (this.context) {
      await this.context.close();
      this.context = undefined;
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }

    // Save session to file
    const sessionPath = path.join(
      this.options.outputDir,
      this.session.id,
      'session.json'
    );
    await fs.writeFile(sessionPath, JSON.stringify(this.session, null, 2));

    const session = this.session;
    this.session = undefined;
    this.page = undefined;

    return session;
  }

  /**
   * Get current page for manual operations
   */
  getPage(): Page {
    if (!this.page) throw new Error('Session not started');
    return this.page;
  }
}

// ============================================================================
// Session Replayer
// ============================================================================

export interface ReplayerOptions {
  /** Allow self-healing of locators */
  selfHealing?: boolean;
  /** Timeout for each action */
  actionTimeout?: number;
  /** Slow down replay for debugging */
  slowMo?: number;
  /** Headless mode */
  headless?: boolean;
  /** Output directory for replay artifacts */
  outputDir?: string;
}

/**
 * Replays recorded sessions with self-healing capabilities
 */
export class SessionReplayer {
  private options: Required<ReplayerOptions>;

  constructor(options: ReplayerOptions = {}) {
    this.options = {
      selfHealing: options.selfHealing ?? true,
      actionTimeout: options.actionTimeout ?? 10000,
      slowMo: options.slowMo ?? 0,
      headless: options.headless ?? true,
      outputDir: options.outputDir ?? process.cwd(),
    };
  }

  /**
   * Load a session from file
   */
  async loadSession(sessionPath: string): Promise<RecordedSession> {
    const content = await fs.readFile(sessionPath, 'utf-8');
    return RecordedSessionSchema.parse(JSON.parse(content));
  }

  /**
   * Replay a recorded session
   */
  async replay(session: RecordedSession): Promise<ReplayResult> {
    const startTime = Date.now();
    const actionResults: ActionReplayResult[] = [];
    const issues: ReplayIssue[] = [];
    let selfHealedCount = 0;

    const browser = await chromium.launch({
      headless: this.options.headless,
      slowMo: this.options.slowMo,
    });

    const contextOptions: {
      viewport: { width: number; height: number };
    } = {
      viewport: session.viewport,
    };

    // Use HAR for network replay if available
    const context = await browser.newContext(contextOptions);

    if (session.harPath) {
      try {
        await context.routeFromHAR(session.harPath, {
          url: '**/*',
          notFound: 'fallback',
          update: false,
        });
      } catch (error) {
        issues.push({
          type: 'action_failed',
          actionId: 'har-setup',
          message: `Failed to load HAR: ${error instanceof Error ? error.message : String(error)}`,
          severity: 'warning',
        });
      }
    }

    const page = await context.newPage();

    try {
      for (const action of session.actions) {
        const result = await this.replayAction(page, action, issues);
        actionResults.push(result);

        if (result.selfHealed) {
          selfHealedCount++;
        }
      }
    } finally {
      await context.close();
      await browser.close();
    }

    const totalDuration = Date.now() - startTime;
    const success = actionResults.every((r) => r.success);

    return {
      sessionId: session.id,
      success,
      actionResults,
      totalDuration,
      selfHealedCount,
      issues,
    };
  }

  /**
   * Replay a single action
   */
  private async replayAction(
    page: Page,
    action: RecordedAction,
    issues: ReplayIssue[]
  ): Promise<ActionReplayResult> {
    const startTime = Date.now();
    let success = false;
    let locatorUsed: string | undefined;
    let selfHealed = false;
    let error: string | undefined;

    try {
      switch (action.type) {
        case ActionType.NAVIGATE: {
          const url = action.params.url as string;
          await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: this.options.actionTimeout,
          });
          success = true;
          break;
        }

        case ActionType.CLICK: {
          const selector = action.params.selector as string;

          // Try direct selector first
          try {
            await page
              .locator(selector)
              .click({ timeout: this.options.actionTimeout / 2 });
            success = true;
            locatorUsed = 'selector';
          } catch {
            // Try self-healing if enabled and fingerprint available
            if (this.options.selfHealing && action.fingerprint) {
              const healed = await findElementWithHealing(page, action.fingerprint);
              if (healed) {
                await healed.locator.click({
                  timeout: this.options.actionTimeout / 2,
                });
                success = true;
                selfHealed = true;
                locatorUsed = healed.strategy;
              }
            }
          }

          if (!success) {
            issues.push({
              type: 'element_not_found',
              actionId: action.id,
              message: `Could not find element: ${selector}`,
              severity: 'critical',
              details: { fingerprint: action.fingerprint },
            });
          }
          break;
        }

        case ActionType.FILL: {
          const selector = action.params.selector as string;
          const value = action.params.value as string;

          try {
            await page
              .locator(selector)
              .fill(value, { timeout: this.options.actionTimeout / 2 });
            success = true;
            locatorUsed = 'selector';
          } catch {
            if (this.options.selfHealing && action.fingerprint) {
              const healed = await findElementWithHealing(page, action.fingerprint);
              if (healed) {
                await healed.locator.fill(value, {
                  timeout: this.options.actionTimeout / 2,
                });
                success = true;
                selfHealed = true;
                locatorUsed = healed.strategy;
              }
            }
          }
          break;
        }

        case ActionType.HOVER: {
          const selector = action.params.selector as string;
          await page.locator(selector).hover({ timeout: this.options.actionTimeout });
          success = true;
          break;
        }

        case ActionType.SCROLL: {
          const x = (action.params.x as number) || 0;
          const y = (action.params.y as number) || 0;
          await page.evaluate(({ x, y }) => window.scrollTo(x, y), { x, y });
          success = true;
          break;
        }

        case ActionType.WAIT: {
          const ms = (action.params.ms as number) || 1000;
          await page.waitForTimeout(ms);
          success = true;
          break;
        }

        case ActionType.SCREENSHOT: {
          // Screenshots during replay are informational
          success = true;
          break;
        }

        case ActionType.SELECT: {
          const selector = action.params.selector as string;
          const value = action.params.value as string;
          await page.locator(selector).selectOption(value, {
            timeout: this.options.actionTimeout,
          });
          success = true;
          break;
        }

        case ActionType.ASSERT: {
          // Handle assertions
          const assertion = action.params.assertion as string;
          const selector = action.params.selector as string;

          if (assertion === 'visible') {
            const isVisible = await page
              .locator(selector)
              .isVisible({ timeout: this.options.actionTimeout });
            success = isVisible;
            if (!success) {
              error = `Element not visible: ${selector}`;
            }
          }
          break;
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      issues.push({
        type: 'action_failed',
        actionId: action.id,
        message: error,
        severity: 'critical',
      });
    }

    return {
      actionId: action.id,
      success,
      locatorUsed,
      selfHealed,
      error,
      duration: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Bug Reproduction Automation
// ============================================================================

export interface ReproductionConfig {
  /** Session or HAR path */
  recordingPath: string;
  /** Number of replay attempts */
  attempts?: number;
  /** Output directory */
  outputDir?: string;
  /** Enable self-healing */
  selfHealing?: boolean;
}

export interface ReproductionResult {
  /** Whether bug was reproduced */
  reproduced: boolean;
  /** Confidence score (0-100) */
  confidence: number;
  /** Successful replay attempts */
  successfulAttempts: number;
  /** Total attempts */
  totalAttempts: number;
  /** Replay results */
  replayResults: ReplayResult[];
  /** Self-healed locators */
  selfHealedLocators: Array<{
    actionId: string;
    originalSelector: string;
    healedStrategy: string;
  }>;
}

/**
 * Automates bug reproduction using recorded sessions
 */
export async function reproduceBug(
  config: ReproductionConfig
): Promise<ReproductionResult> {
  const attempts = config.attempts ?? 3;
  const outputDir = config.outputDir ?? process.cwd();
  const replayResults: ReplayResult[] = [];
  const selfHealedLocators: ReproductionResult['selfHealedLocators'] = [];

  // Load session
  const replayer = new SessionReplayer({
    selfHealing: config.selfHealing ?? true,
    outputDir,
    headless: true,
  });

  const session = await replayer.loadSession(config.recordingPath);

  // Run multiple replay attempts
  for (let i = 0; i < attempts; i++) {
    console.log(`Replay attempt ${i + 1}/${attempts}...`);

    const result = await replayer.replay(session);
    replayResults.push(result);

    // Track self-healed locators
    for (const actionResult of result.actionResults) {
      if (actionResult.selfHealed) {
        const action = session.actions.find((a) => a.id === actionResult.actionId);
        if (action) {
          selfHealedLocators.push({
            actionId: actionResult.actionId,
            originalSelector: (action.params.selector as string) || 'unknown',
            healedStrategy: actionResult.locatorUsed || 'unknown',
          });
        }
      }
    }
  }

  // Calculate reproduction metrics
  const successfulAttempts = replayResults.filter((r) => r.success).length;
  const reproduced = successfulAttempts > 0;

  // Confidence is based on:
  // - Success rate
  // - Self-healing rate (lower = more stable)
  // - Issue consistency
  const successRate = successfulAttempts / attempts;
  const avgSelfHealed =
    replayResults.reduce((sum, r) => sum + r.selfHealedCount, 0) / attempts;
  const selfHealPenalty = Math.min(avgSelfHealed * 5, 20); // Max 20% penalty

  const confidence = Math.round(successRate * 100 - selfHealPenalty);

  return {
    reproduced,
    confidence: Math.max(0, confidence),
    successfulAttempts,
    totalAttempts: attempts,
    replayResults,
    selfHealedLocators,
  };
}
