# Thermal Image Printing API

## Overview

The Thermal Image Printing endpoint allows you to print base64-encoded images on continuous thermal receipt paper. The image automatically fits to the specified paper width while maintaining its original aspect ratio.

## Endpoint

**URL:** `/api/v2/print/image`  
**Method:** `POST`  
**Content-Type:** `application/json`

## Description

This endpoint accepts a base64-encoded image along with paper width and prints it to a thermal receipt printer. The image is automatically scaled to fit the paper width while preserving its original aspect ratio. The height adjusts automatically based on the image's dimensions.

## Request Body

| Parameter | Type   | Required | Description                                                                                                                                                 |
| --------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`   | string | Yes      | Base64-encoded image string. Can include data URL prefix (e.g., `data:image/png;base64,`) or just the base64 string. Supported formats: PNG, JPEG, GIF, BMP |
| `width`   | number | Yes      | Paper width in millimeters (mm). Common values: 58, 80                                                                                                      |
| `color`   | string | No       | Image conversion mode: `grayscale` (default, uses Floyd-Steinberg dithering for photos) or `black_white` (simple thresholding for crisp barcodes/text).     |

### Example Request

```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...",
  "width": 80,
  "color": "grayscale"
}
```

Or without the data URL prefix:

```json
{
  "image": "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
  "width": 58
}
```

## Response

### Success Response (Hardware Mode)

**Code:** `200 OK`

```json
{
  "status": "success",
  "mode": "hardware"
}
```

### Success Response (Development/Virtual Mode)

**Code:** `200 OK`

```json
{
  "status": "success",
  "mode": "virtual",
  "file": "thermal_image_80mm_2026-01-25T10-30-45-123Z.png"
}
```

### Error Responses

**Missing Required Fields**

**Code:** `400 Bad Request`

```json
{
  "error": "Missing required fields: image (base64), width (mm)"
}
```

**Invalid Image Data**

**Code:** `500 Internal Server Error`

```json
{
  "error": "Failed to decode base64 image: Invalid base64 string"
}
```

**Printer Offline (Production Mode)**

**Code:** `503 Service Unavailable`

```json
{
  "error": "Printer Offline"
}
```

## Image Processing Details

### Width Fitting & Aspect Ratio Preservation

The service automatically scales your image to fit the specified paper width while maintaining the original aspect ratio. The height is calculated automatically based on the image's proportions.

**Formula:**

```
scaled_width = paper_width
scaled_height = paper_width / (image_width / image_height)
```

### Example Scenarios

| Image Size  | Paper Width | Result Width×Height      |
| ----------- | ----------- | ------------------------ |
| 800×600px   | 80mm        | 80×60mm (640×480 dots)   |
| 1200×800px  | 80mm        | 80×53mm (640×427 dots)   |
| 500×1000px  | 80mm        | 80×160mm (640×1280 dots) |
| 1000×1000px | 80mm        | 80×80mm (640×640 dots)   |

### Image Conversion

The thermal printer is a binary device (prints black dots or leaves them blank). The server handles conversion based on your `color` parameter:

1. **Grayscale (Default / `color: "grayscale"`)**
   - Uses Floyd-Steinberg dithering to scatter dots.
   - **Best for:** Photographs, complex gradients, product images.
   - **Note:** Fine text or small barcodes might look slightly fuzzy.

2. **Black & White (`color: "black_white"`)**
   - Uses simple thresholding (pixels darker than 50% become solid black).
   - **Best for:** Text documents, receipts, barcodes, QR codes, and crisp logos.

- The printer resolution is 8 dots per millimeter (203 DPI)
- Final output is sent as TSPL (Thermal Printer Command Language) commands
- Paper height is automatically calculated based on the scaled image dimensions

## Common Paper Widths

| Width (mm) | Common Usage                            |
| ---------- | --------------------------------------- |
| 58mm       | Small receipt printers, mobile printers |
| 80mm       | Standard receipt printers (most common) |

## Development Mode

When running in development mode (`NODE_ENV=development`), the service saves debug images to the `debug_output` folder. These PNG files show exactly how the image will appear on the thermal paper, allowing you to verify:

- Correct scaling and aspect ratio preservation
- Image quality after monochrome conversion
- Final dimensions

Debug filenames follow the pattern: `thermal_image_{width}mm_{timestamp}.png`

## Usage Examples

### JavaScript/Node.js

```javascript
const fs = require("fs");
const axios = require("axios");

