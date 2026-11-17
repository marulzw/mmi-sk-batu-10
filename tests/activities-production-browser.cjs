const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ timezoneId: "Asia/Kuala_Lumpur", viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-11-17T06:30:00Z"));
    let activities = [{ id: "shared-activity-12345", date: "2026-11-17", title: "Lawatan Tahun 6", type: "Aktiviti Luar Sekolah", classes: ["6 Bestari"], allDay: true, slots: [] }];
    await page.route("**/dapatkanAktivitiKhas", (route) => route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization, x-firebase-appcheck", "access-control-allow-methods": "POST, OPTIONS" }, body: JSON.stringify({ result: { activities } }) }));
    await page.goto("http://localhost:4173/");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.getByRole("heading", { name: "Login Admin" }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Aktiviti Khas / Pengecualian Rekod" }).count(), 0);
    assert.equal(await page.getByText(/Pratonton local aktiviti khas/).count(), 0);
    await page.getByRole("button", { name: "Pemantauan Harian", exact: true }).click();
    await page.getByLabel("Kelas Dipantau").selectOption("6 Bestari");
    await page.getByLabel("Status Slot").selectOption("aktiviti");
    await page.locator("article:visible").getByText("Lawatan Tahun 6", { exact: true }).first().waitFor();
    assert.equal(await page.locator("article:visible").count(), 11);
    await page.getByLabel("Status Slot").selectOption("semua");
    assert.equal(await page.getByText("Rehat", { exact: true }).count(), 2);
    activities = [];
    await page.reload();
    await page.getByRole("button", { name: "Pemantauan Harian", exact: true }).click();
    await page.getByLabel("Kelas Dipantau").selectOption("6 Bestari");
    await page.getByLabel("Status Slot").selectOption("aktiviti");
    await page.getByText("Tiada slot bagi status yang dipilih.").waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS: production has no local-preview bypass, shared API activities appear without local storage, recess remains recess, remote cancellation removes exemption.");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
