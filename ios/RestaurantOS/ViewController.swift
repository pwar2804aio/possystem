import UIKit
import WebKit

class ViewController: UIViewController {

    private static let POS_URL = URL(string: "https://possystem-liard.vercel.app/?mode=pos")!

    private var webView: WKWebView!
    private var printerBridge: PrinterBridge!

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override func viewDidLoad() {
        super.viewDidLoad()
        setupWebView()
        loadPOS()
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    // ── WebView setup ─────────────────────────────────────────────────────────

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Inject window.RposPrinter shim before page loads
        config.userContentController.addUserScript(PrinterBridge.injectionScript)

        // Create webView first (needed by bridge)
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = .black

        // Sunmi user agent — same as Android so server-side UA detection works
        webView.customUserAgent =
            "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) " +
            "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
            "Version/17.0 Mobile/15E148 Safari/604.1 RestaurantOS/1.0 RPOS-iOS/1.0"

        view.addSubview(webView)

        // Wire printer bridge — must be after webView is created
        printerBridge = PrinterBridge(webView: webView)
        config.userContentController.add(printerBridge, name: "RposPrinter")
    }

    private func loadPOS() {
        let request = URLRequest(
            url: Self.POS_URL,
            cachePolicy: .reloadIgnoringLocalCacheData,
            timeoutInterval: 30
        )
        webView.load(request)
    }

    // ── Deinit ────────────────────────────────────────────────────────────────

    deinit {
        // Required to avoid memory leak — WKUserContentController retains message handlers
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "RposPrinter")
    }
}

// ── WKNavigationDelegate ──────────────────────────────────────────────────────

extension ViewController: WKNavigationDelegate {

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        // Auto-reload on network error after 5 seconds — matches Android behaviour
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
            self?.loadPOS()
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
            self?.loadPOS()
        }
    }

    // Only allow our app domain + Supabase — mirrors Android shouldOverrideUrlLoading
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url?.absoluteString else {
            decisionHandler(.cancel)
            return
        }
        let allowed = url.hasPrefix("https://possystem-liard.vercel.app") ||
                      url.hasPrefix("https://tbetcegmszzotrwdtqhi.supabase.co")
        decisionHandler(allowed ? .allow : .cancel)
    }
}
