# Storage

Files are handled by **disks**: one interface, several drivers, selected by configuration. Application code never touches the filesystem or an S3 SDK directly.

```
src/lib/
├── storage.ts        facade/registry: storage.disk() (imported as #lib/storage)
└── storage/
    ├── types.ts      StorageDriver contract
    ├── local.ts      filesystem driver + HMAC signed URLs
    ├── s3.ts         Bun.S3Client driver (AWS S3, R2, MinIO)
    └── sign.ts       HMAC sign/verify
```

## The contract

```ts
interface StorageDriver {
	put(key: string, data: File | Blob | Uint8Array | ArrayBuffer, options?: { type?: string }): Promise<StoredObject>
	read(key: string): Promise<Blob>
	delete(key: string): Promise<void>
	exists(key: string): Promise<boolean>
	signedUrl(key: string, options?: { expiresIn?: number }): Promise<string> | string
	presignPut?(key: string, options?: { expiresIn?: number; type?: string }): Promise<PresignedUpload>
}
```

Keys are **driver-independent** (`files/<uuid>`), so moving a project from local to S3 is a configuration change, not a rewrite. The `files` table records the `disk` that holds each object.

```ts
import { storage } from '#lib/storage'

await storage.disk().put(key, file, { type: file.type })
const url = await storage.disk().signedUrl(key, { expiresIn: 900 })
```

`storage.disk()` follows `STORAGE_DRIVER`; `storage.disk('s3')` picks a specific disk (for example, temp files locally and uploads in S3).

## Choosing a driver

| Situation         | Driver                      | Why                                                                                   |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| `bun dev`         | `local`                     | no services needed                                                                    |
| Docker / VM       | `local` + a volume, or `s3` | local is simpler; a volume is required because the container filesystem is disposable |
| Several instances | `s3`                        | every instance must see the same objects                                              |
| Vercel            | **`s3`**                    | the filesystem is ephemeral and often read-only; local writes would fail or vanish    |
| Large uploads     | `s3` + `presignPut`         | the browser uploads directly to the bucket, skipping the function body limit          |

## Local driver

```env
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./storage
STORAGE_PUBLIC_BASE_URL=http://localhost:3000   # defaults to APP_URL
STORAGE_SIGNING_SECRET=                          # defaults to BETTER_AUTH_SECRET
```

- Keys are validated: no `..`, no leading `/`, no empty segments, and the resolved path must stay under the root.
- `signedUrl()` returns `${base}/api/files/raw?key=…&exp=…&sig=…`. The signature is HMAC-SHA256 of `key:exp`, compared in constant time; an expired or tampered link is a 403.
- The `/api/files/raw` route exists in the `files` module. With the S3 driver it is unused, because `signedUrl()` returns a provider URL instead.

## S3 driver

Uses **Bun's built-in `Bun.S3Client`** — no `@aws-sdk` dependency.

```env
STORAGE_DRIVER=s3
S3_BUCKET=uploads
S3_REGION=us-east-1
S3_ENDPOINT=http://localhost:9000        # MinIO/R2; leave empty for AWS
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_VIRTUAL_HOSTED_STYLE=false            # path-style, required by MinIO and most compatible servers
```

The app fails at startup if `STORAGE_DRIVER=s3` and one of bucket/region/credentials is missing.

AWS S3, Cloudflare R2 and MinIO are the same driver with different values. For MinIO locally:

```bash
docker compose --profile s3 up -d          # minio + bucket "uploads"
```

MinIO no longer publishes images on Docker Hub; `docker-compose.yml` points at the official registry. If your registry requires authentication, use any S3-compatible endpoint and set `S3_ENDPOINT` accordingly.

## The `files` module

| Route                    | Auth       | Behaviour                                                                                                      |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------- |
| `POST /api/files`        | session    | multipart (`file`, optional `visibility`); validates MIME and size, writes to the active disk, stores metadata |
| `GET /api/files/:id`     | —          | metadata only (never the bytes, never the storage key)                                                         |
| `GET /api/files/:id/url` | session    | signed URL. `private`: owner or `file:delete`; `public`: any signed-in user                                    |
| `GET /api/files/raw`     | signed URL | streams local bytes; not used by the S3 driver                                                                 |
| `DELETE /api/files/:id`  | session    | owner, or an admin with `file:delete`                                                                          |

The database stores `key`, `disk`, `mime`, `size`, `original_name`, `visibility` and `owner_id` — never the bytes.

MIME validation uses the **declared** multipart type against a whitelist in `src/modules/files/model.ts`. Elysia's `t.File({ type })` is not used because it content-sniffs through the optional `file-type` package, and types without magic bytes (plain text) are always rejected. If you want sniffing, install `file-type` and add `type` back to `t.File`.

Upload limit comes from `STORAGE_MAX_FILE_SIZE` (`t.File({ maxSize })`, 422 when exceeded). Set the server's `maxRequestBodySize` slightly higher so multipart parsing does not fail before validation.

## Migrating local → S3

1. Create the bucket and set the `S3_*` variables; keep `STORAGE_DRIVER=s3`.
2. Copy existing objects from `STORAGE_LOCAL_PATH` with the same keys (`files/<id>`).
3. Look up each row's `disk` column: rows written before the switch keep `disk = 'local'`, so `signedUrl()`/`read()` still use the local driver for them.
4. Move or delete local files once every row has been re-pointed.

Because the key is provider-independent, no application code changes.

## Vercel notes

- Use `s3`; there is no persistent filesystem, so the local driver is not an option there.
- Prefer `presignPut()` for uploads above a few megabytes.
- Do not rely on the local cache of signed URLs; sign on demand.
- `GET /api/files/raw` is irrelevant on Vercel (the S3 driver never produces that URL).
