# Fotocorp Video Architecture Specification: R2 + VPS + FFmpeg

## 1. System Components & Responsibilities

This architecture avoids expensive managed video services by coordinating edge-based APIs, direct-to-object storage, and asynchronous bare-metal compute.

* 
**API Layer (`apps/api` - Cloudflare Workers / Hono):** Responsible strictly for authentication, generating presigned R2 URLs, and handling webhooks/database updates. It never touches the actual video bytes to avoid edge timeout limits.


* 
**Storage Layer (Cloudflare R2):** Utilizes a dual-bucket strategy.


* 
**Private Bucket:** Stores original, high-res contributor uploads.


* 
**Public Bucket:** Stores the heavily compressed, 3-7 second "glimpse" previews behind a custom domain. Cloudflare does not charge for egress bandwidth.




* 
**Compute Layer (`apps/jobs` - VPS / Docker):** A dedicated Node environment running FFmpeg. It processes videos asynchronously via a queue (e.g., Cloudflare Queues or BullMQ).


* 
**Database (Neon Postgres / Drizzle ORM):** Maintains asset metadata, including the new video-specific fields.



---

## 2. Database Schema Updates

We must expand the existing Drizzle schema to differentiate media types and store critical video metadata. Remember to keep queries shaped efficiently for the serverless driver.

| Table | New Column/Field | Type | Purpose |
| --- | --- | --- | --- |
| `assets` | `media_type` | `ENUM('image', 'video')` | Differentiate media for frontend rendering. 

 |
| `assets` | `duration_ms` | `INTEGER` | Store original video length (crucial for metadata search). 

 |
| `assets` | `resolution` | <br>`VARCHAR` | e.g., "4K", "1080p" (helps buyers know what they are downloading). 

 |
| `assets` | `fps` | `DECIMAL` | Frames per second (critical metadata for video editors). 

 |
| `assets` | `has_preview` | `BOOLEAN` | Flags when the FFmpeg job has successfully generated the 3-7s clip. 

 |

---

## 3. End-to-End Workflow Execution

The lifecycle of a video upload is designed to keep heavy data transfers away from the Hono API.

### Phase 1: Direct-to-R2 Upload

1. 
**Request:** The contributor's client calls the internal API (`/api/v1/internal/upload`) requesting an upload slot for a new video.


2. 
**Presign:** The Hono API authenticates the request, generates a Cloudflare R2 presigned PUT URL for the **Private Bucket**, and returns it to the client.


3. 
**Transfer:** The client uploads the raw video file directly to the R2 Private Bucket. This entirely bypasses the Cloudflare Worker, saving bandwidth and avoiding execution limits.



### Phase 2: Asynchronous Job Trigger

4. 
**Queue Notification:** Once the upload is complete, R2 fires an object-created event to Cloudflare Queues (or the client pings a webhook on your API).


5. 
**Job Acquisition:** The Dockerized Node server (`apps/jobs`) running on your VPS picks up the message from the queue.



### Phase 3: FFmpeg Transcoding Pipeline

6. 
**Download:** The Node worker securely pulls the original video from the Private R2 bucket to local VPS storage.


7. 
**Processing:** The worker executes a single, highly optimized FFmpeg command to generate the "glimpse" preview.


* 
*Seek:* Skips the first 10 seconds (to avoid black screens).


* 
*Extract:* Trims exactly 5 seconds of footage (`-t 5`).


* 
*Scale & Watermark:* Downscales to 480p/720p and overlays the Fotocorp PNG watermark.


* 
*Audio:* Mutes the audio track.


* 
*Optimize:* Applies the `moov` atom fast-start (`-movflags +faststart`). This creates a web-optimized `mp4` that browsers can auto-play natively via a standard `<video>` tag without needing complex HLS infrastructure.




8. 
**Output Upload:** The Node worker pushes the resulting lightweight (~1MB) `mp4` to the **Public R2 Bucket**.



### Phase 4: State Reconciliation & Cleanup

9. 
**Database Update:** The VPS worker executes an update to the Neon Postgres database (via Drizzle ORM), marking the asset as `published: true` and `has_preview: true`.


10. 
**Cleanup:** The worker deletes all local temporary files (both the raw original and the processed output) from the VPS disk to prevent storage exhaustion.