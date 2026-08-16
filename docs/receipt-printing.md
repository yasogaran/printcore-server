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

| Field        | Type   | Description                                 |
| ------------ | ------ | ------------------------------------------- |
| `paperWidth` | Number | Width of the paper in mm. Defaults to `80`. |

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
