# JSON Receipt Printing API

## Overview

The JSON Receipt Printing endpoint allows you to send structured JSON data to the server, which automatically generates a beautifully formatted, continuous receipt using an embedded font (Roboto Mono) and prints it on thermal paper.

## Endpoint

**URL:** `/api/v2/print/receipt`  
**Method:** `POST`  
**Content-Type:** `application/json`

## Description

Unlike the raw image printing endpoint, this route expects a structured JSON object containing your invoice data (Store info, Items, Financials). The server renders this data onto a virtual canvas, converts it to monochrome, and sends it to the printer. The height of the receipt expands automatically based on the number of items.

## Request Body Structure

The request body requires three main objects: `store`, `items` (array), and `financials`.

### Full Payload Example

```json
{
  "settings": {
    "paperWidth": 80
  },
  "store": {
    "logo": "data:image/png;base64,...",
    "name": "hexcore Supermart",
    "address": "123 Main Street, City",
    "phones": ["011-2345678", "077-1234567"],
    "email": "hello@hexcore.com"
  },
  "meta": {
    "id": "INV-2026-001",
    "date": "2026-08-16 14:30",
    "cashier": "John Doe"
  },
  "items": [
    {
      "title": "Wireless Mouse M330",
      "qty": 2,
      "unitPrice": 1500.0,
      "total": 3000.0
    },
    {
      "title": "Mechanical Keyboard",
      "qty": 1,
      "unitPrice": 4500.0,
      "total": 4500.0
    }
  ],
  "financials": {
    "summary": {
      "subtotal": 7500.0,
      "discount": 500.0,
      "total": 7000.0,
      "paidAmount": 8000.0,
      "balance": 1000.0
    },
    "status": "PAID"
  }
}
```

## Parameter Details

### 1. `settings` (Optional)

