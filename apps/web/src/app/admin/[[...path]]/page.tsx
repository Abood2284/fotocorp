import { notFound } from "next/navigation"

/** Legacy `/admin/*` UI namespace was removed; staff tooling lives under `/staff/*`. */
export default function LegacyAdminCatchAllPage() {
  notFound()
}
