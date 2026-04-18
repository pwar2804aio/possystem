# RPOS iOS App

WebView wrapper for the RPOS POS system with native WiFi printer support.

## Setup in Xcode

1. Open Xcode → File → New → Project
2. Choose **App** (not SwiftUI — use Storyboard/UIKit)
3. Settings:
   - Product Name: `RestaurantOS`
   - Bundle Identifier: `co.posup.rpos.ios`
   - Language: **Swift**
   - Interface: **Storyboard**
   - Uncheck: Include Tests

4. **Replace generated files** with the files in this folder:
   - Delete `ViewController.swift` (generated) → replace with ours
   - Delete `AppDelegate.swift` (generated) → replace with ours
   - Replace `Info.plist` entries with ours (or replace the whole file)

5. **Add Printer folder**:
   - File → Add Files → select `Printer/NetworkPrinter.swift` and `Printer/PrinterBridge.swift`

6. **Main.storyboard** — delete the default ViewController scene. Our AppDelegate creates the window programmatically.

7. **Signing**: Xcode → Project → Signing & Capabilities → set your Team

8. **Run** on iPad or iPad simulator

## Architecture

```
React app (JS)
  └─ window.RposPrinter (injected JS shim)
       └─ window.webkit.messageHandlers.RposPrinter.postMessage(...)
            └─ PrinterBridge.swift (WKScriptMessageHandler)
                 └─ NetworkPrinter.swift (Network.framework TCP)
                      └─ WiFi → Port 9100 → Printer
```

## Print flow

1. React app calls `window.RposPrinter.print(base64, ip, port, callbackId)`
2. JS shim routes to `window.webkit.messageHandlers.RposPrinter.postMessage`
3. `PrinterBridge` receives message, decodes base64 to Data
4. `NetworkPrinter` opens TCP connection to printer IP:9100
5. Sends ESC/POS bytes, closes connection
6. Fires `window.__rposPrintCallback(callbackId, success, error)` back to React

## Supported printers

- Sunmi NT311 (80mm, network)
- Epson TM-m30 (80mm, network)
- Star TSP654ii (80mm, network)
- Any ESC/POS printer on TCP port 9100

## iOS permissions required

- Local Network — for TCP connections to printers (prompted on first use)
- Camera — for future barcode scanning

## Notes

- `UIRequiresPersistentWifi = true` keeps WiFi active even when idle
- `isIdleTimerDisabled = true` keeps screen on permanently
- Only `possystem-liard.vercel.app` and Supabase URLs are allowed in the WebView
- Landscape orientation only
