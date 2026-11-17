const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => { errors.push(error.message); console.error(error.message); });
    await page.goto("http://localhost:5173/");
    await page.getByRole("button", { name: "Pemantauan Harian", exact: true }).click();
    await page.getByRole("heading", { name: "Pemantauan Harian" }).waitFor();
    await page.getByLabel("Kelas Dipantau").selectOption({ label: "5 Inovatif" });
    await page.waitForFunction(() => !document.body.textContent.includes("Memuatkan jadual waktu..."));
    console.log("Live app:", await page.locator("section").innerText());

    const styles = fs.readFileSync("index.html", "utf8").match(/<style>[\s\S]*?<\/style>/)[0];
    await page.route("**/monitoring-verification", (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><script src="https://cdn.tailwindcss.com"></script>${styles}</head><body><div id="root" class="theme-root mx-auto max-w-6xl p-4"></div><script type="module">
      import React from '/node_modules/.vite/deps/react.js';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
      const { createRoot } = ReactDOM;
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const { default: DailyMonitoring } = await import('/src/DailyMonitoring.jsx');
      const today = { hari: 'Isnin', tarikh: '16/11/2026' };
      const slots = [
        {masa:'7:15 - 7:45',mula:435,tamat:465},
        {masa:'8:15 - 8:45',mula:495,tamat:525},
        {masa:'9:15 - 9:45',mula:555,tamat:585},
        {masa:'10:15 - 10:35 (REHAT)',mula:615,tamat:635,rehat:true},
        {masa:'10:35 - 11:05',mula:635,tamat:665}
      ];
      const timetable = slots.map((s,i)=>({...s,kelas:'5 Inovatif',hari:'Isnin',mataPelajaran:['PI/PM','BM','Sc','','BI'][i]}));
      const record = {kelas:'5 Inovatif',tarikh:today.tarikh,masaArray:[slots[0].masa],jenisGuru:'Guru Mata Pelajaran',masaHantar:'07:16:00 PG'};
      const initialRecords = [{...record,guru:'Guru A'},{...record,guru:'Guru B'}];
      function Fixture() {
        const [records,setRecords] = React.useState(initialRecords);
        window.receiveRecord = () => setRecords([...initialRecords,{...record,guru:'Guru C',masaArray:[slots[1].masa]}]);
        return React.createElement(DailyMonitoring,{classes:['5 Inovatif'],records,timetable,today,minute:570,getSlots:()=>slots,online:true,timetableState:'ready'});
      }
      createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    </script></body></html>` }));
    await page.goto("http://localhost:5173/monitoring-verification");
    await page.getByRole("heading", { name: "Pemantauan Harian" }).waitFor();
    assert.equal(await page.locator("tbody tr").count(), 5);
    const missing = page.locator("tbody tr").filter({ hasText: "8:15 - 8:45" });
    assert.match(await missing.innerText(), /BM[\s\S]*Terlepas Tanpa Rekod/);
    assert.match(await page.locator("tbody tr").first().innerText(), /Guru A[\s\S]*Guru B/);
    await page.getByLabel("Status Slot").selectOption("terlepas");
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page.evaluate(() => window.receiveRecord());
    await page.getByText("Tiada slot bagi status yang dipilih.").waitFor();
    await page.getByLabel("Status Slot").selectOption("semua");
    assert.match(await missing.innerText(), /Guru C[\s\S]*Sudah Direkod/);
    await page.screenshot({ path: path.join(os.tmpdir(), "mmi-monitor-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(os.tmpdir(), "mmi-monitor-mobile.png"), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(os.tmpdir(), "mmi-monitor-mobile-dark.png"), fullPage: true });
    assert.deepEqual(errors, []);
    console.log("PASS: live read, all slots, missing subjects, concurrent teachers, status filter, incoming record update, mobile width, light/dark screenshots, no runtime errors.");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
