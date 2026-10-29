// Floating keymap viewer: a panel that stays on top on every Space and doesn't
// take focus when shown, so you can keep typing while looking at it.
// Launching the app again (open -a Keymap) toggles the panel.
// ⌘Q quits, ⌘W hides; the page asks for preset sizes via the "resize" message.

import AppKit
import WebKit

final class KeymapPanel: NSPanel {
    // accessory app has no menu bar, so handle the usual shortcuts here
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        guard event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command else {
            return super.performKeyEquivalent(with: event)
        }
        // key codes, not characters, so it also works with the Russian input source
        switch Int(event.keyCode) {
        case 12: NSApp.terminate(nil) // Q
        case 13: orderOut(nil) // W
        default: return super.performKeyEquivalent(with: event)
        }
        return true
    }

    // keys the page doesn't use would end here and beep
    override func noResponder(for eventSelector: Selector) {
        if eventSelector == #selector(NSResponder.keyDown(with:)) { return }
        super.noResponder(for: eventSelector)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    var panel: NSPanel!

    func applicationDidFinishLaunching(_ notification: Notification) {
        panel = KeymapPanel(
            contentRect: NSRect(x: 0, y: 0, width: 760, height: 300),
            styleMask: [.titled, .closable, .resizable, .nonactivatingPanel, .utilityWindow],
            backing: .buffered,
            defer: false
        )
        panel.title = "Keymap"
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.hidesOnDeactivate = false
        panel.becomesKeyOnlyIfNeeded = true
        panel.isReleasedWhenClosed = false

        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "resize")
        // window corner radius (private, 16 on macOS 26) so the focus border follows the bottom corners
        let corner = (panel.value(forKey: "_cornerRadius") as? Double) ?? 16
        config.userContentController.addUserScript(WKUserScript(
            source: "document.documentElement.style.setProperty('--corner', '\(corner)px')",
            injectionTime: .atDocumentEnd, forMainFrameOnly: true
        ))
        let web = WKWebView(frame: panel.contentView!.bounds, configuration: config)
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")
        if let page = Bundle.main.url(forResource: "keymap", withExtension: "html") {
            web.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
        }
        panel.contentView = web

        // page draws a border while the panel has keyboard focus
        for (name, focused) in [(NSWindow.didBecomeKeyNotification, true), (NSWindow.didResignKeyNotification, false)] {
            NotificationCenter.default.addObserver(forName: name, object: panel, queue: .main) { _ in
                web.evaluateJavaScript("document.body.classList.toggle('focused', \(focused))")
            }
        }

        panel.center()
        panel.setFrameAutosaveName("KeymapPanel")
        panel.orderFrontRegardless()
    }

    // `open -a Keymap` while running: show/hide
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if panel.isVisible {
            panel.orderOut(nil)
        } else {
            panel.orderFrontRegardless()
        }
        return false
    }

    // {width, height} of the content; keep the top-left corner in place
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let size = message.body as? [String: Double], let w = size["width"], let h = size["height"] else { return }
        let topLeft = NSPoint(x: panel.frame.minX, y: panel.frame.maxY)
        panel.setContentSize(NSSize(width: w, height: h))
        panel.setFrameTopLeftPoint(topLeft)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory) // no Dock icon
app.run()
