/**
 * Skip Navigation Component
 * Provides keyboard users and screen reader users quick access to main content
 * WCAG 2.1 Success Criterion 2.4.1 (Bypass Blocks)
 */

export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-card focus:text-slate-900 dark:focus:text-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium"
    >
      Skip to main content
    </a>
  );
}

export function SkipToNav() {
  return (
    <a
      href="#primary-navigation"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-40 focus:z-50 focus:bg-card focus:text-slate-900 dark:focus:text-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium"
    >
      Skip to navigation
    </a>
  );
}
