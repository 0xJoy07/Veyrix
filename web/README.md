# Veyrix documentation website

React + TypeScript + Vite documentation for the working Veyrix prototype. This static website does not connect to customer data, read credentials, send email, or run checkout. The interactive shopping app lives in `../chat`.

## Run and build

```powershell
npm install --prefix web
npm run dev --prefix web
npm run build --prefix web
```

Run commands from the repository root. Vite prints the local documentation URL (normally port 5173). The chat application separately uses port 5174.

## Pages

- `/`: product overview and illustrative workflow.
- `/docs`: capabilities, privacy, persistence and project layout.
- `/docs/quickstart`: current setup, configuration, launch commands and troubleshooting.
- `/docs/demo-chat`: interactive customer journey and screenshot gallery.
- `/architecture`: browser proxy, Node/Prisma service, stateless Python worker and Supabase data flow.
- `/status`: implemented prototype features, verification evidence and remaining limits.

Source of truth: `setup/node/src`, `setup/node/prisma`, `setup/python/api/stateless.py`, `setup/python/agent/stateless.py`, and `chat/src`. Documentation describes the implementation as reviewed on 11 November 2026. Counts presented as verification snapshots are not live telemetry or promises of current inventory.

Prisma reads the configured remote catalog through live SQL views. Customers, saved addresses, chats, carts, OTP challenges and order state persist in Supabase. Public documentation uses fictional demo records only; never publish real database identifiers, catalog counts, products, prices or connection details.

## Screenshots

Put demo screenshots in `public/screenshots/demochat/` and follow its README. The gallery must use genuine UI captures from an isolated demo environment with fictional records, and clearly identify missing assets. Never include customer email addresses, phone numbers, delivery addresses, real OTPs, keys, or session cookies in published captures. Do not replace missing captures with generated images presented as screenshots.

## Deployment

`npm run build --prefix web` outputs `web/dist`. Existing `public/_redirects` and `vercel.json` support SPA routes. Other static hosts must return `index.html` for documentation routes. This update changes the local repository; it does not deploy the shopping services or publish private customer data.

## Verification

Run the production build for TypeScript and asset validation. Check navigation, anchor links, narrow layouts, copyable commands, and missing-screenshot states when a browser preview is available. The documentation is not a live status monitor.
