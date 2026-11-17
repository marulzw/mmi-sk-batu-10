export const periodTimes = [
  "7:15 - 7:45", "7:45 - 8:15", "8:15 - 8:45", "8:45 - 9:15",
  "9:15 - 9:45", "9:45 - 10:15", "10:15 - 10:35 (REHAT)",
  "10:35 - 11:05", "11:05 - 11:35", "11:35 - 12:05", "12:05 - 12:35", "12:35 - 13:05"
];
const days = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

export function getWaktuAkhirPdP(kelas, hari) {
  const tahun = Number(String(kelas).match(/\d+/)?.[0]);
  if ([1, 2, 3].includes(tahun)) {
    if (["Isnin", "Selasa", "Rabu"].includes(hari)) return "12:05 - 12:35";
    if (hari === "Khamis") return "11:35 - 12:05";
    if (hari === "Jumaat") return "11:05 - 11:35";
  }
  if ([4, 5, 6].includes(tahun)) {
    if (["Isnin", "Selasa"].includes(hari)) return "12:35 - 13:05";
    if (["Rabu", "Khamis"].includes(hari)) return "12:05 - 12:35";
    if (hari === "Jumaat") return "11:05 - 11:35";
  }
  return "12:35 - 13:05";
}

export function getMasaPaparanKelas(kelas, hari) {
  return kelas ? periodTimes.slice(0, periodTimes.indexOf(getWaktuAkhirPdP(kelas, hari)) + 1) : periodTimes;
}

export function getWaktuWajibKelas(kelas, hari) {
  return getMasaPaparanKelas(kelas, hari).filter((masa) => !masa.includes("REHAT"));
}

export function getActivitySlots(kelas, isoDate) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || [0, 6].includes(date.getUTCDay())) return [];
  return getWaktuWajibKelas(kelas, days[date.getUTCDay()]);
}

export function toRecordDate(isoDate) {
  const [year, month, day] = String(isoDate || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}

export function getSlotActivity(activities, tarikh, kelas, masa) {
  return activities.find((activity) => toRecordDate(activity.date) === tarikh &&
    activity.classes.includes(kelas) && (activity.allDay || activity.slots.includes(masa)));
}

export function validateActivity(activity, existing, getSlots = getActivitySlots) {
  if (!activity.date || !activity.title.trim() || !activity.classes.length) return "Sila lengkapkan tarikh, kelas dan nama aktiviti.";
  const date = new Date(`${activity.date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(activity.date) || !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== activity.date || [0, 6].includes(date.getUTCDay())) {
    return "Sila pilih tarikh persekolahan Isnin hingga Jumaat.";
  }
  const slotsByClass = activity.classes.map((kelas) => ({ kelas, slots: getSlots(kelas, activity.date) }));
  if (!activity.allDay && (!activity.slots.length || slotsByClass.some(({ slots }) => !activity.slots.some((masa) => slots.includes(masa))))) {
    return "Sila pilih sekurang-kurangnya satu slot yang sah bagi setiap kelas.";
  }
  const validSlots = new Set(slotsByClass.flatMap(({ slots }) => slots));
  if (!activity.allDay && activity.slots.some((masa) => !validSlots.has(masa))) return "Slot waktu tidak sah.";
  const overlap = slotsByClass.some(({ kelas, slots }) => slots.some((masa) =>
    (activity.allDay || activity.slots.includes(masa)) && getSlotActivity(existing, toRecordDate(activity.date), kelas, masa)));
  return overlap ? "Aktiviti bertindih dengan pengecualian sedia ada. Batalkan aktiviti lama atau pilih slot lain." : "";
}

export function calculateCoverage({ records, activities, classes, todayISO }) {
  const dates = new Set(records.map((item) => item.tarikh));
  activities.filter((item) => item.date <= todayISO).forEach((item) => dates.add(toRecordDate(item.date)));
  const result = { required: 0, recorded: 0, missing: 0, exempt: 0 };
  for (const tarikh of dates) {
    const isoDate = String(tarikh).split("/").reverse().join("-");
    if (isoDate > todayISO) continue;
    const date = new Date(`${isoDate}T12:00:00Z`);
    const day = days[date.getUTCDay()];
    if (!day || ["Sabtu", "Ahad"].includes(day)) continue;
    for (const kelas of classes) {
      for (const masa of getActivitySlots(kelas, isoDate)) {
        if (getSlotActivity(activities, tarikh, kelas, masa)) { result.exempt++; continue; }
        result.required++;
        const hasRecord = records.some((record) => record.tarikh === tarikh && record.kelas === kelas &&
          (Array.isArray(record.masaArray) ? record.masaArray : String(record.masa || "").split(",").map((value) => value.trim())).includes(masa));
        if (hasRecord || (day === "Selasa" && masa === "7:15 - 7:45")) result.recorded++;
        else result.missing++;
      }
    }
  }
  return result;
}
