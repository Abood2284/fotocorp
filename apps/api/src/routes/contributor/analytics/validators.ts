import { z } from "zod";

/** Query validation for `GET /api/v1/contributor/analytics/summary`. Reserved for optional `range` in a follow-up PR. */
export const photographerAnalyticsQuerySchema = z.object({}).passthrough();
