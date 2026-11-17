import test from "node:test";
import assert from "node:assert/strict";
import { buildMonitoringRows } from "../src/dailyMonitoring.js";

const base = {
  kelas: "5 Inovatif", hari: "Isnin", tarikh: "16/11/2026", minute: 495,
  slots: [{ masa: "8:15 - 8:45", mula: 495, tamat: 525 }], records: [],
  timetable: [{ kelas: "5 Inovatif", hari: "Isnin", masa: "8:15 - 8:45", mataPelajaran: "PI/PM" }]
};

test("missing slot keeps scheduled subject and changes status at start and end", () => {
  for (const [minute, status] of [[494, "akan"], [495, "semasa"], [524, "semasa"], [525, "terlepas"]]) {
    const [row] = buildMonitoringRows({ ...base, minute });
    assert.equal(row.subject, "PI/PM");
    assert.equal(row.status, status);
    assert.deepEqual(row.records, []);
  }
});

test("keeps all simultaneous teachers, ignores other classes and dates", () => {
  const record = { kelas: base.kelas, tarikh: base.tarikh, masaArray: [base.slots[0].masa] };
  const records = [
    { ...record, guru: "Guru A" }, { ...record, guru: "Guru B", masaArray: undefined, masa: "7:45 - 8:15, 8:15 - 8:45" },
    { ...record, guru: "Guru C", kelas: "4 Bestari" }, { ...record, guru: "Guru D", tarikh: "15/11/2026" }
  ];
  const [row] = buildMonitoringRows({ ...base, records, minute: 600 });
  assert.equal(row.status, "direkod");
  assert.deepEqual(row.records.map((item) => item.guru), ["Guru A", "Guru B"]);
});

test("does not invent a subject from another day or class", () => {
  const timetable = [{ ...base.timetable[0], hari: "Selasa" }, { ...base.timetable[0], kelas: "4 Bestari" }];
  assert.equal(buildMonitoringRows({ ...base, timetable })[0].subject, "Jadual belum didaftarkan");
});

test("recess, assembly and weekends are not reported as missing lessons", () => {
  const slots = [{ ...base.slots[0], rehat: true }, { ...base.slots[0], perhimpunan: true }];
  assert.deepEqual(buildMonitoringRows({ ...base, slots, minute: 900 }).map((row) => row.status), ["rehat", "perhimpunan"]);
  assert.deepEqual(buildMonitoringRows({ ...base, hari: "Ahad" }), []);
});
