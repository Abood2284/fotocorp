/**
 * Contributor portal lives outside `(marketing)` so it never inherits the
 * public site Header/Footer or marketing chrome.
 */
export default function ContributorRouteGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
