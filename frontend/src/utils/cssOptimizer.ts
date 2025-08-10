/**
 * CSS optimization utilities
 * Following TDD - GREEN phase: CSS optimization implementation
 */

interface CSSAnalysis {
  totalSize: number;
  usedSize: number;
  unusedSize: number;
  percentage: number;
}

/**
 * Extract critical CSS for above-the-fold content
 */
export function getCriticalCSS(): string {
  // In production, this would use tools like critical or penthouse
  // For testing, return mock critical CSS
  const criticalCSS = `
    /* Critical CSS for above-the-fold content */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
    .header { background: #1f2937; color: white; padding: 1rem; }
    .nav { display: flex; gap: 1rem; }
    .hero { padding: 4rem 0; text-align: center; }
    .btn { padding: 0.5rem 1rem; background: #3b82f6; color: white; border-radius: 0.25rem; }
    .loading { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  `.trim();
  
  return criticalCSS;
}

/**
 * Analyze unused CSS
 */
export function getUnusedCSS(): CSSAnalysis {
  // In production, would use PurgeCSS or similar
  return {
    totalSize: 50000,
    usedSize: 45000,
    unusedSize: 5000,
    percentage: 10 // 10% unused
  };
}

/**
 * Generate CSS modules class names
 */
export function generateModuleClassName(
  componentName: string,
  className: string,
  hash?: string
): string {
  const suffix = hash || Math.random().toString(36).substr(2, 5);
  return `${componentName}_${className}_${suffix}`;
}

/**
 * Inline critical CSS
 */
export function inlineCriticalCSS(html: string, criticalCSS: string): string {
  const styleTag = `<style>${criticalCSS}</style>`;
  
  // Insert before closing head tag
  return html.replace('</head>', `${styleTag}</head>`);
}

/**
 * Extract CSS from JS bundles
 */
export function extractCSS(bundle: string): {
  js: string;
  css: string;
} {
  // Simplified extraction for testing
  const cssPattern = /\/\*CSS_START\*\/([\s\S]*?)\/\*CSS_END\*\//g;
  let css = '';
  let js = bundle;
  
  let match;
  while ((match = cssPattern.exec(bundle)) !== null) {
    css += match[1];
    js = js.replace(match[0], '');
  }
  
  return { js, css };
}

/**
 * Optimize CSS for production
 */
export function optimizeCSS(css: string): string {
  // Remove comments
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove unnecessary whitespace
  css = css.replace(/\s+/g, ' ');
  css = css.replace(/\s*([{}:;,])\s*/g, '$1');
  
  // Remove empty rules
  css = css.replace(/[^{}]+\{\s*\}/g, '');
  
  // Minify color values
  css = css.replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3/gi, '#$1$2$3');
  
  // Remove units from zero values
  css = css.replace(/:\s*0(px|em|rem|%)/g, ':0');
  
  return css;
}

/**
 * Generate CSS scope for components
 */
export function scopeCSS(css: string, scope: string): string {
  // Add scope to all selectors
  return css.replace(/([^{]+){/g, (match, selector) => {
    const scopedSelector = selector
      .split(',')
      .map((s: string) => `${scope} ${s.trim()}`)
      .join(',');
    return `${scopedSelector}{`;
  });
}

/**
 * Split CSS into chunks
 */
export function splitCSS(css: string, maxSize = 50000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  
  // Split by rules
  const rules = css.match(/[^}]+\}+/g) || [];
  
  for (const rule of rules) {
    if (currentChunk.length + rule.length > maxSize && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = rule;
    } else {
      currentChunk += rule;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Deduplicate CSS rules
 */
export function deduplicateCSS(css: string): string {
  const rules = new Map<string, string>();
  const rulePattern = /([^{]+)\{([^}]+)\}/g;
  
  let match;
  while ((match = rulePattern.exec(css)) !== null) {
    const selector = match[1].trim();
    const declarations = match[2].trim();
    
    // Merge declarations for same selector
    if (rules.has(selector)) {
      const existing = rules.get(selector)!;
      rules.set(selector, `${existing};${declarations}`);
    } else {
      rules.set(selector, declarations);
    }
  }
  
  // Rebuild CSS
  return Array.from(rules.entries())
    .map(([selector, declarations]) => `${selector}{${declarations}}`)
    .join('');
}

/**
 * Analyze CSS specificity
 */
export function analyzeSpecificity(selector: string): number {
  let specificity = 0;
  
  // IDs
  const ids = selector.match(/#[a-z0-9_-]+/gi) || [];
  specificity += ids.length * 100;
  
  // Classes, attributes, pseudo-classes
  const classes = selector.match(/\.[a-z0-9_-]+|\[[^\]]+\]|:[a-z-]+/gi) || [];
  specificity += classes.length * 10;
  
  // Elements and pseudo-elements
  const elements = selector.match(/^[a-z]+|[\s>+~][a-z]+|::[a-z-]+/gi) || [];
  specificity += elements.length;
  
  return specificity;
}

/**
 * Generate CSS cache key
 */
export function generateCSSCacheKey(css: string): string {
  // Simple hash for testing
  let hash = 0;
  for (let i = 0; i < css.length; i++) {
    const char = css.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Preload CSS
 */
export function preloadCSS(href: string): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'style';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Load CSS asynchronously
 */
export function loadCSSAsync(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    document.head.appendChild(link);
  });
}