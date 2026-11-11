# Demo-chat screenshots

Add reviewed interface screenshots from an isolated demo environment here. No screenshots have been captured for this documentation yet; the website intentionally shows an empty state instead of simulated product screens.

Suggested files:
- `01-sign-in.webp`: account identification / new-customer form
- `02-email-verification.webp`: OTP form with the code field empty
- `03-live-catalog.webp`: a fictional demo-product question and answer from the isolated demo database
- `04-saved-addresses.webp`: saved-address selection using a fictional account in an isolated demo environment
- `05-order-confirmation.webp`: review card before confirmation
- `06-chat-retrieval.webp`: saved-chat ID retrieval / verification flow

Use an isolated demo database containing fictional products and accounts only. Never capture the real business database, schema/table names, customer records, catalog details or live customer interface, even with redactions. Use fictional names, addresses and chat IDs; keep OTP fields empty and omit tokens, cookies and credentials. Do not place an order or send an email simply to obtain a screenshot. Use WebP or PNG, roughly 1440px wide for desktop; keep readable text and avoid excessive image size. Do not fabricate screens.

To publish an image, update `manifest.json`:

```json
{
  "screenshots": [
    {
      "file": "01-sign-in.webp",
      "title": "Identify your account",
      "alt": "Veyrix chat displaying its email or mobile sign-in form",
      "caption": "Actual interface capture using isolated fictional demo records."
    }
  ]
}
```

Only flat `.png`, `.jpg`, `.jpeg`, or `.webp` filenames are accepted by the page. The gallery loads this manifest at runtime, so screenshots can be added without changing the React component. Review the final public assets before deploying the documentation.

