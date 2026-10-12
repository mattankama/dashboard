# Setting up Dashboard

Everything that needs your accounts, passwords or OK, in order. Each part works on its own, so you can stop between parts. Every command block starts by going to its folder, so you can paste it from anywhere in Terminal.

At any point, `cd ~/code/dashboard/apps/printer && npm run status` shows what's set up and what isn't.

---

## 1. Look at the sheet (2 minutes, no accounts)

```
cd ~/code/dashboard/apps/printer
npm run dry-run -- --sample
open out/
```

That's the weekly sheet with example items, as a PDF. Nothing is printed. If you'd like anything about its look changed, say so.

## 2. Email: a Gmail app password (5 minutes)

The job emails the PDF from a Gmail (or Google Workspace) account, using an **app password**, which is not your normal password.

1. In your Google Account → **Security**, turn on **2-Step Verification** if it's off.
2. Search the account settings for **App passwords**, and create one named "Dashboard". Copy the 16 letters.
3. Make the settings file and open it:
   ```
   cd ~/code/dashboard/apps/printer
   cp .env.example .env
   open -e .env
   ```
4. Fill in:
   - `GMAIL_USER`: the Gmail address to send from;
   - `GMAIL_APP_PASSWORD`: the 16 letters;
   - `NOTIFY_TO`: your own address (it only ever emails this one).

`.env` stays on your Mac: git ignores it.

## 3. Grouping: an Anthropic API key (optional, 5 minutes, a few cents a week)

Without a key, the sheet is one plain list. With one, Claude groups the items under short headings.

1. At the Claude Console (`console.anthropic.com`), create an API key and add a small amount of prepaid credit. This is billed separately from a Claude subscription.
2. In `apps/printer/.env`, set `ANTHROPIC_API_KEY=` to the key.
3. Check it: `cd ~/code/dashboard/apps/printer && npm run dry-run -- --sample`, then open the new PDF in `out/`. It should have headings now.

## 4. Put the app online with Cloudflare (20 minutes, free)

1. Create a free account at `dash.cloudflare.com/sign-up`.
2. Log in from the Mac (a browser window opens):
   ```
   cd ~/code/dashboard/apps/web
   npx wrangler login
   ```
3. Deploy:
   ```
   cd ~/code/dashboard/apps/web
   npm run deploy
   ```
   It prints your app's address, like `https://dashboard.<your-name>.workers.dev`. If it asks you to pick a `workers.dev` name, any name is fine.
   - The first deploy also creates the database and writes its id into `wrangler.jsonc`. Save that change:
     ```
     git add wrangler.jsonc && git commit -m "Record the D1 database id" && git push
     ```
4. Create the database tables (answer `y`):
   ```
   cd ~/code/dashboard/apps/web
   npm run db:migrate:remote
   ```
5. Make a printer token. It's a password shared between your app on Cloudflare and your Mac, so the Mac can fetch your items. Both places need the exact same token.
   1. Invent one: this prints a random line of 64 letters and digits. Copy that line.
      ```
      cd ~/code/dashboard/apps/web
      openssl rand -hex 32
      ```
   2. Give it to Cloudflare: when this asks "Enter a secret value", paste the line and press Enter.
      ```
      cd ~/code/dashboard/apps/web
      npx wrangler secret put PRINTER_TOKEN
      ```
   3. Give the same line to your Mac, along with your app's address. Open the Mac's settings file:
      ```
      open -e ~/code/dashboard/apps/printer/.env
      ```
      Change these two lines, using your own values (no slash at the end of the address):
      ```
      DASHBOARD_API_URL=https://dashboard.yourname.workers.dev
      PRINTER_TOKEN=the-64-characters-you-copied
      ```
   **Your app's address** is the `https://dashboard.….workers.dev` line that `npm run deploy` printed in step 3. If it's gone, find it in the Cloudflare dashboard under **Workers & Pages → dashboard**, or run `npm run deploy` again (harmless) to see it.

The app is online now, but its data is locked: it answers "Access isn't configured" until step 5. Your local test items don't move online; you start fresh.

## 5. Lock it to you with Cloudflare Access (15 minutes, free)

1. In the Cloudflare dashboard: **Workers & Pages** → **dashboard** → find **Cloudflare Access** (the Worker's **Access** tab, or **Settings → Domains & Routes → workers.dev**) → **Enable Cloudflare Access** for all traffic.
   - Allow only your email address.
   - If Cloudflare asks you to set up **Zero Trust** first, pick a team name; the free plan is enough.
2. Copy two values into `apps/web/wrangler.jsonc` under `"vars"`:
   - `ACCESS_TEAM_DOMAIN`: your team address, like `https://<team>.cloudflareaccess.com`. It's under **Zero Trust → Settings**.
   - `ACCESS_AUD`: the **Application Audience (AUD) Tag**. It's under **Zero Trust → Access → Applications → (the dashboard app)**.
3. Deploy again and save:
   ```
   cd ~/code/dashboard/apps/web
   npm run deploy
   git add wrangler.jsonc && git commit -m "Turn on the Access check" && git push
   ```
4. Let the Mac through Access:
   - In **Zero Trust → Access → Service credentials → Service Tokens**, create a token named "dashboard-printer". Copy the **Client ID** and **Client Secret**; the secret is shown only once.
   - In the dashboard app's **Policies**, add a policy with **Action: Service Auth**, including that service token.
   - In `apps/printer/.env`, set `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.
5. On your phone, open the app's address. Log in (Access emails you a code), then in Safari choose **Share → Add to Home Screen**.

## 6. Start the weekly printing (5 minutes)

1. Check everything: `cd ~/code/dashboard/apps/printer && npm run status`. "Settings", "Printer" and "Web app" should all be fine. "Installed" will say no.
2. A first real test: this prints a sheet and emails you right away.
   ```
   cd ~/code/dashboard/apps/printer
   npm run weekly -- --force
   ```
3. Install the hourly job. It prints on Sundays at 09:00 from now on, and catches up if the Mac was away:
   ```
   cd ~/code/dashboard/apps/printer
   ./install.sh
   npm run status
   ```
   "Installed" should now say yes.
4. When macOS asks whether **Script Editor** may show notifications, allow it. That's how the job tells you about problems if email fails.
5. Optional: wake the Mac at 08:55 on Sundays when it's plugged in. This replaces any repeating wake schedule you already have; check with `pmset -g sched`.
   ```
   sudo pmset repeat wakeorpoweron U 08:55:00
   ```

## If something's off

- `cd ~/code/dashboard/apps/printer && npm run status` first.
- The log is `~/Library/Logs/dashboard.log`. Crashes go to `~/Library/Logs/dashboard.launchd.log`.
- Stop the weekly job: `cd ~/code/dashboard/apps/printer && ./uninstall.sh` (your settings stay).
- After upgrading Node with nvm, run it again: `cd ~/code/dashboard/apps/printer && ./install.sh`.
