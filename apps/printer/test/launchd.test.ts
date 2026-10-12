import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { LABEL, renderPlist } from "../src/launchd.ts";
import { run } from "../src/run.ts";

const PATHS = { node: "/Users/me/.nvm/versions/node/v24.16.0/bin/node", appDir: "/Users/me/code/dashboard/apps/printer", home: "/Users/me" };

describe("renderPlist", () => {
  const plist = renderPlist(PATHS);

  it("runs the weekly job with Node's full path, hourly and at load", () => {
    assert.match(plist, new RegExp(`<key>Label</key>\\s*<string>${LABEL}</string>`));
    assert.match(
      plist,
      /<key>ProgramArguments<\/key>\s*<array>\s*<string>\/Users\/me\/\.nvm\/versions\/node\/v24\.16\.0\/bin\/node<\/string>\s*<string>\/Users\/me\/code\/dashboard\/apps\/printer\/src\/weekly\.ts<\/string>\s*<\/array>/,
    );
    assert.match(plist, /<key>WorkingDirectory<\/key>\s*<string>\/Users\/me\/code\/dashboard\/apps\/printer<\/string>/);
    assert.match(plist, /<key>StartInterval<\/key>\s*<integer>3600<\/integer>/);
    assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/);
  });

  it("gives the job the system tools' PATH and a log for crashes", () => {
    assert.match(plist, /<key>PATH<\/key>\s*<string>\/usr\/bin:\/bin:\/usr\/sbin:\/sbin<\/string>/);
    assert.match(plist, /<key>StandardErrorPath<\/key>\s*<string>\/Users\/me\/Library\/Logs\/dashboard\.launchd\.log<\/string>/);
  });

  it("escapes paths for XML", () => {
    const odd = renderPlist({ ...PATHS, appDir: "/Users/me/R&D <work>/printer" });
    assert.ok(odd.includes("<string>/Users/me/R&amp;D &lt;work&gt;/printer/src/weekly.ts</string>"));
  });

  it("is a valid property list (checked by macOS's plutil)", { skip: !existsSync("/usr/bin/plutil") && "no plutil" }, async () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "dash-plist-")), "job.plist");
    writeFileSync(file, renderPlist({ ...PATHS, appDir: "/Users/me/R&D <work>/printer" }));

    const result = await run("plutil", ["-lint", file]);
    assert.equal(result.code, 0, result.stdout + result.stderr);
  });
});