| Field        | Type   | Description                                                                                                                                                            |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paperWidth` | Number | Width of the paper in mm. Defaults to `80`.                                                                                                                           |
| `template`   | String | Which layout to render. `"boxed-template"` selects the boxed invoice layout described below. Any other value (or omitted) uses the default plain layout shown above. |

### 2. `store` (Required)

| Field     | Type            | Description                                             |
| --------- | --------------- | ------------------------------------------------------- |
| `logo`    | String (Base64) | Optional. A base64 image string for the receipt header. |
| `name`    | String          | Store name (printed in large bold text).                |
| `address` | String          | Store physical address.                                 |
| `phones`  | Array[String]   | Optional list of phone numbers.                         |
| `email`   | String          | Optional store email address.                           |

### 3. `meta` (Required)

| Field     | Type   | Description                                          |
| --------- | ------ | ---------------------------------------------------- |
| `id`      | String | The receipt/invoice number (e.g. "INV-1001").        |
| `date`    | String | Transaction date and time.                           |
| `cashier` | String | Name of the staff member processing the transaction. |

### 4. `items` (Required Array)

An array of objects representing the purchased items.
| Field | Type | Description |
|-------|------|-------------|
| `title` | String | Name of the product. |
| `qty` | Number | Quantity purchased. |
| `unitPrice`| Number | Price per single unit. |
| `total` | Number | `qty` \* `unitPrice`. |

### 5. `financials` (Required)

| Field                | Type   | Description                                                  |
| -------------------- | ------ | ------------------------------------------------------------ |
| `summary.subtotal`   | Number | Total before discounts.                                      |
| `summary.discount`   | Number | Discount amount applied. Omit or set to `0` to hide.         |
| `summary.total`      | Number | Final total amount to pay.                                   |
| `summary.paidAmount` | Number | Amount given by the customer.                                |
| `summary.balance`    | Number | Change due to the customer.                                  |
| `status`             | String | Payment status (e.g., "PAID", "CREDIT"). Defaults to "PAID". |

## Technical Limitations & Notes

- **Payload Size:** The maximum JSON payload size is dictated by the server's `body-parser` limit (currently configured to **1MB**). This is more than enough for thousands of receipt items in a single JSON payload.
- **Auto-Formatting:** The receipt engine automatically handles text alignment, spacing, dashed separator lines, and currency formatting (fixed to 2 decimal places).
- **Fonts:** The server relies on a custom `RobotoMono.ttf` font asset. If the font file is missing, it will safely fallback to standard Arial.
- **Logo Conversion:** If a store logo is provided, it is rendered and then converted to monochrome using Floyd-Steinberg dithering for maximum clarity on the thermal paper.

## Error Responses

**Missing Required Fields (`400 Bad Request`)**

```json
{
  "error": "Missing required invoice fields"
}
```

**Printer Offline (`503 Service Unavailable`)**

```json
{
  "error": "Printer Offline"
}
```

## Cash Drawer Kick (`kick_drawer`)

Works with either template (plain or boxed) since it operates on the raw print buffer after the receipt is built, not on the layout itself. When enabled, a short ESC/POS pulse command (`ESC p m t1 t2`) is appended to the same buffer sent to the printer, so the drawer opens immediately after the receipt cuts — no extra USB write/connection.

| Field           | Type    | Description                                                                                                                     |
| --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------|
| `kick_drawer`   | Boolean | When `true`, pulses the cash drawer connected to the printer's RJ11 port. Omit or set `false` to skip.                          |
| `drawerPin`     | Number  | `2` or `5` — the physical pin on the RJ11 connector wired to the drawer's kick line. Defaults to `2` (the standard wiring).     |
| `drawerOnMs`    | Number  | Pulse ON duration. Defaults to `25` (the widely-used ESC/POS default, ~50ms).                                                    |
| `drawerOffMs`   | Number  | Pulse OFF duration. Defaults to `250` (~500ms).                                                                                  |

**Notes:**
- ESC/POS printers only (e.g. the XP-80T profile). If the server is configured for a TSPL printer (e.g. XP-380), the response includes `"drawer": "unsupported for tspl printer"` and no drawer bytes are sent — the receipt itself still prints normally.
- In dev mode with no hardware connected, the response includes `"drawer": "skipped (no hardware connected)"`.

### Example Request

```json
{
  "store": { "name": "hexcore Supermart", "address": "123 Main Street, City" },
  "meta": { "id": "INV-2026-001", "date": "2026-08-16 14:30", "cashier": "John Doe" },
  "items": [ { "title": "Wireless Mouse M330", "qty": 1, "unitPrice": 1500.0, "total": 1500.0 } ],
  "financials": { "summary": { "subtotal": 1500.0, "discount": 0, "total": 1500.0, "paidAmount": 2000.0, "balance": 500.0 }, "status": "PAID" },
  "kick_drawer": true
}
```

## Boxed Template (`settings.template: "boxed-template"`)

An alternative invoice layout with a bordered item table showing MRP/Selling price/Qty, an optional per-item discount row, a "You Saved" callout box, and a loyalty points box. It reuses the same `store`, `meta`, and `financials.status`/`financials.summary.paidAmount`/`financials.summary.balance` fields as the default layout (header and payment-details sections are unchanged) but expects extra fields on `items` and an optional top-level `loyalty` object.

### Full Payload Example

```json
{
  "settings": { "paperWidth": 80, "template": "boxed-template" },
  "store": { "name": "hexcore Supermart", "address": "123 Main Street, City" },
  "meta": { "id": "INV-2026-001", "date": "2026-08-16 14:30", "cashier": "John Doe" },
  "items": [
    { "title": "Wireless Mouse M330", "mrp": 1200, "sellingPrice": 1200, "qty": 4, "total": 4800, "discount": 0 },
    { "title": "Mechanical Keyboard", "mrp": 1200, "sellingPrice": 1200, "qty": 4, "total": 4800, "discount": 1900 }
  ],
  "financials": {
    "summary": { "paidAmount": 7700.0, "balance": 0 },
    "status": "PAID"
  },
  "loyalty": { "earned": 24, "total": 340 }
}
```

### Extra `items[]` fields

| Field          | Type   | Description                                                                                         |
| -------------- | ------ | ----------------------------------------------------------------------------------------------------|
| `mrp`          | Number | Maximum retail price, shown in its own box.                                                          |
| `sellingPrice` | Number | Actual selling price, shown in its own box.                                                          |
| `discount`     | Number | This item's own discount amount, supplied by the caller directly (not derived from `mrp - sellingPrice`). When greater than `0`, a "DISCOUNT / YOU SAVED" row is drawn under that item. |

`GROSS TOTAL`, `DISCOUNT EARNED`, and `NET TOTAL` in the summary, and the amount in the "You Saved" box, are all computed by the server from the items array: `GROSS TOTAL = sum(items[].total)`, `DISCOUNT EARNED = sum(items[].discount)`, `NET TOTAL = GROSS TOTAL - DISCOUNT EARNED`.

### `loyalty` (Optional)

| Field    | Type   | Description                                             |
| -------- | ------ | -------------------------------------------------------- |
| `earned` | Number | Loyalty points earned on this bill.                       |
| `total`  | Number | Customer's total loyalty point balance.                   |

### `print_barcode` (Optional, top-level)

| Field           | Type    | Description                                                                                          |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------|
| `print_barcode` | Boolean | When `true`, a Code128 barcode encoding `meta.id` is printed as a new section at the very end of the invoice, below the footer. Omit or set `false` to skip it. |

When `loyalty` is omitted, the loyalty box is skipped entirely.
