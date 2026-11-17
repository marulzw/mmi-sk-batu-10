const test = require("node:test");
const assert = require("node:assert/strict");
const { createActivityFunctions } = require("../functions/specialActivities");

function fixture() {
  const store = new Map();
  const snapshot = (id) => ({ exists: store.has(id), data: () => store.get(id) });
  const db = {
    collection: (name) => ({
      doc: (id) => ({ id }),
      get: async () => ({ docs: name === "senarai_kelas"
        ? ["6 Bestari", "6 Inovatif"].map((nama) => ({ get: () => nama }))
        : [...store.values()].map((data) => ({ data: () => data })) })
    }),
    runTransaction: async (action) => action({
      get: async (ref) => snapshot(ref.id),
      set: (ref, data) => store.set(ref.id, data),
      update: (ref, data) => store.set(ref.id, { ...store.get(ref.id), ...data })
    })
  };
  const firestore = () => db;
  firestore.FieldValue = { serverTimestamp: () => "server-time" };
  return { functions: createActivityFunctions({ firestore }), store };
}

const activity = { id: "activity-test-123456", date: "2026-11-17", title: "Lawatan Tahun 6", type: "Aktiviti Luar Sekolah", classes: ["6 Bestari", "6 Inovatif"], allDay: true, slots: [] };
const adminRequest = (data) => ({ auth: { uid: "admin-test" }, data });

test("only authenticated administrators can save or cancel", async () => {
  const { functions, store } = fixture();
  await assert.rejects(functions.simpanAktivitiKhas.run({ data: { activity } }), { code: "unauthenticated" });
  await assert.rejects(functions.batalAktivitiKhas.run({ data: { date: activity.date, activityId: activity.id } }), { code: "unauthenticated" });
  assert.equal(store.size, 0);
});

test("shared read, idempotent save, overlap rejection and cancel preserve other activities", async () => {
  const { functions, store } = fixture();
  await functions.simpanAktivitiKhas.run(adminRequest({ activity }));
  await functions.simpanAktivitiKhas.run(adminRequest({ activity }));
  assert.equal(store.get(activity.date).activities.length, 1);
  const read = await functions.dapatkanAktivitiKhas.run({});
  assert.deepEqual(read.activities, [activity]);
  assert.equal(read.activities[0].updatedBy, undefined);
  await assert.rejects(functions.simpanAktivitiKhas.run(adminRequest({ activity: { ...activity, id: "other-test-12345678" } })), { code: "already-exists" });
  const other = { ...activity, id: "later-test-12345678", date: "2026-11-18" };
  await functions.simpanAktivitiKhas.run(adminRequest({ activity: other }));
  await functions.batalAktivitiKhas.run(adminRequest({ date: activity.date, activityId: activity.id }));
  assert.deepEqual((await functions.dapatkanAktivitiKhas.run({})).activities, [other]);
});

test("server rejects malformed dates, unknown classes and non-school slots", async () => {
  const { functions, store } = fixture();
  for (const changes of [{ date: "2026-02-30" }, { classes: ["Missing class"] }, { allDay: false, slots: ["20:00 - 21:00"] }, { type: "Unknown" }]) {
    await assert.rejects(functions.simpanAktivitiKhas.run(adminRequest({ activity: { ...activity, ...changes } })), { code: "invalid-argument" });
  }
  assert.equal(store.size, 0);
});
