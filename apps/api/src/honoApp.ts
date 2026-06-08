import { Hono } from "hono";
import type { Env } from "./appTypes";
import type { AppRequestVariables } from "./db";
import { AppError } from "./lib/errors";
import { errorResponse } from "./lib/http";
import { requestContextMiddleware } from "./middleware/context";
import { healthRoute } from "./routes/system/health/route";
import { authProfileRoutes } from "./routes/auth/profile-routes";
import { platformAuthRoutes } from "./routes/platform-auth/route";
import { authRoutes } from "./routes/auth/routes";
import { staffAuthRoutes } from "./routes/staff/auth/route";
import { staffAccessInquiryRoutes } from "./routes/staff/access-inquiries/route";
import { staffMemberRoutes } from "./routes/staff/members/route";
import { internalAccountRoutes } from "./routes/internal/account-downloads/route";
import { internalAdminRoutes } from "./routes/internal/admin/route";
import { internalAdminContributorUploadRoutes } from "./routes/internal/admin-contributor-uploads/route";
import { internalAdminStaffUploadWizardRoutes } from "./routes/internal/admin-staff-upload-wizard/route";
import { internalAdminHomepageHeroPoolRoutes } from "./routes/internal/admin-homepage-hero-pool/route";
import { internalDownloadRoutes } from "./routes/internal/downloads/route";
import { fotoboxRoutes } from "./routes/internal/fotobox/route";
import { legacyFixtureRoutes } from "./routes/legacy/fixture-routes";
import { photographerAnalyticsRoutes } from "./routes/contributor/analytics/route";
import { photographerAuthRoutes } from "./routes/contributor/auth/route";
import { photographerCatalogRoutes } from "./routes/contributor/catalog/route";
import { photographerContributorsRoutes } from "./routes/contributor/contributors/route";
import { photographerEventRoutes } from "./routes/contributor/events/route";
import { photographerImageRoutes } from "./routes/contributor/images/route";
import { photographerUploadRoutes } from "./routes/contributor/uploads/route";
import { publicCatalogRoutes } from "./routes/public/catalog-routes";
import { publicContributorApplicationRoutes } from "./routes/public/contributor-applications/route";
import { publicHomepageRoutes } from "./routes/public/homepage-routes";
import { publicMediaRoutes } from "./routes/public/media-routes";

export const honoApp = new Hono<{ Bindings: Env; Variables: AppRequestVariables }>();

honoApp.use("*", requestContextMiddleware);

/** Legacy path: `/api/v1/photographer/*` → same handlers as `/api/v1/contributor/*` (remove after traffic is gone). */
honoApp.use("*", async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  if (pathname !== "/api/v1/photographer" && !pathname.startsWith("/api/v1/photographer/")) {
    await next();
    return;
  }
  const url = new URL(c.req.url);
  url.pathname = pathname.replace("/api/v1/photographer", "/api/v1/contributor");
  return honoApp.fetch(new Request(url, c.req.raw));
});

/** Legacy internal path: `admin/photographer-uploads` → `admin/contributor-uploads`. */
honoApp.use("*", async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  if (!pathname.startsWith("/api/v1/internal/admin/photographer-uploads")) {
    await next();
    return;
  }
  const url = new URL(c.req.url);
  url.pathname = pathname.replace(
    "/api/v1/internal/admin/photographer-uploads",
    "/api/v1/internal/admin/contributor-uploads",
  );
  return honoApp.fetch(new Request(url, c.req.raw));
});

honoApp.get("/health", async () => {
  return await healthRoute();
});

honoApp.route("/", authRoutes);
honoApp.route("/", platformAuthRoutes);
honoApp.route("/", authProfileRoutes);
honoApp.route("/", staffAuthRoutes);
honoApp.route("/", staffAccessInquiryRoutes);
honoApp.route("/", staffMemberRoutes);
honoApp.route("/", photographerAuthRoutes);
honoApp.route("/", photographerImageRoutes);
honoApp.route("/", photographerEventRoutes);
honoApp.route("/", photographerCatalogRoutes);
honoApp.route("/", photographerContributorsRoutes);
honoApp.route("/", photographerAnalyticsRoutes);
honoApp.route("/", photographerUploadRoutes);

import { internalAdminEventsRoutes } from "./routes/internal/admin-events/route";
import { internalSearchTypesenseRoutes } from "./routes/internal/search-typesense/route";

honoApp.route("/", fotoboxRoutes);
honoApp.route("/", internalDownloadRoutes);
honoApp.route("/", internalAccountRoutes);
honoApp.route("/", internalAdminRoutes);
honoApp.route("/", internalAdminEventsRoutes);
honoApp.route("/", internalSearchTypesenseRoutes);
honoApp.route("/", internalAdminContributorUploadRoutes);
honoApp.route("/", internalAdminStaffUploadWizardRoutes);
honoApp.route("/", internalAdminHomepageHeroPoolRoutes);
honoApp.route("/", publicCatalogRoutes);
honoApp.route("/", publicContributorApplicationRoutes);
honoApp.route("/", publicHomepageRoutes);
honoApp.route("/", publicMediaRoutes);
honoApp.route("/", legacyFixtureRoutes);

honoApp.notFound((c) => {
  return errorResponse(
    new AppError(404, "ROUTE_NOT_FOUND", `Route '${new URL(c.req.url).pathname}' was not found`),
    { requestId: c.get("requestId") },
  );
});

honoApp.onError((error, c) => {
  return errorResponse(error, { requestId: c.get("requestId") });
});
