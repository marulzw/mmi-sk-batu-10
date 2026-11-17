import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Coffee, Users } from "lucide-react";
import { buildMonitoringRows } from "./dailyMonitoring.js";

const statuses = {
  direkod: { label: "Sudah Direkod", style: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
  terlepas: { label: "Terlepas Tanpa Rekod", style: "bg-rose-100 text-rose-800", Icon: AlertCircle },
  semasa: { label: "Sedang Berlangsung, Belum Direkod", style: "bg-amber-100 text-amber-800", Icon: Clock3 },
  akan: { label: "Belum Bermula", style: "bg-slate-100 text-slate-600", Icon: Clock3 },
  rehat: { label: "Rehat", style: "bg-amber-100 text-amber-800", Icon: Coffee },
  perhimpunan: { label: "Perhimpunan / Mentor-Mentee / Nilam", style: "bg-sky-100 text-sky-900", Icon: Users }
};

function Status({ status }) {
  const { label, style, Icon } = statuses[status];
  return <span className={`inline-flex max-w-full items-center gap-2 rounded px-2 py-1 text-xs font-bold ${style}`}><Icon className="h-4 w-4 shrink-0" /><span>{label}</span></span>;
}

function RecordDetails({ records }) {
  if (!records.length) return <span className="text-slate-500">Belum ada rekod guru</span>;
  const unique = [...new Map(records.map((record) => [
    [record.guru, record.jenisGuru, record.guruYangDiganti, record.masaHantar].join("|"), record
  ])).values()];
  return <ul className="space-y-2">{unique.map((record, index) => <li key={index}>
    <p className="font-bold">{record.guru}</p>
    <p className="mt-1 text-xs">
      <span className="text-slate-500">Jenis Guru: </span>
      <span className={`inline-block max-w-full rounded px-2 py-1 font-bold ${record.jenisGuru === "Guru Sit-in" ? "bg-amber-100 text-amber-800" : record.jenisGuru === "Guru Mata Pelajaran" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
        {record.jenisGuru || "Tidak dinyatakan"}
      </span>
    </p>
    {record.jenisGuru === "Guru Sit-in" && <p className="mt-1 text-xs text-slate-600">Guru Diganti: {record.guruYangDiganti || "Tidak dinyatakan"}</p>}
    <p className="text-xs text-slate-600">Hantar: {record.masaHantar || "-"}</p>
  </li>)}</ul>;
}

export default function DailyMonitoring({ classes, records, timetable, today, minute, getSlots, online, timetableState, reloadTimetable }) {
  const [selectedClass, setSelectedClass] = useState("");
  const [filter, setFilter] = useState("semua");
  const kelas = classes.includes(selectedClass) ? selectedClass : classes[0] || "";
  const rows = useMemo(() => kelas ? buildMonitoringRows({
    kelas, hari: today.hari, tarikh: today.tarikh, slots: getSlots(kelas, today.hari),
    records, timetable, minute
  }) : [], [kelas, today.hari, today.tarikh, records, timetable, minute, getSlots]);
  const visibleRows = rows.filter((row) => filter === "semua" || row.status === filter);
  const weekend = ["Sabtu", "Ahad"].includes(today.hari);
  const warning = timetableState === "error";

  return <section className="space-y-5 text-slate-800">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-black text-slate-950">Pemantauan Harian</h2><p className="mt-1 text-sm text-slate-600">{today.hari}, {today.tarikh}</p></div>
      <span role="status" className={`rounded px-3 py-2 text-sm font-bold ${online ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{online ? "Rekod disambung secara langsung" : "Sambungan rekod terganggu"}</span>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm font-bold"><span>Kelas Dipantau</span><select className="h-12 w-full rounded-lg border border-slate-200 bg-white px-3" value={kelas} onChange={(event) => setSelectedClass(event.target.value)} disabled={!classes.length}>
        {!classes.length && <option value="">Belum ada kelas</option>}{classes.map((name) => <option key={name}>{name}</option>)}
      </select></label>
      <label className="space-y-2 text-sm font-bold"><span>Status Slot</span><select className="h-12 w-full rounded-lg border border-slate-200 bg-white px-3" value={filter} onChange={(event) => setFilter(event.target.value)}>
        <option value="semua">Semua Slot</option>{["terlepas", "semasa", "direkod", "akan"].map((status) => <option key={status} value={status}>{statuses[status].label}</option>)}
      </select></label>
    </div>
    {timetableState === "loading" && <p role="status" className="text-sm text-slate-600">Memuatkan jadual waktu...</p>}
    {warning && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-800"><span>Jadual waktu gagal dikemas kini. Mata pelajaran mungkin tidak terkini.</span><button type="button" onClick={reloadTimetable} className="font-bold underline">Cuba semula</button></div>}
    <dl className="grid grid-cols-2 gap-3 border-y border-slate-200 py-4 sm:grid-cols-4">
      {["direkod", "terlepas", "semasa", "akan"].map((status) => <div key={status} className="min-w-0"><dt className="text-xs text-slate-600">{statuses[status].label}</dt><dd className="mt-1 text-2xl font-black">{rows.filter((row) => row.status === status).length}</dd></div>)}
    </dl>
    {!classes.length ? <p className="py-6 text-center text-slate-500">Belum ada kelas didaftarkan.</p> : weekend ? <p className="py-6 text-center text-slate-500">Tiada slot persekolahan pada {today.hari}.</p> : <>
      <div className="hidden md:block"><table className="w-full table-fixed text-left text-sm"><thead className="bg-slate-100 text-slate-700"><tr><th className="w-36 p-3">Waktu</th><th className="w-40 p-3">Mata Pelajaran</th><th className="p-3">Guru dan Masa Hantar</th><th className="w-60 p-3">Status</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.masa} className="border-b border-slate-200 align-top"><td className="p-3 font-bold">{row.masa.replace(" (REHAT)", "")}</td><td className="break-words p-3">{row.rehat || row.perhimpunan ? "-" : row.subject}</td><td className="break-words p-3">{row.rehat || row.perhimpunan ? "-" : <RecordDetails records={row.records} />}</td><td className="p-3"><Status status={row.status} /></td></tr>)}</tbody></table></div>
      <div className="divide-y divide-slate-200 md:hidden">{visibleRows.map((row) => <article key={row.masa} className="space-y-3 py-4"><div className="font-bold">{row.masa.replace(" (REHAT)", "")}</div><Status status={row.status} />{!row.rehat && !row.perhimpunan && <><p className="text-sm"><span className="text-slate-500">Mata Pelajaran: </span><strong>{row.subject}</strong></p><div className="text-sm"><RecordDetails records={row.records} /></div></>}</article>)}</div>
      {!visibleRows.length && <p className="py-6 text-center text-slate-500">Tiada slot bagi status yang dipilih.</p>}
    </>}
    <p className="text-xs text-slate-500">Nama guru dipaparkan berdasarkan rekod yang dihantar. Jadual waktu semasa tidak menetapkan guru bagi setiap subjek. Status berdasarkan jadual biasa hari ini; cuti atau pembatalan kelas belum diambil kira.</p>
  </section>;
}
