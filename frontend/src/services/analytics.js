/**
 * Analytics Tracking Service Placeholder.
 */
export const analytics = {
  trackEvent: (name, properties = {}) => {
    console.log(`[Analytics] Event tracked: ${name}`, properties);
  },
  trackPageView: (pageName) => {
    console.log(`[Analytics] Page view: ${pageName}`);
  }
};
