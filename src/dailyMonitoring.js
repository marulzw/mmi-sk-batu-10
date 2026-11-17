import { getSlotActivity } from "./specialActivities.js";

export function buildMonitoringRows({ kelas, hari, tarikh, slots, records, timetable, minute, activities = [] }) {
  if (["Sabtu", "Ahad"].includes(hari)) return [];

  return slots.map((slot) => {
    const matches = records.filter((record) =>
      record.tarikh === tarikh && record.kelas === kelas &&
      (Array.isArray(record.masaArray)
        ? record.masaArray.includes(slot.masa)
        : String(record.masa || "").split(",").map((time) => time.trim()).includes(slot.masa))
    );
    const subjects = [...new Set(timetable.filter((item) =>
      item.kelas === kelas && item.hari === hari && item.masa === slot.masa
    ).map((item) => item.mataPelajaran).filter(Boolean))];
    const activity = slot.rehat ? undefined : getSlotActivity(activities, tarikh, kelas, slot.masa);
    let status;
    if (slot.rehat) status = "rehat";
    else if (activity) status = "aktiviti";
    else if (slot.perhimpunan) status = "perhimpunan";
    else if (matches.length) status = "direkod";
    else if (minute < slot.mula) status = "akan";
    else if (minute < slot.tamat) status = "semasa";
    else status = "terlepas";

    return { ...slot, kelas, status, activity, records: matches, subject: subjects.join(" / ") || "Jadual belum didaftarkan" };
  });
}
