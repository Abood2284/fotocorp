/**
 * @deprecated PR-15.1: contributor pre-approval objects live in the staging bucket
 * (`MEDIA_CONTRIBUTOR_UPLOADS_BUCKET`). Use `r2-contributor-uploads.ts`. This file is
 * kept only as a compatibility shim for legacy imports during the transition.
 */
import type { Env } from "../appTypes";
import {
  getContributorStagingS3Context,
  hasContributorStagingS3Config,
  verifyContributorStagingObjectExists,
  type R2BucketContext,
} from "./r2-contributor-uploads";

export type R2OriginalsS3Context = R2BucketContext;

/** @deprecated Use {@link getContributorStagingS3Context} from `r2-contributor-uploads.ts`. */
export function getR2OriginalsS3Context(env: Env): R2OriginalsS3Context | null {
  return getContributorStagingS3Context(env);
}

/** @deprecated Use {@link hasContributorStagingS3Config} from `r2-contributor-uploads.ts`. */
export function hasR2OriginalsS3HeadConfig(env: Env): boolean {
  return hasContributorStagingS3Config(env);
}

/** @deprecated Use {@link verifyContributorStagingObjectExists} from `r2-contributor-uploads.ts`. */
export function verifyOriginalObjectExistsInStorage(env: Env, storageKey: string) {
  return verifyContributorStagingObjectExists(env, storageKey);
}
