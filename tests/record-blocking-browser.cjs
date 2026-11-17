const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ timezoneId: "Asia/Kuala_Lumpur", viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(15000);
    await page.clock.setFixedTime(new Date("2026-11-17T06:30:00Z"));
    const trip = { id: "shared-activity-12345", date: "2026-11-17", title: "Lawatan Sambil Belajar Tahun 6", type: "Aktiviti Luar Sekolah", classes: ["6 Bestari"], allDay: true, slots: [] };
    let activities = [trip];
    let writes = 0;
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/dapatkanAktivitiKhas", (route) => route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization, x-firebase-appcheck", "access-control-allow-methods": "POST, OPTIONS" }, body: JSON.stringify({ result: { activities } }) }));
    await page.route("**/hantarRekodMMI", (route) => { writes++; return route.abort(); });
    await page.goto("http://localhost:4173/");
    const form = page.locator("form").first();
    const slot = (time) => form.locator("label").filter({ hasText: time }).getByRole("checkbox");
    await form.getByRole("combobox").nth(1).selectOption("6 Bestari");
    await slot("7:45 - 8:15").waitFor();
    assert.equal(await slot("7:45 - 8:15").isDisabled(), true);
    assert.match(await form.innerText(), /Aktiviti Luar Sekolah: Lawatan Sambil Belajar Tahun 6/);
    assert.doesNotMatch(await form.innerText(), /\(Rekod disekat\)/);
    await form.getByRole("combobox").nth(1).selectOption("5 Inovatif");
    assert.equal(await slot("7:45 - 8:15").isEnabled(), true);
    activities = [];
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await form.getByRole("combobox").nth(1).selectOption("6 Bestari");
    await page.waitForFunction(() => !document.body.textContent.includes("Aktiviti Luar Sekolah: Lawatan Sambil Belajar Tahun 6"));
    await form.getByRole("combobox").nth(0).selectOption({ index: 1 });
    await slot("7:45 - 8:15").check();
    await form.getByRole("button", { name: "Hantar Rekod", exact: true }).click();
    await page.getByRole("heading", { name: "Sahkan Rekod MMI" }).waitFor();
    activities = [{ ...trip, allDay: false, slots: ["7:45 - 8:15"] }];
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByRole("heading", { name: "Sahkan Rekod MMI" }).waitFor({ state: "hidden" });
    assert.equal(await slot("7:45 - 8:15").isDisabled(), true);
    assert.equal(await slot("7:45 - 8:15").isChecked(), false);
    assert.equal(await slot("8:15 - 8:45").isEnabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(writes, 0);
    assert.deepEqual(errors, []);
    console.log("PASS: full-day block, labelled slots, other classes unaffected, cancellation unblocks, partial block, live changes clear selected slots and close confirmation. No writes.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
