import SwiftUI
import UIKit
import WebKit
import ContactsUI

@main
struct JigzoApp: App {
    var body: some Scene {
        WindowGroup { JigzoWebView() }
    }
}

private enum JigzoSite {
    #if DEBUG
    static let url = URL(string: "https://staging.jigzo.biz/create")!
    #else
    static let url = URL(string: "https://jigzo.biz/create")!
    #endif

    static var host: String { url.host! }
}

struct JigzoWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let content = WKUserContentController()
        if let scriptURL = Bundle.main.url(forResource: "ContactPickerBridge", withExtension: "js"),
           let source = try? String(contentsOf: scriptURL, encoding: .utf8) {
            let scopedSource = source.replacingOccurrences(of: "__JIGZO_ALLOWED_HOST__", with: JigzoSite.host)
            content.addUserScript(WKUserScript(source: scopedSource, injectionTime: .atDocumentStart,
                                               forMainFrameOnly: true, in: .page))
        }
        content.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "jigzoContacts")

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = content
        let webView = WKWebView(frame: .zero, configuration: configuration)
        context.coordinator.webView = webView
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: JigzoSite.url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandlerWithReply, CNContactPickerDelegate,
                             WKNavigationDelegate, WKUIDelegate {
        weak var webView: WKWebView?
        private var pendingReply: ((Any?, String?) -> Void)?

        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage,
                                   replyHandler: @escaping (Any?, String?) -> Void) {
            guard message.frameInfo.isMainFrame,
                  let frameURL = message.frameInfo.request.url,
                  frameURL.scheme == "https", frameURL.host == JigzoSite.host,
                  webView?.url?.scheme == "https", webView?.url?.host == JigzoSite.host,
                  let request = message.body as? [String: Any],
                  request["action"] as? String == "select",
                  request["multiple"] as? Bool == true,
                  let fields = request["fields"] as? [String], fields.count == 2,
                  Set(fields) == Set(["name", "tel"]),
                  pendingReply == nil,
                  let presenter = webView?.window?.rootViewController,
                  presenter.presentedViewController == nil else {
                replyHandler(nil, "Contact selection is unavailable on this page.")
                return
            }

            let picker = CNContactPickerViewController()
            picker.delegate = self
            picker.displayedPropertyKeys = [CNContactPhoneNumbersKey]
            pendingReply = replyHandler
            presenter.present(picker, animated: true)
        }

        func contactPicker(_ picker: CNContactPickerViewController, didSelect contacts: [CNContact]) {
            finish(with: contacts)
        }

        func contactPicker(_ picker: CNContactPickerViewController, didSelect contact: CNContact) {
            finish(with: [contact])
        }

        func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
            finish(with: [])
        }

        private func finish(with contacts: [CNContact]) {
            guard let reply = pendingReply else { return }
            pendingReply = nil
            guard webView?.url?.scheme == "https", webView?.url?.host == JigzoSite.host else {
                reply(nil, "The JIGZO page changed during contact selection.")
                return
            }
            // Only the user's final selection crosses the bridge. No CNContactStore access.
            let selected: [[String: Any]] = contacts.map { contact in
                let name = CNContactFormatter.string(from: contact, style: .fullName) ?? ""
                let numbers = contact.phoneNumbers.map { $0.value.stringValue }
                return ["name": [name], "tel": numbers]
            }
            reply(selected, nil)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            // Checkout may navigate to a HTTPS payment provider and then back to JIGZO.
            // The Contacts bridge remains restricted to the configured JIGZO origin.
            if url.scheme == "mailto" || url.scheme == "tel" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            } else {
                decisionHandler(url.scheme == "https" || url.scheme == "about" ? .allow : .cancel)
            }
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url, url.scheme == "https" {
                webView.load(URLRequest(url: url))
            }
            return nil
        }
    }
}
