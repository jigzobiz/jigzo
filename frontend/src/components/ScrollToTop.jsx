import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Resets the window scroll position to the top whenever the route (pathname)
// changes. Keying on pathname only means in-page query-string updates (e.g.
// ?occasion=... on the landing page, or create-flow steps) do not trigger a
// jump — only genuine page navigations do. Rendered once in the root layout,
// so it applies site-wide.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // `behavior: 'instant'` overrides the global `scroll-behavior: smooth` so a
    // route change jumps straight to the top instead of animating the new page
    // up from the previous scroll position.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