// Read image file and convert to base64
const imageBuffer = fs.readFileSync("logo.png");
const base64Image = imageBuffer.toString("base64");

// Send to printer
const response = await axios.post("http://localhost:3000/api/v2/print/image", {
  image: base64Image,
  width: 80,
});

console.log(response.data);
```

### Python

```python
import base64
import requests

# Read and encode image
with open('logo.png', 'rb') as image_file:
    encoded_image = base64.b64encode(image_file.read()).decode('utf-8')

# Send to printer
response = requests.post('http://localhost:3000/api/v2/print/image', json={
    'image': encoded_image,
    'width': 80,
    'color': 'grayscale'
})

print(response.json())
```

### cURL

```bash
# First, encode your image
IMAGE_BASE64=$(base64 -w 0 logo.png)

# Send request
curl -X POST http://localhost:3000/api/v2/print/image \
  -H "Content-Type: application/json" \
  -d "{\"image\":\"$IMAGE_BASE64\",\"width\":80,\"color\":\"grayscale\"}"
```

### Printing a QR Code

```javascript
const QRCode = require("qrcode");

// Generate QR code as base64
const qrCodeBase64 = await QRCode.toDataURL("https://example.com");

// Print the QR code
await axios.post("http://localhost:3000/api/v2/print/image", {
  image: qrCodeBase64,
  width: 80,
  color: "black_white", // Essential for crisp, scannable QR codes
});
```

## Common Use Cases

1. **Logo Printing** - Print company logos at the top of receipts
2. **QR Code Printing** - Generate and print QR codes for digital receipts or authentication
3. **Product Images** - Print product photos on receipts
4. **Promotional Graphics** - Print promotional banners or graphics
5. **Signatures** - Print customer signatures captured digitally
6. **Charts/Graphs** - Print generated charts or data visualizations

## Tips for Best Results

1. **High Contrast Images** - Use images with good black/white contrast for clearest output
2. **Appropriate Resolution** - Image width should be at least 640px for 80mm paper (8 dots/mm × 80mm)
3. **File Size** - Keep base64 strings under 5MB for optimal performance
4. **Aspect Ratio** - Tall images (portraits) work well on thermal paper
5. **QR Codes** - Generate QR codes at least 200×200px for reliable scanning

## Comparison with Related Endpoints

| Endpoint                    | Use Case              | Required Parameters    | Height Behavior                   |
| --------------------------- | --------------------- | ---------------------- | --------------------------------- |
| `/api/v2/print/image`       | Thermal receipt paper | image, width           | Auto-calculated from aspect ratio |
| `/api/v2/print/label/image` | Fixed-size labels     | image, width, height   | Fixed, image centered             |
| `/api/v2/print/receipt`     | Structured receipts   | Structured data object | Auto-generated from content       |
| `/api/v2/print/label`       | Structured labels     | Structured data object | Fixed size                        |

## Notes

- Maximum image size is limited by server memory and base64 string length limits
- For best results with photographs, use high-resolution images with good contrast
- Very detailed images may lose some clarity when converted to monochrome
- The thermal paper is continuous, so height is not limited (unlike labels)
- Images are always printed at the full paper width

## Error Handling

The service provides detailed error messages to help troubleshoot issues:

- Missing parameters: Clear indication of required fields
- Invalid base64: Decoding error with details
- Printer offline: Service unavailable status when hardware is disconnected

## Related Endpoints

- `POST /api/v2/print/label/image` - Print images on fixed-size labels with centering
- `POST /api/v2/print/receipt` - Print structured receipt data
- `POST /api/v2/print/label` - Print structured label data

## Support

For issues or questions, please refer to the main printer server documentation or contact the development team.
