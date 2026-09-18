# Dataset File Upload API

## Overview

Uploads a dataset file (`.csv` or `.txt`) and saves it to a local target path on the machine running this server. This is a fully isolated feature — separate route module, separate service, separate log — with no dependency on the printer functionality.

## Endpoint

**URL:** `/api/v2/dataset/upload`
**Method:** `POST`
**Content-Type:** `multipart/form-data`

## Description

The caller sends the file as a multipart file part, alongside three text fields describing where and how to save it. The server writes the file to `targetPath` (created if it doesn't exist) using the file's original name, and appends one line to a plain-text action log.

## Request Fields

| Field       | Type      | Required | Description                                                                                  |
| ----------- | --------- | -------- | ---------------------------------------------------------------------------------------------- |
| `updatedOn` | Text      | No       | Timestamp/label for this update, written into the log as-is. Defaults to the server's current ISO timestamp if omitted. |
| `targetPath`| Text      | Yes      | Absolute local directory to save the file into. Created automatically if it doesn't exist. Used exactly as provided — no path restriction is applied. |
| `fileType`  | Text      | Yes      | `.csv` or `.txt` (case-insensitive, leading dot optional). Must match the uploaded file's actual extension. |
| `file`      | File part | Yes      | The dataset file itself.                                                                       |

## Example (curl)

```bash
curl -X POST http://localhost:9000/api/v2/dataset/upload \
  -F "updatedOn=2026-09-18 10:30" \
  -F "targetPath=C:\Data\ScaleDatasets" \
  -F "fileType=.csv" \
  -F "file=@products.csv"
```

## Responses

**Success (`200 OK`)**
```json
{
  "status": "success",
  "savedPath": "C:\\Data\\ScaleDatasets\\products.csv",
  "updatedOn": "2026-09-18 10:30"
}
```

**Validation error (`400 Bad Request`)** — missing `targetPath`/`file`, disallowed `fileType`, or the uploaded file's extension doesn't match the declared `fileType`:
```json
{ "error": "targetPath is required" }
```

**File too large (`413 Payload Too Large`)** — file exceeds the 50MB limit:
```json
{ "error": "File exceeds the maximum allowed size (50MB)" }
```

**Server error (`500 Internal Server Error`)** — filesystem write failure or unexpected error:
```json
{ "error": "<error message>" }
```

## Action Log

Every successful save appends one pipe-delimited line to `logs/dataset-uploads.log` (created automatically, relative to the project root):

```
<updatedOn> | <targetPath> | <fileName> | <fileType>
```

Example:
```
2026-09-18 10:30 | C:\Data\ScaleDatasets | products.csv | .csv
```

Failed/validation-rejected uploads are not written to the log (nothing was actually saved).

## Notes

- `targetPath` is used exactly as sent by the caller and is **not** sandboxed to a fixed root — the server will write to any path it has OS-level permission for. Only expose this endpoint to trusted callers/networks.
- Re-uploading the same file name to the same `targetPath` overwrites the existing file.
- This feature does not touch or depend on any printer-related code (`services/ReceiptBuilder.js`, `PrinterService.js`, etc.).
