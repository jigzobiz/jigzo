export function assertPreviewFrontendSafety(env) {
  if (env.VERCEL_ENV !== 'preview') return;
  // All browser API calls must remain on this deployment's own origin.
  if (env.VITE_API_URL) throw new Error('Preview safety verification failed: VITE_API_URL must be unset.');
}
