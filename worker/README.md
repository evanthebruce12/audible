# Audible watcher

The Cloudflare Worker behind Audible's notifications and encrypted settings backups.

It runs every two minutes and checks for lineup problems, a Saturday night review, lead changes, close games, finals, waiver results, trades and the Tuesday briefing, then sends Web Push notifications to phones that signed up. It also stores PIN-protected backups of each user's settings.

## Setting it up

1. Create a Worker at [dash.cloudflare.com](https://dash.cloudflare.com) and paste in `worker.js`
2. Bind a KV namespace to it named `KV`
3. Add a cron trigger: `*/2 * * * *`
4. Deploy, then paste the Worker's URL into Audible under Settings → Notifications

VAPID keys are generated on the first run and kept in KV. No other secrets or environment variables are needed.

## What it stores

Per signed-up phone: the Sleeper user and league id, the push subscription, notification preferences, time zone, and a snapshot of roster names so alerts can be written without re-fetching everything. Backups are stored under a salted SHA-256 hash of the user's PIN, with five tries per hour.
