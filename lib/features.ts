/**
 * Features that need a service this build may not have. Both are off unless switched on, so the site never shows
 * a badge or a page that does nothing.
 *  NEXT_PUBLIC_FEATURE_RIGOR=1   AI rigor score on each coin (also needs the secret ANTHROPIC_API_KEY)
 *  NEXT_PUBLIC_FEATURE_VERIFY=1  the Verify page (needs a Lean 4 checker service that this repository does not include)
 * NEXT_PUBLIC_* values are baked in at build time, so redeploy after changing them.
 */
export const RIGOR_ON = process.env.NEXT_PUBLIC_FEATURE_RIGOR === '1';
export const VERIFY_ON = process.env.NEXT_PUBLIC_FEATURE_VERIFY === '1';
