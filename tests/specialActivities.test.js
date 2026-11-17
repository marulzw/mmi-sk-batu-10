import test from "node:test";
import assert from "node:assert/strict";
import { getSlotActivity, validateActivity, readLocalActivities } from "../src/specialActivities.js";
import { buildMonitoringRows } from "../src/dailyMonitoring.js";
import { calculateCoverage, getActivitySlots } from "../functions/activityRules.mjs";

const activity = { id: "trip", date: "2026-11-17", classes: ["6 Bestari", "6 Inovatif"], title: "Lawatan Tahun 6", type: "Aktiviti Luar Sekolah", allDay: true, slots: [] };
const slots = [{ masa: "7:45 - 8:15", mula: 465, tamat: 495 }, { masa: "8:15 - 8:45", mula: 495, tamat: 525 }, { masa: "10:15 - 10:35 (REHAT)", rehat: true, mula: 615, tamat: 635 }];
const input = { kelas: "6 Bestari", hari: "Selasa", tarikh: "17/11/2026", slots, minute: 900, records: [], timetable: [], activities: [activity] };

test("full-day trip covers only selected classes and date, preserves recess", () => {
  assert.deepEqual(buildMonitoringRows(input).map((row) => row.status), ["aktiviti", "aktiviti", "rehat"]);
  assert.equal(buildMonitoringRows(input)[2].activity, undefined);
  assert.equal(getSlotActivity([activity], "17/11/2026", "5 Inovatif", slots[0].masa), undefined);
  assert.equal(getSlotActivity([activity], "18/11/2026", "6 Bestari", slots[0].masa), undefined);
});

test("partial trip exempts only selected slots and cancellation restores missing status", () => {
  const partial = { ...activity, allDay: false, slots: [slots[0].masa] };
  assert.deepEqual(buildMonitoringRows({ ...input, activities: [partial] }).map((row) => row.status), ["aktiviti", "terlepas", "rehat"]);
  assert.equal(buildMonitoringRows({ ...input, activities: [] })[0].status, "terlepas");
});

test("existing teacher records are retained alongside activity", () => {
  const record = { tarikh: input.tarikh, kelas: input.kelas, masaArray: [slots[0].masa], guru: "Guru A", jenisGuru: "Guru Sit-in" };
  const rows = buildMonitoringRows({ ...input, records: [record] });
  assert.equal(rows[0].status, "aktiviti");
  assert.deepEqual(rows[0].records, [record]);
});

test("rejects overlapping activities, empty slot selection and invalid class slots", () => {
  const getSlots = () => [slots[0].masa];
  assert.match(validateActivity(activity, [activity], getSlots), /bertindih/);
  assert.match(validateActivity({ ...activity, allDay: false }, [], getSlots), /slot/);
  assert.match(validateActivity({ ...activity, allDay: false, slots: ["12:35 - 13:05"] }, [], getSlots), /slot/);
  assert.equal(validateActivity(activity, [], getSlots), "");
  assert.match(validateActivity({ ...activity, date: "2026-11-22" }, [], getSlots), /Isnin/);
});

test("invalid browser storage falls back safely", () => {
  assert.deepEqual(readLocalActivities({ getItem: () => "null" }), []);
  assert.deepEqual(readLocalActivities({ getItem: () => "invalid json" }), []);
  assert.deepEqual(readLocalActivities({ getItem: () => JSON.stringify([activity]) }), [activity]);
});

test("monthly coverage excludes trips without counting them as teaching records", () => {
  const classes = activity.classes;
  const coverage = calculateCoverage({ records: [], activities: [activity], classes, todayISO: activity.date });
  assert.equal(coverage.exempt, getActivitySlots(classes[0], activity.date).length * 2);
  assert.equal(coverage.required, 0);
  assert.equal(coverage.recorded, 0);
  assert.equal(coverage.missing, 0);
  const partial = { ...activity, allDay: false, slots: [slots[0].masa] };
  const record = { tarikh: "17/11/2026", kelas: classes[0], masa: "8:15 - 8:45" };
  const partialCoverage = calculateCoverage({ records: [record], activities: [partial], classes, todayISO: activity.date });
  assert.equal(partialCoverage.exempt, 2);
  assert.equal(partialCoverage.required, 20);
  assert.equal(partialCoverage.recorded, 3);
  assert.equal(partialCoverage.missing, 17);
  assert.deepEqual(calculateCoverage({ records: [], activities: [activity], classes, todayISO: "2026-11-16" }), { required: 0, recorded: 0, missing: 0, exempt: 0 });
});
