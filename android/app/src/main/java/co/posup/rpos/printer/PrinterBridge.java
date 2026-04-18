package co.posup.rpos.printer;

import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import co.posup.rpos.printer.NetworkPrinter;

/**
 * PrinterBridge — exposes window.RposPrinter to the React web app via WebView.
 *
 * Usage from JavaScript:
 *   window.RposPrinter.print(base64EscPos, "192.168.1.100", 9100)
 *   window.RposPrinter.isAvailable()  → "true"
 *
 * The React app checks window.RposPrinter before calling — if undefined,
 * it falls back to the Supabase queue path for browser testing.
 */
public class PrinterBridge {

    private static final String TAG = "PrinterBridge";

    private final WebView webView;
    private final NetworkPrinter networkPrinter;

    public PrinterBridge(WebView webView) {
        this.webView = webView;
        this.networkPrinter = new NetworkPrinter();
    }

    /**
     * Called by React: window.RposPrinter.isAvailable()
     * Returns "true" so the JS side knows it's on a real device.
     */
    @JavascriptInterface
    public String isAvailable() {
        return "true";
    }

    /**
     * Called by React: window.RposPrinter.print(base64Data, ip, port)
     *
     * @param base64Data  ESC/POS bytes encoded as base64 string
     * @param ipAddress   Printer IP address
     * @param port        Printer port (9100)
     * @param callbackId  JS callback ID so we can notify success/failure
     */
    @JavascriptInterface
    public void print(String base64Data, String ipAddress, int port, String callbackId) {
        Log.d(TAG, "Print requested → " + ipAddress + ":" + port);

        byte[] bytes;
        try {
            bytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (Exception e) {
            notifyJS(callbackId, false, "Invalid base64 data: " + e.getMessage());
            return;
        }

        networkPrinter.print(ipAddress, port, bytes, new NetworkPrinter.PrintCallback() {
            @Override
            public void onSuccess() {
                notifyJS(callbackId, true, null);
            }

            @Override
            public void onError(String message) {
                notifyJS(callbackId, false, message);
            }
        });
    }

    /**
     * Called by React: window.RposPrinter.openCashDrawer(ip, port, callbackId)
     * Cash drawer is triggered via ESC p command through the receipt printer's RJ12 port.
     */
    @JavascriptInterface
    public void openCashDrawer(String ipAddress, int port, String callbackId) {
        // ESC p 0 25 25 — standard cash drawer pulse
        byte[] drawerCmd = { 0x1b, 0x70, 0x00, 0x19, 0x19 };

        networkPrinter.print(ipAddress, port, drawerCmd, new NetworkPrinter.PrintCallback() {
            @Override
            public void onSuccess() {
                notifyJS(callbackId, true, null);
            }

            @Override
            public void onError(String message) {
                notifyJS(callbackId, false, message);
            }
        });
    }

    /**
     * Fire a JS callback on the main thread so React can update UI.
     * Calls window.__rposPrintCallback(callbackId, success, errorMessage)
     */
    private void notifyJS(String callbackId, boolean success, String error) {
        if (callbackId == null || callbackId.isEmpty()) return;
        String errorStr = (error != null) ? error.replace("'", "\\'") : "";
        String js = "window.__rposPrintCallback && window.__rposPrintCallback('"
                + callbackId + "'," + success + ",'" + errorStr + "')";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    public void destroy() {
        networkPrinter.shutdown();
    }
}
