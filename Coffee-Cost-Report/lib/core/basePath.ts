/**
 * The app is mounted under a sub-path on the shared cpr-one server
 * (alongside /capex/api, /bud/api, /technician_pm/ui, ...), so every URL the
 * browser resolves itself has to carry that prefix.
 *
 * Next's `basePath` covers <Link>, next/image and /_next/* automatically, but
 * NOT hand-written `fetch()` calls or `<a href>`. Route those through
 * `apiUrl()` so there is a single place to change if the mount point moves.
 *
 * Keep in sync with `basePath` in next.config.ts (which imports this value).
 */
export const BASE_PATH = "/coffee-cost-report";

/** Prefix an app-absolute path (e.g. "/api/export") with the mount point. */
export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}
