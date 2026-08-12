# 0013 — Media storage

- Status: accepted
- Date: 2026-08-12

## Context

Voice messages and photos must be stored somewhere that scales and keeps blobs
off the API server.

## Decision

- **Object storage:** MinIO (S3-compatible) in the docker stack; drop-in for
  real S3 later.
- Upload via **presigned URLs**: the client requests `POST /media/presign`,
  uploads directly to MinIO, then references the object key in the post.
- Voice: browser `MediaRecorder` -> `webm/opus`, no transcoding in the MVP.
- Photos: `image/*`, resized/compressed client-side before upload.

## Consequences

- A `media` table stores `kind`, object key, content type, size, and duration
  (voice), not the bytes.
- Presigned URLs expire and are single-use where possible.
