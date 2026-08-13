"""Mirror a MinIO bucket into a local directory (backup helper).

This mirrors the raw object store — attachments — so a restore can push the
files back with the MinIO SDK. It is invoked by ``scripts/backup.sh`` inside
the backend container.
"""

from __future__ import annotations

import argparse
import os

from minio import Minio

from app.core.config import settings


def mirror(bucket: str, destination: str) -> None:
    client = Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
        region=settings.minio_region,
    )
    if not client.bucket_exists(bucket):
        raise SystemExit(f"bucket '{bucket}' does not exist")

    count = 0
    for item in client.list_objects(bucket, recursive=True):
        target = os.path.join(destination, item.object_name)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        client.fget_object(bucket, item.object_name, target)
        count += 1
    print(f"mirrored {count} objects from '{bucket}' into '{destination}'")


def main() -> None:
    parser = argparse.ArgumentParser(description="Mirror a MinIO bucket locally")
    parser.add_argument("--bucket", default=settings.minio_bucket)
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()

    mirror(args.bucket, args.destination)


if __name__ == "__main__":
    main()