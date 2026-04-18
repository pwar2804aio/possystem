import WebKit

/**
 * PrinterBridge — exposes window.RposPrinter to the React web app via WKWebView.
 *
 * On iOS, WKWebView doesn't support JavascriptInterface like Android.
 * Instead we inject a JS shim at document start that creates window.RposPrinter
 * as a plain JS object, internally routing calls to WKScriptMessageHandler.
 *
 * The React app calls:
 *   window.RposPrinter.print(base64, ip, port, callbackId)
 *   window.RposPrinter.openCashDrawer(ip, port, callbackId)
 *   window.RposPrinter.isAvailable()
 *
 * This is identical to the Android JavascriptInterface — zero React code changes.
 */
class PrinterBridge: NSObject, WKScriptMessageHandler {

    private let printer = NetworkPrinter()
    private weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
    }

    // ── JS shim injected at document start ────────────────────────────────────
    // Creates window.RposPrinter with the same API as Android's JavascriptInterface.
    // Android uses direct method calls; iOS routes through postMessage.

    static var injectionScript: WKUserScript {
        let js = """
        window.RposPrinter = {
            isAvailable: function() { return 'true'; },

            print: function(base64, ip, port, callbackId) {
                window.webkit.messageHandlers.RposPrinter.postMessage({
                    action: 'print',
                    base64: base64,
                    ip: ip,
                    port: port,
                    callbackId: callbackId
                });
            },

            openCashDrawer: function(ip, port, callbackId) {
                window.webkit.messageHandlers.RposPrinter.postMessage({
                    action: 'openCashDrawer',
                    ip: ip,
                    port: port,
                    callbackId: callbackId
                });
            }
        };
        console.log('[RPOS] Native printer bridge ready (iOS)');
        """
        return WKUserScript(
            source: js,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
    }

    // ── Handle messages from JS ───────────────────────────────────────────────

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "RposPrinter",
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {
        case "print":
            handlePrint(body: body)
        case "openCashDrawer":
            handleCashDrawer(body: body)
        default:
            break
        }
    }

    // ── Print handler ─────────────────────────────────────────────────────────

    private func handlePrint(body: [String: Any]) {
        guard
            let base64 = body["base64"] as? String,
            let ip = body["ip"] as? String,
            let port = body["port"] as? UInt16,
            let callbackId = body["callbackId"] as? String,
            let data = Data(base64Encoded: base64)
        else {
            notifyJS(callbackId: body["callbackId"] as? String, success: false, error: "Invalid parameters")
            return
        }

        printer.print(ipAddress: ip, port: port, data: data) { [weak self] result in
            switch result {
            case .success:
                self?.notifyJS(callbackId: callbackId, success: true, error: nil)
            case .failure(let error):
                self?.notifyJS(callbackId: callbackId, success: false, error: error.localizedDescription)
            }
        }
    }

    // ── Cash drawer handler ───────────────────────────────────────────────────

    private func handleCashDrawer(body: [String: Any]) {
        guard
            let ip = body["ip"] as? String,
            let port = body["port"] as? UInt16,
            let callbackId = body["callbackId"] as? String
        else {
            notifyJS(callbackId: body["callbackId"] as? String, success: false, error: "Invalid parameters")
            return
        }

        printer.openCashDrawer(ipAddress: ip, port: port) { [weak self] result in
            switch result {
            case .success:
                self?.notifyJS(callbackId: callbackId, success: true, error: nil)
            case .failure(let error):
                self?.notifyJS(callbackId: callbackId, success: false, error: error.localizedDescription)
            }
        }
    }

    // ── Fire JS callback ──────────────────────────────────────────────────────

    private func notifyJS(callbackId: String?, success: Bool, error: String?) {
        guard let callbackId = callbackId else { return }
        let errorStr = (error ?? "").replacingOccurrences(of: "'", with: "\\'")
        let js = "window.__rposPrintCallback && window.__rposPrintCallback('\(callbackId)',\(success),'\(errorStr)')"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}
