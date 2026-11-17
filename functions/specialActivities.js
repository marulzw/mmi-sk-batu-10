const { onCall, HttpsError } = require("firebase-functions/v2/https");

function createActivityFunctions(admin, getNow = () => new Date()) {
  const options = { region: "us-central1", cors: true };
  const collection = () => admin.firestore().collection("aktiviti_khas_harian");

  function requireAdmin(request) {
    // Firebase Auth accounts in this app are provisioned for administrators only.
    if (!request.auth) throw new HttpsError("unauthenticated", "Sila log masuk sebagai admin.");
  }

  function publicActivity(activity) {
    const { id, date, title, type, classes, allDay, slots } = activity;
    return { id, date, title, type, classes, allDay, slots };
  }

  return {
    hantarRekodMMI: onCall(options, async (request) => {
      const input = request.data || {};
      const { kelas, guru, jenisGuru, tokenPadamHash, recordId } = input;
      const times = input.masaArray;
      if (![kelas, guru].every((value) => typeof value === "string" && value.trim() && value.length <= 100) ||
        !["Guru Mata Pelajaran", "Guru Sit-in"].includes(jenisGuru) ||
        typeof recordId !== "string" || !/^[\w-]{16,64}$/.test(recordId) ||
        typeof tokenPadamHash !== "string" || !/^[a-f0-9]{64}$/.test(tokenPadamHash) ||
        !Array.isArray(times) || !times.length || times.length > 12 || times.some((value) => typeof value !== "string") ||
        (jenisGuru === "Guru Sit-in" && (typeof input.guruYangDiganti !== "string" || !input.guruYangDiganti.trim() || input.guruYangDiganti.length > 100))) {
        throw new HttpsError("invalid-argument", "Maklumat rekod tidak lengkap atau tidak sah.");
      }
      const now = getNow();
      const tarikh = new Intl.DateTimeFormat("ms-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
      const isoDate = tarikh.split("/").reverse().join("-");
      if (input.tarikh !== tarikh) throw new HttpsError("failed-precondition", "Tarikh telah berubah. Sila muat semula borang.");
      const { getActivitySlots, getSlotActivity } = await import("./activityRules.mjs");
      const validTimes = getActivitySlots(kelas, isoDate);
      if (times.some((masa) => !validTimes.includes(masa))) throw new HttpsError("invalid-argument", "Slot waktu tidak sah untuk kelas ini.");
      const recordRef = admin.firestore().collection("rekod_mmi").doc(recordId);
      await admin.firestore().runTransaction(async (transaction) => {
        const [snapshot, record] = await Promise.all([transaction.get(collection().doc(isoDate)), transaction.get(recordRef)]);
        const activities = snapshot.exists ? snapshot.data().activities || [] : [];
        const blocked = times.map((masa) => getSlotActivity(activities, tarikh, kelas, masa)).find(Boolean);
        if (blocked) throw new HttpsError("failed-precondition", `Rekod disekat: ${blocked.title}. Sila pilih slot lain.`);
        if (record.exists) {
          if (record.data().tokenPadamHash === tokenPadamHash) return;
          throw new HttpsError("already-exists", "ID rekod telah digunakan.");
        }
        transaction.set(recordRef, {
          tarikh, hari: new Intl.DateTimeFormat("ms-MY", { timeZone: "Asia/Kuala_Lumpur", weekday: "long" }).format(now),
          masaHantar: new Intl.DateTimeFormat("ms-MY", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now),
          kelas, guru, jenisGuru, masaArray: [...new Set(times)], masa: [...new Set(times)].join(", "), tokenPadamHash,
          guruYangDiganti: jenisGuru === "Guru Sit-in" ? input.guruYangDiganti : "",
          mataPelajaran: String(input.mataPelajaran || "").slice(0, 500), createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      return { success: true, recordId };
    }),

    dapatkanAktivitiKhas: onCall(options, async () => {
      const snapshot = await collection().get();
      return { activities: snapshot.docs.flatMap((doc) => (doc.data().activities || []).map(publicActivity)) };
    }),

    simpanAktivitiKhas: onCall(options, async (request) => {
      requireAdmin(request);
      const input = request.data?.activity || {};
      if (typeof input.id !== "string" || !/^[\w-]{16,64}$/.test(input.id) ||
        typeof input.title !== "string" || !input.title.trim() || input.title.length > 200 ||
        typeof input.date !== "string" || typeof input.allDay !== "boolean" ||
        !["Aktiviti Luar Sekolah", "Aktiviti Khas Sekolah"].includes(input.type) ||
        !Array.isArray(input.classes) || !input.classes.length || input.classes.length > 100 ||
        input.classes.some((value) => typeof value !== "string" || !value.trim() || value.length > 100) ||
        !Array.isArray(input.slots) || input.slots.length > 12 || input.slots.some((value) => typeof value !== "string")) {
        throw new HttpsError("invalid-argument", "Maklumat aktiviti tidak sah.");
      }
      const { validateActivity } = await import("./activityRules.mjs");
      const activity = { id: input.id, date: input.date, title: input.title.trim(), type: input.type,
        classes: [...new Set(input.classes)], allDay: input.allDay, slots: input.allDay ? [] : [...new Set(input.slots)] };
      const validation = validateActivity(activity, []);
      if (validation) throw new HttpsError("invalid-argument", validation);
      const classSnapshot = await admin.firestore().collection("senarai_kelas").get();
      const validClasses = new Set(classSnapshot.docs.map((doc) => doc.get("nama")));
      if (activity.classes.some((kelas) => !validClasses.has(kelas))) throw new HttpsError("invalid-argument", "Kelas tidak dijumpai dalam senarai kelas sekolah.");

      const ref = collection().doc(activity.date);
      await admin.firestore().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const existing = snapshot.exists ? snapshot.data().activities || [] : [];
        const sameId = existing.find((item) => item.id === activity.id);
        if (sameId && JSON.stringify(publicActivity(sameId)) === JSON.stringify(activity)) return;
        if (sameId) throw new HttpsError("already-exists", "ID aktiviti telah digunakan.");
        const overlap = validateActivity(activity, existing);
        if (overlap) throw new HttpsError("already-exists", overlap);
        transaction.set(ref, {
          activities: [...existing, activity], updatedBy: request.auth.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      return { success: true, activity };
    }),

    batalAktivitiKhas: onCall(options, async (request) => {
      requireAdmin(request);
      const { date, activityId } = request.data || {};
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        typeof activityId !== "string" || !/^[\w-]{16,64}$/.test(activityId)) {
        throw new HttpsError("invalid-argument", "Tarikh dan ID aktiviti diperlukan.");
      }
      const ref = collection().doc(date);
      await admin.firestore().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return;
        transaction.update(ref, {
          activities: (snapshot.data().activities || []).filter((activity) => activity.id !== activityId),
          updatedBy: request.auth.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      return { success: true };
    })
  };
}

module.exports = { createActivityFunctions };
