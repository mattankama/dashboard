// The launchd job file for the hourly weekly run. install.sh runs this file to
// render it: `node src/launchd.ts <node> <appDir> <home>` prints the plist.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LABEL = "org.dashboard.weekly";

const XML: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const xml = (text: string) => text.replace(/[&<>"']/g, (c) => XML[c]);

/**
 * Hourly and at load (so also at login and after a reboot). launchd doesn't load
 * nvm, so Node's full path goes in; system tools come from a plain system PATH.
 */
export function renderPlist({ node, appDir, home }: { node: string; appDir: string; home: string }): string {
  const log = path.join(home, "Library", "Logs", "dashboard.launchd.log");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(node)}</string>
    <string>${xml(path.join(appDir, "src", "weekly.ts"))}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xml(appDir)}</string>
  <key>StartInterval</key>
  <integer>3600</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${xml(log)}</string>
  <key>StandardErrorPath</key>
  <string>${xml(log)}</string>
</dict>
</plist>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [node, appDir, home] = process.argv.slice(2);
  if (!node || !appDir || !home) {
    console.error("usage: node src/launchd.ts <node> <appDir> <home>");
    process.exit(2);
  }
  process.stdout.write(renderPlist({ node, appDir, home }));
}
