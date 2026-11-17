export const ACTIVITY_STORAGE_KEY = "mmi-local-special-activities-v1";
export { toRecordDate, getSlotActivity, validateActivity } from "../functions/activityRules.mjs";

export function readLocalActivities(storage) {
  try {
    const value = JSON.parse(storage.getItem(ACTIVITY_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item.id === "string" &&
      typeof item.date === "string" && typeof item.title === "string" && typeof item.allDay === "boolean" &&
      Array.isArray(item.classes) && Array.isArray(item.slots)) : [];
  } catch {
    return [];
  }
}
