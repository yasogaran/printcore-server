# Boxed Template Receipt Printing API

## Overview

The boxed template is an alternative invoice layout for the JSON Receipt Printing endpoint. It renders a bordered item table showing MRP/Selling price/Qty, an optional per-item discount row, a "You Saved" callout box, and a loyalty points box.

It reuses the same `store` and `meta` fields as the [default receipt layout](receipt-printing.md), but expects extra fields on `items`, an optional top-level `customer` object, and a boxed-template-specific `financials.summary.payments` array for the Payment Details section.

## Endpoint

**URL:** `/api/v2/print/receipt`  
**Method:** `POST`  
**Content-Type:** `application/json`

Selected via `settings.template: "boxed-template"`. Any other value (or omitted) uses the [default plain layout](receipt-printing.md).

## Full Payload Example

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
    "summary": {
      "payments": [
        { "paymentType": "Cash", "amount": 5000.0 },
        { "paymentType": "Card", "amount": 2700.0 }
      ],
      "cartDiscount": 200.0,
      "balance": 0
    },
    "status": "PAID"
  },
  "customer": {
    "name": "Jane Silva",
    "loyaltyPoints": { "earned": 24, "total": 340 }
  }
}
```

## Parameter Details

### `settings.template`

Set to `"boxed-template"` to select this layout.

### `store`, `meta`

Same as the [default layout](receipt-printing.md#parameter-details). See that document for field definitions.

### `financials.summary.payments` (Optional array)

Each entry is printed as its own `{paymentType}: {amount}` row in the "PAYMENT DETAILS" section, in array order.

| Field         | Type   | Description                                                      |
| ------------- | ------ | ------------------------------------------------------------------ |
| `paymentType` | String | Label for the payment row, e.g. `"Cash"`, `"Card"`, `"Bank Transfer"`. |
| `amount`      | Number | Amount paid via that method.                                     |

Entries missing `paymentType` are skipped. If `payments` is omitted, no payment rows are printed (the section falls through to `balance`/`status` only).

### `financials.summary.balance` (Optional)

When greater than `0`, a "Balance Due" row is printed below the payment rows.

### `financials.status`

Free-text status string, printed uppercased on its own row (e.g. `"PAID"`, `"PARTIAL PAID"`, `"FULL CREDIT"`). Defaults to `"PAID"` if omitted. A dashed separator line is drawn between the payment/balance rows and this status row.

### `items[]`

| Field          | Type   | Description                                                                                                                              |
| -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`        | String | Name of the product.                                                                                                                      |
| `qty`          | Number | Quantity purchased.                                                                                                                      |
| `mrp`          | Number | Maximum retail price, shown in its own box.                                                                                               |
| `sellingPrice` | Number | Actual selling price, shown in its own box.                                                                                               |
| `total`        | Number | Line total for this item.                                                                                                                 |
| `discount`     | Number | This item's own discount amount, supplied by the caller directly (not derived from `mrp - sellingPrice`). When greater than `0`, a "DISCOUNT / YOU SAVED" row is drawn under that item. |

### `financials.summary.cartDiscount` (Optional)

An additional invoice-level discount applied on top of the per-item discounts. Printed as a "CART DISCOUNT" row right after "ITEM DISCOUNT" in the summary (shown as `0.00` when omitted).

`GROSS TOTAL`, `ITEM DISCOUNT`, `CART DISCOUNT`, and `NET TOTAL` in the summary, and the amount in the "You Saved" box, are computed as follows:

- `GROSS TOTAL = sum(items[].total)`
- `ITEM DISCOUNT = sum(items[].discount)`
- `CART DISCOUNT = financials.summary.cartDiscount` (defaults to `0`)
- `NET TOTAL = GROSS TOTAL - ITEM DISCOUNT - CART DISCOUNT`
- "You Saved" box = `ITEM DISCOUNT + CART DISCOUNT`

### `customer` (Optional, top-level)

| Field                    | Type   | Description                                                                          |
| ------------------------ | ------ | --------------------------------------------------------------------------------------- |
| `name`                   | String | Customer name. Printed as its own "Customer: {name}" row directly under the Date/Cashier rows, before the item table. |
| `loyaltyPoints.earned`   | Number | Loyalty points earned on this bill.                                                  |
| `loyaltyPoints.total`    | Number | Customer's total loyalty point balance.                                              |

`name` and `loyaltyPoints` are independently optional — supplying one without the other prints only that piece. When `loyaltyPoints` is present, a bordered loyalty points box is printed after the Payment Details/Status section, before the "THANK YOU!" footer and barcode (if any). When `customer` is omitted entirely, neither the name row nor the points box are printed.

### `print_barcode` (Optional, top-level)

| Field           | Type    | Description                                                                                                                                              |
| --------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `print_barcode` | Boolean | When `true`, a Code128 barcode encoding `meta.id` is printed as a new section at the very end of the invoice, below the footer. Omit or set `false` to skip it. |

## Cash Drawer Kick (`kick_drawer`)

The boxed template supports `kick_drawer` the same way as the default layout — see [Cash Drawer Kick](receipt-printing.md#cash-drawer-kick-kick_drawer) in the main document.
