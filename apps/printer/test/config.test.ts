import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { missingForDryRun, missingForRealRun, parseConfig } from "../src/config.ts";

const HOME = "/Users/someone";

function configOf(env: Record<string, string | undefined>) {
  const result = parseConfig(env, HOME);
  assert.ok(result.ok, `expected ok, got ${JSON.stringify(result)}`);
  return result.config;
}

describe("parseConfig", () => {
  it("uses the spec's defaults when nothing is set", () => {
    const config = configOf({});

    assert.deepEqual(config.schedule, { weekday: 0, hour: 9, minute: 0 });
    assert.equal(config.printerName, "CanonMF4800");
    assert.equal(config.chromePath, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    assert.equal(config.stateDir, "/Users/someone/Library/Application Support/dashboard");
    assert.equal(config.logFile, "/Users/someone/Library/Logs/dashboard.log");
    assert.equal(config.apiUrl, null);
    assert.equal(config.anthropicApiKey, null);
  });

  it("treats empty values as unset", () => {
    const config = configOf({ GMAIL_USER: "", PRINTER_TOKEN: "   ", DASHBOARD_API_URL: "" });

    assert.equal(config.gmailUser, null);
    assert.equal(config.printerToken, null);
    assert.equal(config.apiUrl, null);
  });

  it("reads the print day and time", () => {
    assert.deepEqual(configOf({ PRINT_DAY: "sat", PRINT_TIME: "07:30" }).schedule, { weekday: 6, hour: 7, minute: 30 });
    assert.deepEqual(configOf({ PRINT_DAY: "Sunday", PRINT_TIME: "21:05" }).schedule, { weekday: 0, hour: 21, minute: 5 });
  });

  it("rejects a bad day, time, URL or address, naming the setting but not its value", () => {
    const result = parseConfig(
      { PRINT_DAY: "Someday", PRINT_TIME: "9am", DASHBOARD_API_URL: "not a url", NOTIFY_TO: "me@x.com, you@y.com" },
      HOME,
    );

    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.deepEqual(result.errors, [
      "PRINT_DAY must be a day of the week, like Sun",
      "PRINT_TIME must be 24-hour HH:MM, like 09:00",
      "DASHBOARD_API_URL must be an http(s) URL",
      "NOTIFY_TO must be one email address",
    ]);
  });

  it("lets the state directory and log file be moved (for tests and Phase 3)", () => {
    const config = configOf({ DASHBOARD_STATE_DIR: "/tmp/dash-state", DASHBOARD_LOG_FILE: "/tmp/dash.log" });

    assert.equal(config.stateDir, "/tmp/dash-state");
    assert.equal(config.logFile, "/tmp/dash.log");
  });
});

describe("what a run needs", () => {
  it("a real run needs the API, the token and email; Claude is optional", () => {
    assert.deepEqual(missingForRealRun(configOf({})), [
      "DASHBOARD_API_URL",
      "PRINTER_TOKEN",
      "GMAIL_USER",
      "GMAIL_APP_PASSWORD",
      "NOTIFY_TO",
    ]);
  });

  it("a complete config needs nothing more", () => {
    const config = configOf({
      DASHBOARD_API_URL: "http://localhost:8787",
      PRINTER_TOKEN: "t",
      GMAIL_USER: "me@example.com",
      GMAIL_APP_PASSWORD: "p",
      NOTIFY_TO: "me@example.com",
    });

    assert.deepEqual(missingForRealRun(config), []);
  });

  it("a dry run needs the API unless it uses the sample items", () => {
    assert.deepEqual(missingForDryRun(configOf({}), false), ["DASHBOARD_API_URL", "PRINTER_TOKEN"]);
    assert.deepEqual(missingForDryRun(configOf({}), true), []);
  });
});
