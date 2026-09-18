# Dataset File Upload API

## Overview

Uploads a dataset file (`.csv` or `.txt`) and saves it to a local target path on the machine running this server. This is a fully isolated feature — separate route module, separate service, separate log — with no dependency on the printer functionality.

## Endpoint

**URL:** `/api/v2/dataset/upload`
**Method:** `POST`
**Content-Type:** `multipart/form-data`

## Description

The caller sends the file as a multipart file part, alongside three text fields describing where and how to save it. The server writes the file to `targetPath` (created if it doesn't exist) under the name given in `fileName` (or the uploaded file's own name if `fileName` is omitted), replacing any existing file with that name, and appends one line to a plain-text action log.

## Request Fields

| Field       | Type      | Required | Description                                                                                  |
| ----------- | --------- | -------- | ---------------------------------------------------------------------------------------------- |
| `updatedOn` | Text      | No       | Timestamp/label for this update, written into the log as-is. Defaults to the server's current ISO timestamp if omitted. |
| `targetPath`| Text      | Yes      | Absolute local directory to save the file into. Created automatically if it doesn't exist. Used exactly as provided — no path restriction is applied. |
| `fileType`  | Text      | Yes      | `.csv` or `.txt` (case-insensitive, leading dot optional). Must match the extension of the stored file name. |
| `fileName`  | Text      | No       | Name to store the file under (e.g. `pos_items_2026.csv`). If it has no extension, `fileType` is appended. Any directory part is stripped. An existing file with the same name in `targetPath` is replaced. Defaults to the uploaded file's own name. |
| `file`      | File part | Yes      | The dataset file itself.                                                                       |

## Example (curl)

```bash
curl -X POST http://localhost:9000/api/v2/dataset/upload \
  -F "updatedOn=2026-09-18 10:30" \
  -F "targetPath=C:\Data\ScaleDatasets" \
  -F "fileType=.csv" \
  -F "fileName=pos_items_2026.csv" \
  -F "file=@products.csv"
```

## Responses

**Success (`200 OK`)**
```json
{
  "status": "success",
  "savedPath": "C:\\Data\\ScaleDatasets\\pos_items_2026.csv",
  "fileName": "pos_items_2026.csv",
  "updatedOn": "2026-09-18 10:30"
}
```

**Validation error (`400 Bad Request`)** — missing `targetPath`/`file`, disallowed `fileType`, or the stored file name's extension doesn't match the declared `fileType`:
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
2026-09-18 10:30 | C:\Data\ScaleDatasets | pos_items_2026.csv | .csv
```

Failed/validation-rejected uploads are not written to the log (nothing was actually saved).

## Notes

- `targetPath` is used exactly as sent by the caller and is **not** sandboxed to a fixed root — the server will write to any path it has OS-level permission for. Only expose this endpoint to trusted callers/networks.
- Uploading with a `fileName` that already exists in `targetPath` replaces that file.
- This feature does not touch or depend on any printer-related code (`services/ReceiptBuilder.js`, `PrinterService.js`, etc.).
