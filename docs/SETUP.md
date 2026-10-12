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

**Staying free:** nothing in this guide needs a card. If Cloudflare asks for one, you've wandered into something paid (or Zero Trust, which this app doesn't use), so back out. The free Workers plan doesn't bill for going over its limits: things just stop until the limits reset, and this app uses a tiny fraction of them. **Billing → Subscriptions** in the dashboard should only ever show $0.

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

The app is online now, but locked: it answers "Login isn't set up" until step 5. Your local test items don't move online; you start fresh.

## 5. Choose your password (10 minutes, free)

The app has its own sign-in: one password, which you type once on each device. That device then stays signed in for a year.

1. Put the newest version online (it has the sign-in):
   ```
   cd ~/code/dashboard/apps/web
   npm run deploy
   ```
2. Make your password. This prints 24 random characters. Copy them.
   ```
   openssl rand -base64 18
   ```
   Save it in the **Passwords** app on your Mac: click **+**, then enter your app's address as the website, `Dashboard` as the user name, and paste the password. iCloud syncs it to your iPhone.
3. Give the same password to Cloudflare: when this asks "Enter a secret value", paste it and press Enter.
   ```
   cd ~/code/dashboard/apps/web
   npx wrangler secret put LOGIN_PASSWORD
   ```
4. Give Cloudflare a key for keeping you signed in. You never need to see this one: the command makes it and hands it straight over.
   ```
   cd ~/code/dashboard/apps/web
   openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
   ```
5. On your phone, open your app's address in Safari. You'll see today's date and a **Password** field at the bottom. Tap it, choose your saved password above the keyboard, and tap ↵. Your (empty) page appears.
6. Choose **Share → Add to Home Screen**, then open the app from your home screen. If it asks for the password, sign in once more: the home-screen app can keep its own sign-in, separate from Safari's.

- **Check:** in a private browser window, your app's address shows only the date and the password field.
- **Sign every device out:** run part 4 again. A new password (part 3) does the same.
- **Forgot the password:** do parts 2 and 3 again with a new one.

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
- The app says "Login isn't set up.": step 5's parts 3 and 4 aren't both done, or the password is shorter than 16 characters.
- The log is `~/Library/Logs/dashboard.log`. Crashes go to `~/Library/Logs/dashboard.launchd.log`.
- Stop the weekly job: `cd ~/code/dashboard/apps/printer && ./uninstall.sh` (your settings stay).
- After upgrading Node with nvm, run it again: `cd ~/code/dashboard/apps/printer && ./install.sh`.
