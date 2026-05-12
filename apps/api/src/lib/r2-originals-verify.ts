/**
 * @deprecated PR-15.1: photographer pre-approval objects now live in the staging bucket
 * (`MEDIA_CONTRIBUTOR_UPLOADS_BUCKET`). Use `r2-contributor-uploads.ts`. This file is
 * kept only as a compatibility shim for legacy imports during the transition.
 */
import type { Env } from "../appTypes";
import {
  getPhotographerUploadsS3Context,
  hasPhotographerUploadsS3Config,
  verifyPhotographerStagingObjectExists,
  type R2BucketContext,
} from "./r2-contributor-uploads";

export type R2OriginalsS3Context = R2BucketContext;

/** @deprecated Use {@link getPhotographerUploadsS3Context} from `r2-contributor-uploads.ts`. */
export function getR2OriginalsS3Context(env: Env): R2OriginalsS3Context | null {
  return getPhotographerUploadsS3Context(env);
}

/** @deprecated Use {@link hasPhotographerUploadsS3Config} from `r2-contributor-uploads.ts`. */
export function hasR2OriginalsS3HeadConfig(env: Env): boolean {
  return hasPhotographerUploadsS3Config(env);
}

/** @deprecated Use {@link verifyPhotographerStagingObjectExists} from `r2-contributor-uploads.ts`. */
export function verifyOriginalObjectExistsInStorage(env: Env, storageKey: string) {
  return verifyPhotographerStagingObjectExists(env, storageKey);
}
