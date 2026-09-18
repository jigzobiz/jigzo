# JIGZO iPhone contact picker shell

This is a small native iPhone host for the **existing** JIGZO React website. It
uses `WKWebView` and Apple's `CNContactPickerViewController`. A document-start
script supplies the `navigator.contacts.getProperties()` and `select()` calls
already used by JIGZO's Android picker component. The web app, Android browser,
backend, checkout and WhatsApp code are unchanged.

Debug builds load `https://staging.jigzo.biz/create`; Release builds load
`https://jigzo.biz/create`. The native handler accepts contact requests only
from the configured HTTPS main-frame origin. The selected contacts' full names
and phone numbers are passed once to the React picker; no address book query,
permission prompt, persistent native copy, or unrelated contact fields exist.
React presents multiple phone-number choices and applies its existing duplicate,
international-code and consumer 50-recipient rules. Apple may allow selecting
more than 50; React adds only the available slots and displays its limit notice.
A number without `+` and a country code
remains editable and cannot be used as a valid WhatsApp recipient until fixed.

## Run on an iPhone (Mac required)

1. On a Mac, clone this branch and install a current Xcode and
   [XcodeGen](https://github.com/yonaskolb/XcodeGen). From `ios/`, run
   `xcodegen generate` and open `JIGZOiOS.xcodeproj` in Xcode.
2. Select the `JIGZO` target, choose your Apple development Team and a unique
   bundle identifier. Connect your iPhone and select it as the run destination.
3. Use the Debug scheme and Run. Verify that the app opens **staging**, then
   create a local draft through the recipient step. Tap **Choose from contacts**.
   Select several contacts, including one with two numbers and one local number
   without a country code. Choose a number in JIGZO, correct the local number
   by entering its international code, and check duplicate and 50-recipient
   behavior. Confirm manual entry remains available. Do not complete checkout
   or send a message for this picker test.
4. Test cancellation and a second selection. No Contacts permission prompt
   should appear. Safari outside this app continues to use manual entry.

This Windows checkout cannot run Xcode, compile Swift, or exercise the native
picker. `node --test ios/tests/*.test.mjs` checks the injected JavaScript bridge.

## Before TestFlight or App Store review

Add a proper 1024×1024 app icon, settle the final bundle ID and signing Team,
and archive a Release build on a Mac. The Debug staging URL is deliberately
different from Release. Test the entire web experience, redirects and payment
return in the shell on a physical iPhone. The present Tap checkout and a thin
website shell require an App Review strategy: Apple may require In-App Purchase
for digital content and may find a site wrapper insufficient under guideline
4.2. Do not submit this shell as-is without resolving those review questions.
