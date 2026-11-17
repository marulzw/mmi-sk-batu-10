import React, { useState } from "react";
import { Plus, X, Bus } from "lucide-react";
import { toRecordDate, validateActivity } from "./specialActivities.js";

export default function SpecialActivitiesAdmin({ classes, activities, onChange, todayISO, getSlots, localPreview = false, ready = true }) {
  const [date, setDate] = useState(todayISO);
  const [selected, setSelected] = useState([]);
  const [allDay, setAllDay] = useState(true);
  const [slots, setSlots] = useState([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Aktiviti Luar Sekolah");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const available = [...new Set(selected.flatMap((kelas) => getSlots(kelas, date)))];
  const toggle = (items, item) => items.includes(item) ? items.filter((value) => value !== item) : [...items, item];

  async function save(event) {
    event.preventDefault();
    if (busy || !ready) return;
    const id = crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const activity = { id, date, classes: selected, allDay, slots: allDay ? [] : slots.filter((masa) => available.includes(masa)), title: title.trim(), type };
    const error = validateActivity(activity, activities, getSlots);
    if (error) { setMessage(error); return; }
    try {
      setBusy(true);
      await onChange([...activities, activity]);
      setMessage(localPreview ? "Aktiviti berjaya disimpan untuk pratonton local." : "Aktiviti berjaya disimpan. Pengecualian kini dikongsi dengan semua peranti.");
      setTitle("");
    } catch (error) {
      setMessage(error?.message || "Aktiviti tidak dapat disimpan. Sila cuba semula.");
    } finally { setBusy(false); }
  }

  async function cancel(activity) {
    if (busy || !ready) return;
    if (!window.confirm(`Batalkan ${activity.title} pada ${toRecordDate(activity.date)}? Slot akan kembali mengikut jadual biasa.`)) return;
    try {
      setBusy(true);
      await onChange(activities.filter((item) => item.id !== activity.id));
      setMessage("Pengecualian dibatalkan. Rekod guru kekal disimpan.");
    } catch (error) { setMessage(error?.message || "Gagal membatalkan aktiviti. Sila cuba semula."); }
    finally { setBusy(false); }
  }

  return <section className="space-y-5 border-y border-slate-200 py-5 text-slate-800">
    <div><h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Bus className="h-5 w-5" />Aktiviti Khas / Pengecualian Rekod</h2>{localPreview && <p className="mt-2 text-sm text-amber-800">Pratonton local: simpanan hanya dalam browser ini. Data sekolah tidak diubah.</p>}</div>
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-bold"><span>Tarikh Aktiviti</span><input required type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlots([]); }} className="h-12 w-full rounded-lg border border-slate-200 bg-white px-3" /></label>
        <label className="space-y-2 text-sm font-bold"><span>Jenis Aktiviti</span><select value={type} onChange={(e) => setType(e.target.value)} className="h-12 w-full rounded-lg border border-slate-200 bg-white px-3"><option>Aktiviti Luar Sekolah</option><option>Aktiviti Khas Sekolah</option></select></label>
      </div>
      <label className="block space-y-2 text-sm font-bold"><span>Nama Aktiviti / Catatan</span><input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lawatan Sambil Belajar Tahun 6" className="h-12 w-full rounded-lg border border-slate-200 bg-white px-3" /></label>
      <fieldset><legend className="mb-2 text-sm font-bold">Kelas Terlibat</legend>
        <div className="mb-3 flex flex-wrap gap-3">{[1, 2, 3, 4, 5, 6].map((year) => <button key={year} type="button" disabled={!classes.some((kelas) => new RegExp(`^${year}\\b`).test(kelas))} onClick={() => { setSelected(classes.filter((kelas) => new RegExp(`^${year}\\b`).test(kelas))); setSlots([]); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold disabled:opacity-50">Semua Tahun {year}</button>)}</div>
        <div className="grid gap-2 sm:grid-cols-3">{classes.map((kelas) => <label key={kelas} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(kelas)} onChange={() => { setSelected(toggle(selected, kelas)); setSlots([]); }} className="h-4 w-4" />{kelas}</label>)}</div>
        {!classes.length && <p className="text-sm text-slate-500">Senarai kelas sedang dimuatkan atau belum didaftarkan.</p>}
      </fieldset>
      <fieldset><legend className="mb-2 text-sm font-bold">Tempoh</legend><div className="flex flex-wrap gap-5">{[[true, "Sepanjang Hari"], [false, "Slot Tertentu"]].map(([value, label]) => <label key={label} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="activity-duration" checked={allDay === value} onChange={() => setAllDay(value)} />{label}</label>)}</div></fieldset>
      {!allDay && <fieldset><legend className="mb-2 text-sm font-bold">Slot Terlibat</legend><div className="grid gap-2 sm:grid-cols-3">{available.map((masa) => <label key={masa} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={slots.includes(masa)} onChange={() => setSlots(toggle(slots, masa))} />{masa}</label>)}</div>{!available.length && <p className="text-sm text-slate-500">Pilih kelas dan tarikh terlebih dahulu.</p>}</fieldset>}
      {message && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
      <button type="submit" disabled={busy || !ready} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-sky-700 px-4 font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{busy ? "Menyimpan..." : "Simpan Aktiviti"}</button>
    </form>
    <div className="space-y-3">{!activities.length ? <p className="text-sm text-slate-500">Belum ada aktiviti khas didaftarkan.</p> : [...activities].sort((a, b) => a.date.localeCompare(b.date)).map((activity) => <article key={activity.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-4"><div className="min-w-0 flex-1 break-words"><h3 className="font-bold">{activity.title}</h3><p className="mt-1 text-sm">{toRecordDate(activity.date)} | {activity.type}</p><p className="mt-1 text-sm text-slate-600">{activity.classes.join(", ")}</p><p className="mt-1 text-sm text-slate-600">{activity.allDay ? "Sepanjang hari" : activity.slots.join(", ")}</p></div><button type="button" onClick={() => cancel(activity)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700"><X className="h-4 w-4" />Batal Pengecualian</button></article>)}</div>
  </section>;
}
