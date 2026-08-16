# Label Image Printing API

## Overview

The Label Image Printing endpoint allows you to print base64-encoded images on thermal labels with automatic aspect ratio preservation and centering.

## Endpoint

**URL:** `/api/v2/print/label/image`  
**Method:** `POST`  
**Content-Type:** `application/json`

## Description

This endpoint accepts a base64-encoded image along with label dimensions and prints it to a thermal label printer. The image is automatically scaled to fit within the label dimensions while preserving its original aspect ratio, and is centered both horizontally and vertically on the label.

## Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | string | Yes | Base64-encoded image string. Can include data URL prefix (e.g., `data:image/png;base64,`) or just the base64 string. Supported formats: PNG, JPEG, GIF, BMP |
| `width` | number | Yes | Label width in millimeters (mm) |
| `height` | number | Yes | Label height in millimeters (mm) |

### Example Request

```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...",
  "width": 50,
  "height": 30
}
```

Or without the data URL prefix:

```json
{
  "image": "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
  "width": 40,
  "height": 30
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
  "file": "label_image_50x30_2026-01-24T11-30-45-123Z.png"
}
```

### Error Responses

**Missing Required Fields**

**Code:** `400 Bad Request`

```json
{
  "error": "Missing required fields: image (base64), width (mm), height (mm)"
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

### Aspect Ratio Preservation

The service automatically calculates the optimal scaling to fit your image within the specified label dimensions while maintaining the original aspect ratio. This ensures images are not stretched or distorted.

**Algorithm:**
1. Calculate aspect ratios of both the image and label
2. If image is wider than label → fit to width
3. If image is taller than label → fit to height
4. Center the scaled image on the label canvas

### Example Scenarios

| Image Size | Label Size | Result |
|------------|------------|--------|
| 800×600px | 50×30mm | Scaled to fit 50mm width, centered vertically |
| 400×800px | 50×30mm | Scaled to fit 30mm height, centered horizontally |
| 500×500px | 50×30mm | Scaled to fit 30mm height (smaller dimension), centered horizontally |

### Image Conversion

- Images are converted to monochrome using Floyd-Steinberg dithering for optimal thermal printer output
- The printer resolution is 8 dots per millimeter (203 DPI)
- Final output is sent as TSPL (Thermal Printer Command Language) commands

## Development Mode

When running in development mode (`NODE_ENV=development`), the service saves debug images to the `debug_output` folder. These PNG files show exactly how the image will appear on the label, allowing you to verify:

- Correct scaling and aspect ratio preservation
- Proper centering on the label
- Image quality after monochrome conversion

Debug filenames follow the pattern: `label_image_{width}x{height}_{timestamp}.png`

## Usage Examples

### JavaScript/Node.js

```javascript
const fs = require('fs');
const axios = require('axios');

// Read image file and convert to base64
const imageBuffer = fs.readFileSync('logo.png');
const base64Image = imageBuffer.toString('base64');

// Send to printer
const response = await axios.post('http://localhost:3000/api/v2/print/label/image', {
  image: base64Image,
  width: 50,
  height: 30
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
response = requests.post('http://localhost:3000/api/v2/print/label/image', json={
    'image': encoded_image,
    'width': 50,
    'height': 30
})

print(response.json())
```

### cURL

```bash
# First, encode your image
IMAGE_BASE64=$(base64 -w 0 logo.png)

# Send request
curl -X POST http://localhost:3000/api/v2/print/label/image \
  -H "Content-Type: application/json" \
  -d "{\"image\":\"$IMAGE_BASE64\",\"width\":50,\"height\":30}"
```

## Common Use Cases

1. **Product Labels with Logos** - Print company logos or product images on labels
2. **QR Code Labels** - Generate QR codes programmatically and print them
3. **Photo Labels** - Print small photos on label stickers
4. **Barcode Labels** - Print custom barcode images
5. **Icon/Symbol Labels** - Print icons or symbols for identification

## Notes

- Maximum image size is limited by server memory and base64 string length limits
- For best results, use high-contrast images (logos work great)
- Very detailed images may lose clarity when converted to monochrome
- Common label sizes: 30×20mm, 40×30mm, 50×30mm, 60×40mm
- The printer automatically handles rotation based on label orientation

## Related Endpoints

- `POST /api/v2/print/label` - Print structured label data (product info, prices, barcodes)
- `POST /api/v2/print/receipt` - Print structured receipt data

## Support

For issues or questions, please refer to the main printer server documentation or contact the development team.
