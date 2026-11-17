const vm = require("node:vm");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");

// Exercise the report template without calling Firestore, Storage or the AI service.
const sourcePath = path.resolve("functions/index.js");
const localRequire = createRequire(sourcePath);
const sandbox = {
  require: (name) => name === "firebase-admin" ? { initializeApp() {} } : localRequire(name),
  exports: {}, __dirname: path.dirname(sourcePath), __filename: sourcePath, console, process, Buffer, setTimeout, clearTimeout
};
vm.runInNewContext(fs.readFileSync(sourcePath, "utf8") + "\nthis.renderReport = janaPDFLaporan;", sandbox, { filename: sourcePath });
sandbox.renderReport({
  bulan: "November_Ujian_Aktiviti", tahun: "2026", jumlahRekod: 2, jumlahGMP: 1, jumlahSitIn: 1,
  topKelas: [{ nama: "6 Bestari", jumlah: 2 }], topGuru: [{ nama: "Guru A", jumlah: 2 }],
  topSitInKelas: [{ nama: "6 Bestari", jumlah: 1 }], guruTiadaRekod: [], rumusanAI: "Rumusan ujian laporan.",
  coverage: { required: 10, recorded: 7, missing: 3, exempt: 11 },
  activities: [{ date: "2026-11-17", title: "Lawatan Sambil Belajar Tahun 6", classes: ["6 Bestari", "6 Inovatif"], allDay: true, slots: [] }]
}).then((file) => {
  const output = path.join(os.tmpdir(), "mmi-server-activity-report.pdf");
  fs.renameSync(file, output);
  console.log(output);
}).catch((error) => { console.error(error); process.exitCode = 1; });
