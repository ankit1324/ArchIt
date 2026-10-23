/**
 * Master switch for every paid feature. Pure constant, safe in client and
 * server code alike.
 *
 * false → everything is free: builder, premium templates and owner contacts
 * are unlocked for every signed-in user, featuring is hidden, and no checkout
 * session is ever opened. The ledger, fees and checkout code stay in place and
 * past purchases are untouched.
 *
 * Off until the YouPI gateway is deployed and YOUPI_* is set on Vercel; flip to
 * true to restore the paywall.
 */
export const PAYWALL_ENABLED = false;
