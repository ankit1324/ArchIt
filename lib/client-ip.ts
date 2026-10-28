/**
 * Which address a request came from, for rate-limit keys. Pure (no
 * "server-only", no env, no node: imports) so `node --test` can load it and
 * any runtime can run it.
 *
 * Order of trust:
 * 1. `x-vercel-forwarded-for`, then `x-real-ip`: on Vercel the platform sets
 *    both and overwrites whatever the client sent.
 * 2. The LAST `X-Forwarded-For` hop. Each proxy appends the address it
 *    received the connection from, so the first entry is whatever the client
 *    chose to send (spoofing it would hand every request a fresh rate-limit
 *    bucket). Behind a single reverse proxy, the last entry is the one our
 *    proxy appended: the real peer.
 * 3. "anonymous": every header-less request shares one bucket, which is the
 *    safe direction to fail.
 */

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
// Loose IPv6 shape (hex groups, "::", optional embedded IPv4 tail). The
// point is to keep garbage out of the key, not to fully parse RFC 4291.
const IPV6 = /^(?=.*:)[0-9a-f:]{2,39}(\d{1,3}(\.\d{1,3}){3})?$/i;

function validIp(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v || v.length > 45) return null;
  if (IPV4.test(v)) return v;
  if (IPV6.test(v) && (v.match(/::/g)?.length ?? 0) <= 1) return v.toLowerCase();
  return null;
}

function hops(header: string | null): string[] {
  return (header ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function clientIp(headers: Headers): string {
  // Vercel's own header: its first entry is the client the edge saw.
  const vercel = validIp(hops(headers.get("x-vercel-forwarded-for"))[0]);
  if (vercel) return vercel;
  const real = validIp(headers.get("x-real-ip") ?? undefined);
  if (real) return real;
  const xff = hops(headers.get("x-forwarded-for"));
  const last = validIp(xff[xff.length - 1]);
  if (last) return last;
  return "anonymous";
}
