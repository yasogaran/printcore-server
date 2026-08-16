# PrintCore 🖨️

Welcome to **PrintCore**! This is a simple, lightweight Node.js server that acts as a bridge between your web applications and physical thermal printers (like Xprinter).

Instead of dealing with complex printer drivers in the browser, you can simply send a JSON request or an image to this server, and it will handle the heavy lifting of converting it to printer commands (TSPL) and printing it instantly!

Created by **Yasogaran** at [Hexcore Pvt Limited](https://hexcore.lk).

---

## 🌟 Features

- **Easy API Integration:** Print directly from any frontend (React, Vue, plain HTML) using standard HTTP `POST` requests.
- **JSON to Receipt:** Send structured JSON (store name, items, totals) and the server will beautifully format it into a receipt.
- **Image Printing:** Upload base64 images (like logos or QR codes) directly to the printer.
- **Smart Image Processing:** Automatically scales images to fit paper widths (58mm or 80mm). Supports both high-quality **Grayscale** (Dithering) for photos and crisp **Black & White** (Thresholding) for barcodes.
- **Development Mode (Virtual Printer):** Don't want to waste paper while coding? The server saves preview images of your receipts directly to your computer!

## 🚀 Getting Started (For Beginners)

### 1. Prerequisites

- **Node.js:** Make sure you have [Node.js](https://nodejs.org/) installed on your computer.
- **Zadig USB Driver (Windows Only):** To allow Node.js to communicate directly with your physical USB thermal printer, you must replace the default Windows printer driver with the **WinUSB** driver.
  1. Download [Zadig](https://zadig.akeo.ie/).
  2. Open Zadig, go to `Options` > `List All Devices`.
  3. Select your thermal printer (e.g., Xprinter) from the dropdown.
  4. Select **WinUSB** as the target driver and click **Replace Driver**.

### 2. Installation

Open your terminal (Command Prompt or Terminal) and run:

```bash
# Clone the repository
git clone https://github.com/yasogaran/printcore.git

# Go into the project folder
cd printcore

# Install the required packages
npm install
```

### 3. Start the Server

```bash
npm start
```

_You should see a message saying the server is running on port 3000 (or whichever port is in your config)._

## 📖 API Documentation

Detailed documentation for each endpoint is available in the `docs/` folder:

- **[Image Printing Guide](./docs/image-printing.md)** - How to print base64 images and use the `color` conversion modes.
- **[JSON Receipt Printing Guide](./docs/receipt-printing.md)** - How to send structured JSON arrays to generate automated retail receipts.
- **[Label Printing Guide](./docs/label-image-printing.md)** - How to print fixed-size stickers and labels.

### 🩺 Health Check (`/api`)

You can check if the server is running and whether the physical printer is successfully connected by making a simple GET request to the `/api` endpoint.

```javascript
const response = await fetch("http://localhost:3000/api");
const data = await response.json();

/* Returns:
{
  "service": "PrintCore Thermal Print Server",
  "status": "active",
  "printerConnected": true,
  "mode": "production"
}
*/
```

### Quick Example: Printing an Image

```javascript
// Example using fetch in JavaScript
const response = await fetch("http://localhost:3000/api/v2/print/image", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    image: "data:image/png;base64,...", // Your base64 image
    width: 80, // 80mm paper width
    color: "black_white", // Great for crisp text & QR codes!
  }),
});
```

## 🛠️ Built With

- **Node.js** & **Express** - For the API server.
- **Canvas** - For rendering text and layouts before converting to printer bits.

## 👨‍💻 Author

**Yasogaran**

- GitHub: [@yasogaran](https://github.com/yasogaran)
- Company: [Hexcore Pvt Limited](https://hexcore.lk)

---

_If you find this project helpful, feel free to give it a ⭐️ on GitHub!_
