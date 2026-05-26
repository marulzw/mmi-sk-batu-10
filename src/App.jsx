import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { Download, Trash2, ClipboardCheck, Search, BarChart3, Settings, Wifi, WifiOff, Lock, LogOut } from "lucide-react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD2PX5F4DdcWTX30H3ECrJsq9znQ5rbfto",
  authDomain: "mmi-sk-batu-10.firebaseapp.com",
  projectId: "mmi-sk-batu-10",
  storageBucket: "mmi-sk-batu-10.firebasestorage.app",
  messagingSenderId: "882614422963",
  appId: "1:882614422963:web:0002022882cd0800f84fc6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

const masaList = [
  "7:15 - 7:45", "7:45 - 8:15", "8:15 - 8:45", "8:45 - 9:15",
  "9:15 - 9:45", "9:45 - 10:15", "10:15 - 10:35 (REHAT)",
  "10:35 - 11:05", "11:05 - 11:35", "11:35 - 12:05", "12:05 - 12:35", "12:35 - 13:05"
];

const hariBM = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
const REKOD_COLLECTION = "rekod_mmi";
const GURU_COLLECTION = "senarai_guru";
const KELAS_COLLECTION = "senarai_kelas";
// TAMBAH INI
const LAPORAN_COLLECTION = "laporan_bulanan";
const chartColors = ["#0f172a", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

function getTodayInfo() {
  const now = new Date();
  const tarikh = now.toLocaleDateString("ms-MY", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hari = hariBM[now.getDay()];
  const masaHantar = now.toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return { tarikh, hari, masaHantar };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function getTahunKelas(namaKelas) {
  const match = String(namaKelas || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function getWaktuAkhirPdP(kelas, hari) {
  const tahun = getTahunKelas(kelas);

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

function getWaktuWajibKelas(kelas, hari) {
  const waktuAkhir = getWaktuAkhirPdP(kelas, hari);
  const indexAkhir = masaList.indexOf(waktuAkhir);

  if (indexAkhir < 0) {
    return masaList.filter((masa) => !masa.includes("REHAT"));
  }

  return masaList
    .slice(0, indexAkhir + 1)
    .filter((masa) => !masa.includes("REHAT"));
}

function getMasaPaparanKelas(kelas, hari) {
  if (!kelas) return masaList;

  const waktuAkhir = getWaktuAkhirPdP(kelas, hari);
  const indexAkhir = masaList.indexOf(waktuAkhir);

  if (indexAkhir < 0) return masaList;

  return masaList.slice(0, indexAkhir + 1);
}

function kiraKehadiranWaktuKelas(kelas, hari, tarikh, rekod) {
  const waktuWajib = getWaktuWajibKelas(kelas, hari);
  const jumlahWaktu = waktuWajib.length;

  const waktuDaftar = waktuWajib.reduce((jumlah, waktu) => {
    const isPerhimpunanSelasa =
      hari === "Selasa" && waktu === "7:15 - 7:45";

    const adaRekod = rekod.some(
      (item) =>
        item.tarikh === tarikh &&
        item.kelas === kelas &&
        String(item.masa || "").includes(waktu)
    );

    return isPerhimpunanSelasa || adaRekod ? jumlah + 1 : jumlah;
  }, 0);

  const waktuTidakDaftar = Math.max(jumlahWaktu - waktuDaftar, 0);

  const senaraiWaktuTidakDaftar = waktuWajib.filter((waktu) => {
    const isPerhimpunanSelasa =
      hari === "Selasa" && waktu === "7:15 - 7:45";

    const adaRekod = rekod.some(
      (item) =>
        item.tarikh === tarikh &&
        item.kelas === kelas &&
        String(item.masa || "").includes(waktu)
    );

    return !(isPerhimpunanSelasa || adaRekod);
  });

  return {
    jumlahWaktu,
    waktuDaftar,
    waktuTidakDaftar,
    senaraiWaktuTidakDaftar,
    peratusDaftar:
      jumlahWaktu > 0 ? ((waktuDaftar / jumlahWaktu) * 100).toFixed(1) : "0.0",
    peratusTidakDaftar:
      jumlahWaktu > 0 ? ((waktuTidakDaftar / jumlahWaktu) * 100).toFixed(1) : "0.0",
  };
}

export default function BorangMMIApp() {
  const [form, setForm] = useState({ kelas: "", guru: "", masa: [], jenisGuru: "Guru Mata Pelajaran" });
  const [rekod, setRekod] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedKelas, setSelectedKelas] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("rekod");
  const [guruList, setGuruList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [newGuru, setNewGuru] = useState("");
  const [newKelas, setNewKelas] = useState("");
  const [firebaseStatus, setFirebaseStatus] = useState("Menyambung ke Firebase...");
  const [isOnlineDb, setIsOnlineDb] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [currentAdmin, setCurrentAdmin] = useState(null);
  
// TAMBAH INI
const [senaraiLaporan, setSenaraiLaporan] = useState([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentAdmin(user);
      setIsAdminLoggedIn(!!user);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const rekodQuery = query(collection(db, REKOD_COLLECTION), orderBy("createdAt", "desc"));

    const unsubscribeRekod = onSnapshot(
      rekodQuery,
      (snapshot) => {
        setRekod(snapshot.docs.map((docItem) => ({ firebaseId: docItem.id, ...docItem.data() })));
        setFirebaseStatus("Database Firebase aktif");
        setIsOnlineDb(true);
      },
      () => {
        setFirebaseStatus("Firebase belum disambung. Semak konfigurasi Firebase.");
        setIsOnlineDb(false);
      }
    );

    const unsubscribeGuru = onSnapshot(
      collection(db, GURU_COLLECTION),
      (snapshot) => {
        const data = snapshot.docs
          .map((docItem) => ({ firebaseId: docItem.id, nama: docItem.data().nama }))
          .filter((item) => item.nama);
        setGuruList(data.sort((a, b) => a.nama.localeCompare(b.nama, "ms", { numeric: true })));
      },
      () => setGuruList([])
    );

    const unsubscribeKelas = onSnapshot(
      collection(db, KELAS_COLLECTION),
      (snapshot) => {
        const data = snapshot.docs
          .map((docItem) => ({ firebaseId: docItem.id, nama: docItem.data().nama }))
          .filter((item) => item.nama);
        setKelasList(data.sort((a, b) => a.nama.localeCompare(b.nama, "ms", { numeric: true })));
      },
      () => setKelasList([])
    );

    const unsubscribeLaporan = onSnapshot(
  query(
    collection(db, LAPORAN_COLLECTION),
    orderBy("createdAt", "desc")
  ),
  (snapshot) => {
    setSenaraiLaporan(
      snapshot.docs.map((docItem) => ({
        firebaseId: docItem.id,
        ...docItem.data()
      }))
    );
  },
  () => setSenaraiLaporan([])
);

    return () => {
      unsubscribeRekod();
      unsubscribeGuru();
      unsubscribeKelas();
      unsubscribeLaporan();
    };
  }, []);

  const today = getTodayInfo();
  const kelasNames = useMemo(() => kelasList.map((kelas) => kelas.nama), [kelasList]);

  const masaListPaparan = useMemo(
    () => getMasaPaparanKelas(form.kelas, today.hari),
    [form.kelas, today.hari]
  );

  const rekodHariIni = useMemo(
    () => rekod.filter((item) => item.tarikh === today.tarikh),
    [rekod, today.tarikh]
  );

  const semuaKelasTiadaRekodHariIni =
    kelasNames.length > 0 && rekodHariIni.length === 0;


  const filteredRekod = useMemo(() => {
  let data = rekod;

// Papar rekod hari ini sahaja
data = data.filter((item) => item.tarikh === today.tarikh);

  if (selectedKelas) {
    data = data.filter((item) => item.kelas === selectedKelas);
  }

  const keyword = search.toLowerCase().trim();

  if (keyword) {
    data = data.filter((item) =>
      [item.tarikh, item.hari, item.kelas, item.guru, item.masa, item.jenisGuru]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }

  function getMasaMula(item) {
    const masaPertama = String(item.masa || "").split(",")[0].trim();
    const mula = masaPertama.split(" - ")[0].trim();

    const [jam, minit] = mula.split(":").map(Number);
    return jam * 60 + minit;
  }

  return [...data].sort((a, b) => getMasaMula(a) - getMasaMula(b));
}, [rekod, search, selectedKelas, today.tarikh]);

  const jumlahHariIni = rekodHariIni.length;
  const jumlahSitIn = rekod.filter((item) => item.jenisGuru === "Guru Sit-in").length;

  const analisisKelas = useMemo(() => kelasNames.map((kelas) => {
    const dataKelas = rekod.filter((item) => item.kelas === kelas);
    const statistikWaktu = kiraKehadiranWaktuKelas(
      kelas,
      today.hari,
      today.tarikh,
      rekod
    );

    return {
      kelas,
      jumlah: dataKelas.length,
      guruMP: dataKelas.filter((item) => item.jenisGuru === "Guru Mata Pelajaran").length,
      sitIn: dataKelas.filter((item) => item.jenisGuru === "Guru Sit-in").length,
      ...statistikWaktu
    };
  }), [rekod, kelasNames, today.hari, today.tarikh]);

  const analisisDipilih = selectedKelas ? analisisKelas.filter((item) => item.kelas === selectedKelas) : analisisKelas;

  const chartKelasData = useMemo(() => {
    return analisisDipilih
      .filter((item) => item.jumlah > 0)
      .map((item) => ({ kelas: item.kelas, Jumlah: item.jumlah, GMP: item.guruMP, SitIn: item.sitIn }));
  }, [analisisDipilih]);

  const pieJenisGuruData = useMemo(() => [
    { name: "Guru Mata Pelajaran", value: rekod.filter((item) => item.jenisGuru === "Guru Mata Pelajaran").length },
    { name: "Guru Sit-in", value: rekod.filter((item) => item.jenisGuru === "Guru Sit-in").length }
  ], [rekod]);

  const chartMasaData = useMemo(() => {
    return masaList.map((masa) => ({
      masa: masa.replace(" (REHAT)", ""),
      Rekod: rekod.filter((item) => String(item.masa || "").includes(masa)).length
    })).filter((item) => item.Rekod > 0);
  }, [rekod]);

  function getMonthYear(tarikh) {
    const parts = String(tarikh || "").split("/");
    if (parts.length !== 3) return "Tidak dikenal pasti";
    return `${parts[1]}/${parts[2]}`;
  }

  function getHariFromTarikh(tarikh) {
    const parts = String(tarikh || "").split("/");
    if (parts.length !== 3) return "";
    const [day, month, year] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    return hariBM[date.getDay()] || "";
  }

  const laporanBulanan = useMemo(() => {
    const group = {};

    rekod.forEach((item) => {
      const bulan = getMonthYear(item.tarikh);
      if (!group[bulan]) {
        group[bulan] = {
          bulan,
          jumlah: 0,
          guruMP: 0,
          sitIn: 0,
          kelas: {},
          guruSitIn: {},
          guruMasuk: {},
          kelasSitIn: {},
          kelasKosong: {},
          rekodIkutTarikh: {}
        };
      }

      const data = group[bulan];
      const tarikh = item.tarikh || "Tidak dikenal pasti";

      data.jumlah += 1;
      data.kelas[item.kelas] = (data.kelas[item.kelas] || 0) + 1;

      if (!data.rekodIkutTarikh[tarikh]) data.rekodIkutTarikh[tarikh] = [];
      data.rekodIkutTarikh[tarikh].push(item);

      if (item.jenisGuru === "Guru Sit-in") {
        data.sitIn += 1;
        data.guruSitIn[item.guru] = (data.guruSitIn[item.guru] || 0) + 1;
        data.kelasSitIn[item.kelas] = (data.kelasSitIn[item.kelas] || 0) + 1;
      } else {
        data.guruMP += 1;
        data.guruMasuk[item.guru] = (data.guruMasuk[item.guru] || 0) + 1;
      }
    });

    Object.values(group).forEach((bulan) => {
      const kelasUntukAnalisis =
        kelasNames.length > 0 ? kelasNames : Object.keys(bulan.kelas);

      kelasUntukAnalisis.forEach((kelas) => {
        bulan.kelasKosong[kelas] = 0;
      });

      Object.entries(bulan.rekodIkutTarikh).forEach(([tarikh, rekodTarikh]) => {
        // Jika tiada sebarang rekod pada hari tersebut, hari itu dianggap tidak aktif/cuti
        // dan tidak dimasukkan dalam pengiraan bulanan.
        if (rekodTarikh.length === 0) return;

        kelasUntukAnalisis.forEach((kelas) => {
          const adaRekodKelas = rekodTarikh.some((item) => item.kelas === kelas);
          if (!adaRekodKelas) {
            bulan.kelasKosong[kelas] = (bulan.kelasKosong[kelas] || 0) + 1;
          }
        });
      });

      bulan.jumlahHariAktif = Object.values(bulan.rekodIkutTarikh).filter(
        (rekodTarikh) => rekodTarikh.length > 0
      ).length;
      bulan.jumlahKelasTiadaRekod =
        kelasUntukAnalisis.filter((kelas) => (bulan.kelas[kelas] || 0) === 0).length;

      bulan.peratusGuruMasuk = bulan.jumlah > 0 ? ((bulan.guruMP / bulan.jumlah) * 100).toFixed(1) : 0;
      bulan.peratusGuruTidakMasuk = bulan.jumlah > 0 ? ((bulan.sitIn / bulan.jumlah) * 100).toFixed(1) : 0;

      bulan.kelasPalingKosong = Object.entries(bulan.kelasKosong)
        .filter(([, jumlah]) => jumlah > 0)
        .sort((a, b) => b[1] - a[1])[0];

      bulan.kelasPalingSitIn = Object.entries(bulan.kelasSitIn).sort((a, b) => b[1] - a[1])[0];
      bulan.guruPalingSitIn = Object.entries(bulan.guruSitIn).sort((a, b) => b[1] - a[1])[0];
    });

    return Object.values(group).sort((a, b) => b.bulan.localeCompare(a.bulan));
  }, [rekod, kelasNames]);

  const chartBulananData = useMemo(() => {
    return laporanBulanan
      .slice()
      .reverse()
      .map((bulan) => ({ bulan: bulan.bulan, Jumlah: bulan.jumlah, GMP: bulan.guruMP, SitIn: bulan.sitIn }));
  }, [laporanBulanan]);

  const topSitInKelasData = useMemo(() => {
    return analisisKelas
      .filter((item) => item.sitIn > 0)
      .sort((a, b) => b.sitIn - a.sitIn)
      .slice(0, 8)
      .map((item) => ({ kelas: item.kelas, SitIn: item.sitIn }));
  }, [analisisKelas]);

  function updateField(field, value) {
    setForm((prev) => {
      if (field !== "kelas") return { ...prev, [field]: value };

      const masaDibenarkan = getMasaPaparanKelas(value, today.hari).filter(
        (masa) => !masa.includes("REHAT")
      );

      return {
        ...prev,
        kelas: value,
        masa: prev.masa.filter((masa) => masaDibenarkan.includes(masa))
      };
    });

    if (field === "kelas") setSelectedKelas(value);
  }

  function toggleMasa(value) {
    setForm((prev) => {
      const exists = prev.masa.includes(value);
      const masa = exists ? prev.masa.filter((item) => item !== value) : [...prev.masa, value];
      return { ...prev, masa };
    });
  }

  async function handleSubmit(e) {
  e.preventDefault();

  if (!form.kelas || !form.guru || form.masa.length === 0 || !form.jenisGuru) {
    setMessage("Sila lengkapkan semua maklumat.");
    return;
  }

  // Simpan kelas dipilih supaya kekal selepas submit
  const selectedClass = form.kelas;

  const info = getTodayInfo();

  try {
    await addDoc(collection(db, REKOD_COLLECTION), {
      tarikh: info.tarikh,
      hari: info.hari,
      masaHantar: info.masaHantar,

      kelas: selectedClass,
      guru: form.guru,

      masa: form.masa.join(", "),
      masaArray: form.masa,

      jenisGuru: form.jenisGuru,

      createdAt: serverTimestamp()
    });

    // Kekalkan dashboard pada kelas yang dipilih
    setSelectedKelas(selectedClass);

    // Reset form tetapi kekalkan kelas
    setForm({
      kelas: selectedClass,
      guru: "",
      masa: [],
      jenisGuru: "Guru Mata Pelajaran"
    });

    setMessage(
      `Rekod MMI berjaya dihantar. Dashboard kini memaparkan rekod untuk ${selectedClass} sahaja.`
    );

  } catch {
    setMessage("Rekod gagal dihantar. Semak Firebase atau internet.");
  }
}

  function exportCSV() {
    const headers = ["Bil", "Tarikh", "Hari", "Masa Hantar", "Nama Kelas", "Nama Guru", "Masa", "Jenis Guru"];
    const rows = filteredRekod.map((item, index) => [index + 1, item.tarikh, item.hari, item.masaHantar, item.kelas, item.guru, item.masa, item.jenisGuru]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Rekod_MMI_SK_Batu_10_${today.tarikh.replaceAll("/", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function clearData() {
    if (!isAdminLoggedIn) return;
    const confirmClear = window.confirm("Padam semua rekod MMI dalam Firebase?");
    if (!confirmClear) return;
    try {
      await Promise.all(rekod.map((item) => deleteDoc(doc(db, REKOD_COLLECTION, item.firebaseId))));
      setMessage("Semua rekod telah dipadam.");
    } catch {
      setMessage("Gagal memadam rekod.");
    }
  }

  async function addGuru() {
    const nama = newGuru.trim();
    if (!nama) return;
    if (guruList.some((guru) => guru.nama.toLowerCase() === nama.toLowerCase())) {
      setMessage("Nama guru sudah wujud.");
      return;
    }
    try {
      await addDoc(collection(db, GURU_COLLECTION), { nama });
      setNewGuru("");
      setMessage("Nama guru berjaya ditambah.");
    } catch {
      setMessage("Gagal tambah nama guru.");
    }
  }

  async function deleteGuru(guru) {
    try {
      await deleteDoc(doc(db, GURU_COLLECTION, guru.firebaseId));
      setMessage(`Nama ${guru.nama} telah dipadam.`);
    } catch {
      setMessage("Gagal padam nama guru.");
    }
  }

  async function addKelas() {
    const nama = newKelas.trim();
    if (!nama) return;
    if (kelasList.some((kelas) => kelas.nama.toLowerCase() === nama.toLowerCase())) {
      setMessage("Nama kelas sudah wujud.");
      return;
    }
    try {
      await addDoc(collection(db, KELAS_COLLECTION), { nama });
      setNewKelas("");
      setMessage("Kelas berjaya ditambah.");
    } catch {
      setMessage("Gagal tambah kelas.");
    }
  }

  async function deleteKelas(kelas) {
    try {
      await deleteDoc(doc(db, KELAS_COLLECTION, kelas.firebaseId));
      if (selectedKelas === kelas.nama) setSelectedKelas("");
      if (form.kelas === kelas.nama) setForm((prev) => ({ ...prev, kelas: "" }));
      setMessage(`Kelas ${kelas.nama} telah dipadam.`);
    } catch {
      setMessage("Gagal padam kelas.");
    }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    setAdminError("");
    if (!adminEmail || !adminPassword) {
      setAdminError("Sila masukkan email dan kata laluan admin.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      setAdminEmail("");
      setAdminPassword("");
      setMessage("Admin berjaya log masuk.");
    } catch {
      setAdminError("Email atau kata laluan admin tidak sah.");
    }
  }

  async function handleAdminLogout() {
    await signOut(auth);
    setActiveTab("rekod");
    setMessage("Admin telah log keluar.");
  }
  function getRekodBulanLaporan(laporan) {
  const bulanLaporan = String(laporan.bulan || "").toLowerCase();
  const tahunLaporan = String(laporan.tahun || "");

  return rekod.filter((item) => {
    const parts = String(item.tarikh || "").split("/");
    if (parts.length !== 3) return false;

    const bulanNombor = parts[1];
    const tahun = parts[2];

    const namaBulan = new Date(`${tahun}-${bulanNombor}-01`).toLocaleDateString("ms-MY", {
      month: "long"
    });

    return namaBulan.toLowerCase() === bulanLaporan && tahun === tahunLaporan;
  });
}

function kiraStatistikLaporan(laporan) {
  const rekodBulanIni = getRekodBulanLaporan(laporan);
  const jumlahRekod = rekodBulanIni.length;
  const jumlahGMP = rekodBulanIni.filter((item) => item.jenisGuru === "Guru Mata Pelajaran").length;
  const jumlahSitIn = rekodBulanIni.filter((item) => item.jenisGuru === "Guru Sit-in").length;

  const kiraIkutMedan = (medan) => {
    return Object.entries(
      rekodBulanIni.reduce((acc, item) => {
        const key = item[medan] || "Tidak dikenal pasti";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]);
  };

  return {
    rekodBulanIni,
    jumlahRekod,
    jumlahGMP,
    jumlahSitIn,
    kelasTertinggi: kiraIkutMedan("kelas")[0] || ["Tiada data", 0],
    guruTertinggi: kiraIkutMedan("guru")[0] || ["Tiada data", 0],
    sitInKelasTertinggi:
      Object.entries(
        rekodBulanIni
          .filter((item) => item.jenisGuru === "Guru Sit-in")
          .reduce((acc, item) => {
            const key = item.kelas || "Tidak dikenal pasti";
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {})
      ).sort((a, b) => b[1] - a[1])[0] || ["Tiada data", 0]
  };
}

async function janaLaporanBulananManual() {
  if (!isAdminLoggedIn) return;

  const bulanNama = new Date().toLocaleDateString("ms-MY", {
    month: "long"
  });

  const tahun = new Date().getFullYear();

  const laporanSudahWujud = senaraiLaporan.some(
    (laporan) =>
      String(laporan.bulan || "").toLowerCase() === bulanNama.toLowerCase() &&
      String(laporan.tahun || "") === String(tahun)
  );

  if (laporanSudahWujud) {
    setMessage(`Laporan Bulan ${bulanNama} ${tahun} sudah wujud.`);
    return;
  }

  try {
    await addDoc(collection(db, LAPORAN_COLLECTION), {
      tajuk: `Laporan Bulan ${bulanNama}`,
      bulan: bulanNama,
      tahun,
      pdfUrl: "",
      status: "PDF belum dijana",
      createdAt: serverTimestamp()
    });

    setMessage("Laporan bulanan berjaya disediakan. Tekan Jana PDF untuk menghasilkan fail laporan.");
  } catch {
    setMessage("Gagal jana laporan bulanan.");
  }
}

async function janaPDFLaporanDemo(laporan, autoMode = false) {
  try {
    const statistik = kiraStatistikLaporan(laporan);
    const docPdf = new jsPDF();

    docPdf.setFontSize(16);
    docPdf.text("LAPORAN BULANAN MMI", 20, 20);

    docPdf.setFontSize(11);
    docPdf.text("SK Batu 10, Sibu", 20, 30);
    docPdf.text(`Tajuk: ${laporan.tajuk || "Laporan Bulanan"}`, 20, 42);
    docPdf.text(`Bulan: ${laporan.bulan || "-"}`, 20, 50);
    docPdf.text(`Tahun: ${laporan.tahun || "-"}`, 20, 58);
    docPdf.text("Status: Selesai", 20, 66);

    docPdf.setFontSize(13);
    docPdf.text("Ringkasan Statistik", 20, 82);

    docPdf.setFontSize(11);
    docPdf.text(`Jumlah Rekod: ${statistik.jumlahRekod}`, 20, 94);
    docPdf.text(`Guru Mata Pelajaran: ${statistik.jumlahGMP}`, 20, 102);
    docPdf.text(`Guru Sit-in: ${statistik.jumlahSitIn}`, 20, 110);
    docPdf.text(`Kelas Rekod Tertinggi: ${statistik.kelasTertinggi[0]} (${statistik.kelasTertinggi[1]} rekod)`, 20, 118);
    docPdf.text(`Guru Rekod Tertinggi: ${statistik.guruTertinggi[0]} (${statistik.guruTertinggi[1]} rekod)`, 20, 126);
    docPdf.text(`Kelas Sit-in Tertinggi: ${statistik.sitInKelasTertinggi[0]} (${statistik.sitInKelasTertinggi[1]} rekod)`, 20, 134);

    docPdf.setFontSize(13);
    docPdf.text("Rumusan Sistem", 20, 152);

    docPdf.setFontSize(11);
    const rumusan =
      statistik.jumlahRekod === 0
        ? "Tiada rekod MMI yang dijumpai bagi bulan laporan ini."
        : `Sepanjang bulan ${laporan.bulan} ${laporan.tahun}, sistem merekodkan ${statistik.jumlahRekod} rekod MMI. Daripada jumlah tersebut, ${statistik.jumlahGMP} rekod adalah Guru Mata Pelajaran dan ${statistik.jumlahSitIn} rekod adalah Guru Sit-in. Data ini boleh digunakan sebagai asas pemantauan Melindungi Masa Instruksional di peringkat sekolah.`;

    docPdf.text(rumusan, 20, 162, { maxWidth: 170 });

    let y = 188;
    docPdf.setFontSize(13);
    docPdf.text("Senarai Rekod Bulanan", 20, y);
    y += 10;

    docPdf.setFontSize(9);
    statistik.rekodBulanIni.slice(0, 30).forEach((item, index) => {
      if (y > 280) {
        docPdf.addPage();
        y = 20;
      }

      const line = `${index + 1}. ${item.tarikh || "-"} | ${item.kelas || "-"} | ${item.guru || "-"} | ${item.masa || "-"} | ${item.jenisGuru || "-"}`;
      docPdf.text(line, 20, y, { maxWidth: 170 });
      y += 7;
    });

    if (statistik.rekodBulanIni.length > 30) {
      if (y > 280) {
        docPdf.addPage();
        y = 20;
      }
      docPdf.text(`Nota: Hanya 30 rekod pertama dipaparkan. Jumlah penuh rekod ialah ${statistik.rekodBulanIni.length}.`, 20, y, { maxWidth: 170 });
    }

    const pdfBlob = docPdf.output("blob");

    const namaFail = `${laporan.tahun || "tahun"}_${laporan.bulan || "bulan"}_${laporan.firebaseId}.pdf`;
    const storageRef = ref(storage, `laporan_bulanan/${namaFail}`);

    await uploadBytes(storageRef, pdfBlob);

    const downloadURL = await getDownloadURL(storageRef);

    await updateDoc(doc(db, LAPORAN_COLLECTION, laporan.firebaseId), {
      pdfUrl: downloadURL,
      status: "Selesai",
      jumlahRekod: statistik.jumlahRekod,
      jumlahGMP: statistik.jumlahGMP,
      jumlahSitIn: statistik.jumlahSitIn,
      updatedAt: serverTimestamp()
    });

    setMessage(autoMode ? "Laporan bulanan automatik berjaya dijana." : "PDF laporan berjaya dijana dan disimpan dalam Firebase Storage.");
  } catch {
    setMessage("Gagal jana atau simpan PDF laporan.");
  }
}

useEffect(() => {
  if (!isAdminLoggedIn) return;

  const now = new Date();
  const hariTerakhirBulan = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const hariIni = now.getDate();

  if (hariIni !== hariTerakhirBulan) return;

  const bulanNama = now.toLocaleDateString("ms-MY", {
    month: "long"
  });

  const tahun = now.getFullYear();
  const storageKey = `auto-laporan-${bulanNama}-${tahun}-${today.tarikh}`;

  const laporanSudahWujud = senaraiLaporan.some(
    (laporan) =>
      String(laporan.bulan || "").toLowerCase() === bulanNama.toLowerCase() &&
      String(laporan.tahun || "") === String(tahun)
  );

  if (laporanSudahWujud || localStorage.getItem(storageKey)) return;

  localStorage.setItem(storageKey, "1");

  async function janaAuto() {
    try {
      const docRef = await addDoc(collection(db, LAPORAN_COLLECTION), {
        tajuk: `Laporan Bulan ${bulanNama}`,
        bulan: bulanNama,
        tahun,
        pdfUrl: "",
        status: "Sedang dijana",
        autoGenerated: true,
        createdAt: serverTimestamp()
      });

      await janaPDFLaporanDemo(
        {
          firebaseId: docRef.id,
          tajuk: `Laporan Bulan ${bulanNama}`,
          bulan: bulanNama,
          tahun,
          status: "Sedang dijana"
        },
        true
      );
    } catch {
      setMessage("Gagal menjana laporan automatik hujung bulan.");
    }
  }

  janaAuto();
}, [isAdminLoggedIn, senaraiLaporan, today.tarikh]);

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-3 py-4 sm:px-5 md:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-4 md:space-y-6">
        <div className="rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-100 via-indigo-50 to-violet-100 p-4 shadow-md backdrop-blur md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/logo-sekolah.png"
                alt="Logo Sekolah"
                className="h-20 w-20 rounded-2xl border border-white bg-white p-2 object-contain shadow-lg"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:text-sm">SK Batu 10, Sibu</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#102A43] sm:text-3xl md:text-4xl">Borang MMI Guru</h1>
                <p className="mt-1 text-sm text-[#5B6B82] sm:text-base">Melindungi Masa Instruksional</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
              <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                <div><strong>Tarikh:</strong> {today.tarikh}</div>
                <div><strong>Hari:</strong> {today.hari}</div>
              </div>
              <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold ${isOnlineDb ? "border border-emerald-200 bg-gradient-to-br from-emerald-100 to-green-50 text-emerald-700" : "border border-red-200 bg-gradient-to-br from-red-100 to-rose-50 text-red-700"}`}>
                {isOnlineDb ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
                <span>{firebaseStatus}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-20 -mx-3 overflow-x-auto bg-slate-100/95 px-3 py-2 backdrop-blur sm:mx-0 sm:rounded-3xl sm:border sm:bg-white/90">
          <div className="flex min-w-max gap-2">
            <button onClick={() => setActiveTab("rekod")} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${activeTab === "rekod" ? "bg-sky-700 text-white shadow" : "border bg-white text-slate-700"}`}>Rekod</button>
            <button onClick={() => setActiveTab("analisis")} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${activeTab === "analisis" ? "bg-sky-700 text-white shadow" : "border bg-white text-slate-700"}`}>Analisis</button>
            <button onClick={() => setActiveTab("laporan")} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${activeTab === "laporan" ? "bg-sky-700 text-white shadow" : "border bg-white text-slate-700"}`}>Laporan Bulanan</button>
            <button onClick={() => setActiveTab("admin")} className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${activeTab === "admin" ? "bg-sky-700 text-white shadow" : "border bg-white text-slate-700"}`}>{isAdminLoggedIn ? "Admin" : "Login Admin"}</button>
          </div>
        </div>

        {activeTab === "rekod" && (
          <div className="grid gap-4 lg:grid-cols-[420px_1fr] lg:gap-6">
            <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-indigo-50 p-4 shadow-sm md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-slate-950 p-3 text-white"><ClipboardCheck className="h-5 w-5" /></div>
                <div><h2 className="text-xl font-black text-slate-950">Isi Rekod</h2><p className="text-sm text-slate-500">Isi sebelum atau semasa masuk kelas.</p></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nama Kelas</label>
                  <select className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" value={form.kelas} onChange={(e) => updateField("kelas", e.target.value)}>
                    <option value="">Pilih kelas</option>
                    {kelasList.map((kelas) => <option key={kelas.firebaseId} value={kelas.nama}>{kelas.nama}</option>)}
                  </select>
                  {kelasList.length === 0 && <p className="text-xs text-amber-700">Senarai kelas belum ditambah. Sila tambah kelas melalui menu Admin.</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nama Guru</label>
                  <select className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" value={form.guru} onChange={(e) => updateField("guru", e.target.value)}>
                    <option value="">Pilih guru</option>
                    {guruList.map((guru) => <option key={guru.firebaseId} value={guru.nama}>{guru.nama}</option>)}
                  </select>
                  {guruList.length === 0 && <p className="text-xs text-amber-700">Senarai guru belum ditambah. Sila tambah guru melalui menu Admin.</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Masa</label>
                  <p className="text-xs text-slate-500">Boleh pilih lebih daripada satu masa.</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {masaListPaparan.map((masa) => {
                      const checked = form.masa.includes(masa);
                      const isRehat = masa.includes("REHAT");
                      return (
                        <label
                          key={masa}
                          className={`flex min-h-14 items-center gap-3 rounded-2xl border p-3 transition ${
                            isRehat
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70"
                              : checked
                                ? "border-slate-900 bg-slate-950 text-white"
                                : "border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-5 w-5"
                            checked={checked}
                            disabled={isRehat}
                            onChange={() => !isRehat && toggleMasa(masa)}
                          />
                          <span className="text-sm font-semibold">
                            {masa}
                            {isRehat && " · Tidak dikira"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700">Jenis Guru</label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <label className={`flex min-h-14 items-center gap-3 rounded-2xl border p-3 transition ${form.jenisGuru === "Guru Mata Pelajaran" ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-white"}`}>
                      <input type="radio" className="h-5 w-5" name="jenisGuru" value="Guru Mata Pelajaran" checked={form.jenisGuru === "Guru Mata Pelajaran"} onChange={(e) => updateField("jenisGuru", e.target.value)} />
                      <span className="text-sm font-semibold">Guru Mata Pelajaran</span>
                    </label>
                    <label className={`flex min-h-14 items-center gap-3 rounded-2xl border p-3 transition ${form.jenisGuru === "Guru Sit-in" ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-white"}`}>
                      <input type="radio" className="h-5 w-5" name="jenisGuru" value="Guru Sit-in" checked={form.jenisGuru === "Guru Sit-in"} onChange={(e) => updateField("jenisGuru", e.target.value)} />
                      <span className="text-sm font-semibold">Guru Sit-in</span>
                    </label>
                  </div>
                </div>

                <button type="submit" className="h-14 w-full rounded-2xl bg-sky-700 px-4 text-base font-black text-white shadow-sm transition hover:bg-sky-800 active:scale-[0.99]">Hantar Rekod</button>
                {message && <div className="rounded-2xl bg-slate-100 p-3 text-sm font-medium text-slate-700">{message}</div>}
              </form>
            </div>

            <div className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-100 to-white p-4 shadow-sm"><p className="text-xs font-semibold text-sky-700 sm:text-sm">Jumlah Rekod</p><p className="mt-2 text-3xl font-black text-sky-950">{rekod.length}</p></div>
                <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-100 to-white p-4 shadow-sm"><p className="text-xs font-semibold text-emerald-700 sm:text-sm">Hari Ini</p><p className="mt-2 text-3xl font-black text-emerald-950">{jumlahHariIni}</p></div>
                <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-100 to-white p-4 shadow-sm"><p className="text-xs font-semibold text-amber-700 sm:text-sm">Sit-in</p><p className="mt-2 text-3xl font-black text-amber-950">{jumlahSitIn}</p></div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-indigo-50 p-4 shadow-sm md:p-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  
                  <div className="flex flex-wrap gap-2">
                    <button className="flex h-11 items-center rounded-2xl border px-4 text-sm font-bold disabled:opacity-50" onClick={exportCSV} disabled={filteredRekod.length === 0}><Download className="mr-2 h-4 w-4" /> CSV</button>
                    {isAdminLoggedIn && <button className="flex h-11 items-center rounded-2xl border px-4 text-sm font-bold text-red-600 disabled:opacity-50" onClick={clearData} disabled={rekod.length === 0}><Trash2 className="mr-2 h-4 w-4" /> Padam</button>}
                  </div>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <input className="h-14 w-full rounded-2xl border border-slate-200 py-3 pl-12 pr-4 text-base outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" placeholder="Cari tarikh, guru, kelas atau masa" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>

                <div className="space-y-3 md:hidden">
                  {filteredRekod.length === 0 ? <div className="rounded-2xl bg-slate-100 p-5 text-center text-sm text-slate-500">Belum ada rekod.</div> : filteredRekod.map((item, index) => (
                    <div key={item.firebaseId} className={`rounded-3xl border border-slate-200 p-4 shadow-sm ${index % 2 === 0 ? "bg-white" : "bg-[#EEF4FF]"}`}>
                      <div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500">#{index + 1} · {item.tarikh}</p><h3 className="text-lg font-black text-slate-950">{item.kelas}</h3></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.jenisGuru === "Guru Sit-in" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{item.jenisGuru}</span></div>
                      <div className="grid gap-2 text-sm text-slate-700"><div><strong>Guru:</strong> {item.guru}</div><div><strong>Masa:</strong> {item.masa}</div><div><strong>Hantar:</strong> {item.hari}, {item.masaHantar}</div></div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto rounded-2xl border md:block">
                  <table className="w-full min-w-[850px] text-sm">
                    <thead className="bg-gradient-to-r from-sky-100 to-indigo-100 text-slate-800"><tr><th className="p-3 text-left">Bil</th><th className="p-3 text-left">Tarikh</th><th className="p-3 text-left">Hari</th><th className="p-3 text-left">Masa Hantar</th><th className="p-3 text-left">Kelas</th><th className="p-3 text-left">Guru</th><th className="p-3 text-left">Masa</th><th className="p-3 text-left">Jenis</th></tr></thead>
                    <tbody>{filteredRekod.length === 0 ? <tr><td colSpan="8" className="p-6 text-center text-slate-500">Belum ada rekod.</td></tr> : filteredRekod.map((item, index) => <tr key={item.firebaseId} className={`border-t transition hover:bg-sky-100 ${index % 2 === 0 ? "bg-white" : "bg-[#EEF4FF]"}`}><td className="p-3">{index + 1}</td><td className="p-3">{item.tarikh}</td><td className="p-3">{item.hari}</td><td className="p-3">{item.masaHantar}</td><td className="p-3 font-bold">{item.kelas}</td><td className="p-3">{item.guru}</td><td className="p-3">{item.masa}</td><td className="p-3">{item.jenisGuru}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "analisis" && (
          <div className="space-y-4 md:space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-indigo-50 p-4 shadow-sm md:p-6">
              <div className="mb-5 flex items-center gap-2"><BarChart3 className="h-6 w-6" /><h2 className="text-xl font-black text-slate-950">Graf Analisis MMI</h2></div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 p-4">
                  <h3 className="mb-3 font-black text-slate-950">Jumlah Rekod Mengikut Kelas</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartKelasData} margin={{ top: 10, right: 10, left: -20, bottom: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="kelas" angle={-45} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="GMP" stackId="a" fill={chartColors[1]} />
                        <Bar dataKey="SitIn" stackId="a" fill={chartColors[2]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 p-4">
                  <h3 className="mb-3 font-black text-slate-950">Nisbah Guru Mata Pelajaran dan Sit-in</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieJenisGuruData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label>
                          {pieJenisGuruData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index + 1]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 p-4">
                  <h3 className="mb-3 font-black text-slate-950">Kelas Paling Banyak Sit-in</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topSitInKelasData} layout="vertical" margin={{ top: 10, right: 20, left: 25, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="kelas" type="category" width={90} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="SitIn" fill={chartColors[2]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 p-4">
                  <h3 className="mb-3 font-black text-slate-950">Rekod Mengikut Masa</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartMasaData} margin={{ top: 10, right: 10, left: -20, bottom: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="masa" angle={-45} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="Rekod" fill={chartColors[4]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-indigo-50 p-4 shadow-sm md:p-6">
              <div className="mb-5 flex items-center gap-2"><BarChart3 className="h-6 w-6" /><h2 className="text-xl font-black text-slate-950">Analisis Mengikut Kelas</h2></div>
              {semuaKelasTiadaRekodHariIni ? (
                <div className="rounded-3xl border border-sky-100 bg-sky-50 p-5 text-sky-900">
                  <p className="text-lg font-black">Jumlah kelas tiada rekod: {kelasNames.length} kelas</p>
                  <p className="mt-2 text-sm leading-6">
                    Tiada sebarang rekod MMI untuk semua kelas pada hari ini. Hari ini dianggap sebagai hari tidak aktif dan tidak diambil kira dalam pengiraan peratus bulanan.
                  </p>
                </div>
              ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {analisisDipilih.map((item) => (
                  <div key={item.kelas} className="rounded-3xl border border-slate-200 bg-white/70 p-4">
                    <h3 className="text-lg font-black text-slate-950">{item.kelas}</h3>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-2xl bg-slate-100 p-3">
                        <p className="font-black text-xl">{item.jumlah}</p>
                        <p className="text-xs text-slate-500">Jumlah</p>
                      </div>
                      <div className="rounded-2xl bg-emerald-100 p-3">
                        <p className="font-black text-xl">{item.guruMP}</p>
                        <p className="text-xs text-emerald-700">GMP</p>
                      </div>
                      <div className="rounded-2xl bg-amber-100 p-3">
                        <p className="font-black text-xl">{item.sitIn}</p>
                        <p className="text-xs text-amber-700">Sit-in</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
                      <div className="rounded-2xl bg-green-100 p-3">
                        <p className="font-black text-xl text-green-900">{item.peratusDaftar}%</p>
                        <p className="text-xs text-green-700">Mendaftar</p>
                        <p className="mt-1 text-[11px] text-green-700">
                          {item.waktuDaftar}/{item.jumlahWaktu} waktu
                        </p>
                      </div>
                      <div className="rounded-2xl bg-rose-100 p-3">
                        <p className="font-black text-xl text-rose-900">{item.peratusTidakDaftar}%</p>
                        <p className="text-xs text-rose-700">Tidak Mendaftar</p>
                        <p className="mt-1 text-[11px] text-rose-700">
                          {item.waktuTidakDaftar}/{item.jumlahWaktu} waktu
                        </p>

                        {item.senaraiWaktuTidakDaftar?.length > 0 && (
                          <div className="mt-2 rounded-xl bg-white/60 p-2 text-left">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">
                              Belum Direkod
                            </p>

                            <p className="mt-1 text-[11px] leading-5 text-rose-800">
                              {item.senaraiWaktuTidakDaftar.length <= 3
                                ? item.senaraiWaktuTidakDaftar.join(", ")
                                : `${item.senaraiWaktuTidakDaftar.slice(0, 3).join(", ")} dan ${item.senaraiWaktuTidakDaftar.length - 3} lagi`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "laporan" && (
          <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-indigo-50 p-4 shadow-sm md:p-6">
            <h2 className="mb-2 text-xl font-black text-slate-950">Laporan Bulanan Keseluruhan</h2>
            <p className="mb-5 text-sm text-slate-600">Paparan ini menjadi asas laporan bulanan automatik.</p>
            {isAdminLoggedIn && (
  <button
    onClick={janaLaporanBulananManual}
    className="mb-5 rounded-2xl bg-sky-700 px-5 py-3 text-sm font-black text-white hover:bg-sky-800"
  >
    Kemaskini Laporan Bulanan
  </button>
)}
            <div className="mb-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-4">
  <h3 className="mb-3 text-lg font-black text-slate-950">
    Senarai Laporan PDF Bulanan
  </h3>

  {senaraiLaporan.length === 0 ? (
    <div className="rounded-2xl bg-white p-4 text-sm text-slate-600">
      Belum ada laporan PDF dijana.
    </div>
  ) : (
    <div className="space-y-3">
      {senaraiLaporan.map((laporan) => (
        <div
          key={laporan.firebaseId}
          className="flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h4 className="font-black text-slate-950">
              {laporan.tajuk || `Laporan Bulan ${laporan.bulan || ""}`}
            </h4>
            <p className="text-sm text-slate-500">
              {laporan.bulan || ""} {laporan.tahun || ""}
            </p>
          </div>

          {laporan.pdfUrl ? (
  <a
    href={laporan.pdfUrl}
    target="_blank"
    rel="noreferrer"
    className="rounded-2xl bg-sky-700 px-4 py-2 text-center text-sm font-bold text-white hover:bg-sky-800"
  >
    Buka PDF
  </a>
) : (
  <div className="flex flex-col items-start">
    <span className="rounded-2xl bg-amber-100 px-4 py-2 text-center text-sm font-bold text-amber-700">
      PDF belum tersedia
    </span>

    <button
      type="button"
      onClick={() => janaPDFLaporanDemo(laporan)}
      className="mt-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
    >
      Jana PDF Demo
    </button>
  </div>
)}
        </div>
      ))}
    </div>
  )}
</div>

            {chartBulananData.length > 0 && (
              <div className="mb-5 rounded-3xl border border-slate-200 p-4">
                <h3 className="mb-3 font-black text-slate-950">Trend Rekod Bulanan</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartBulananData} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="bulan" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="Jumlah" stroke={chartColors[0]} strokeWidth={3} />
                      <Line type="monotone" dataKey="GMP" stroke={chartColors[1]} strokeWidth={3} />
                      <Line type="monotone" dataKey="SitIn" stroke={chartColors[2]} strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {laporanBulanan.length === 0 ? (
              <div className="rounded-2xl bg-slate-100 p-4 text-slate-600">Belum ada data laporan bulanan.</div>
            ) : (
              <div className="space-y-4">
                {laporanBulanan.map((bulan) => (
                  <div key={bulan.bulan} className="rounded-3xl border border-slate-200 p-4">
                    <h3 className="text-lg font-black text-slate-950">Bulan {bulan.bulan}</h3>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-2xl bg-slate-100 p-4">
                        Jumlah Rekod: <strong>{bulan.jumlah}</strong>
                      </div>
                      <div className="rounded-2xl bg-emerald-100 p-4">
                        Peratus Guru Masuk: <strong>{bulan.peratusGuruMasuk}%</strong>
                      </div>
                      <div className="rounded-2xl bg-red-100 p-4">
                        Peratus Guru Tidak Masuk: <strong>{bulan.peratusGuruTidakMasuk}%</strong>
                      </div>
                      <div className="rounded-2xl border p-4">
                        {bulan.kelasPalingKosong ? (
                          <>
                            Kelas Tiada Rekod MMI Tertinggi:<br />
                            <strong>{bulan.kelasPalingKosong[0]}</strong>
                          </>
                        ) : (
                          <>
                            Jumlah kelas tiada rekod:<br />
                            <strong>{bulan.jumlahKelasTiadaRekod || 0} kelas</strong>
                          </>
                        )}
                      </div>
                      <div className="rounded-2xl border p-4">
                        Kelas Paling Banyak Sit-in:<br />
                        <strong>{bulan.kelasPalingSitIn?.[0] || "Tiada data"}</strong>
                      </div>
                      <div className="rounded-2xl border p-4">
                        Guru Paling Kerap Sit-in:<br />
                        <strong>{bulan.guruPalingSitIn?.[0] || "Tiada data"}</strong>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(bulan.kelas).map(([kelas, jumlah]) => (
                        <div key={kelas} className="flex justify-between rounded-xl border px-3 py-2 text-sm">
                          <span>{kelas}</span>
                          <strong>{jumlah}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "admin" && !isAdminLoggedIn && (
          <div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center gap-2"><Lock className="h-6 w-6" /><h2 className="text-xl font-black text-slate-950">Login Admin</h2></div>
            <p className="mb-4 text-sm leading-6 text-slate-600">Sila log masuk menggunakan akaun pentadbir yang sah bagi mengakses fungsi pengurusan sistem, tetapan aplikasi dan data rekod MMI sekolah.</p>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <input type="email" className="h-14 w-full rounded-2xl border px-4 text-base outline-none focus:ring-4 focus:ring-slate-100" placeholder="Email admin" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
              <input type="password" className="h-14 w-full rounded-2xl border px-4 text-base outline-none focus:ring-4 focus:ring-slate-100" placeholder="Kata laluan admin" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
              {adminError && <div className="rounded-2xl bg-red-100 p-3 text-sm text-red-700">{adminError}</div>}
              <button type="submit" className="h-14 w-full rounded-2xl bg-slate-950 px-5 font-black text-white">Log Masuk</button>
            </form>
          </div>
        )}

        {activeTab === "admin" && isAdminLoggedIn && (
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-indigo-50 p-4 shadow-sm md:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2"><Settings className="h-6 w-6" /><h2 className="text-xl font-black text-slate-950">Backend Admin</h2></div>
                <button onClick={handleAdminLogout} className="flex h-11 items-center rounded-2xl border px-4 text-sm font-bold"><LogOut className="mr-2 h-4 w-4" /> Log Keluar</button>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">Admin sedang log masuk sebagai: <strong>{currentAdmin?.email}</strong></div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-indigo-50 p-4 shadow-sm md:p-6">
              <h3 className="mb-4 text-lg font-black text-slate-950">Pengurusan Guru</h3>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input className="h-14 rounded-2xl border px-4 text-base outline-none focus:ring-4 focus:ring-slate-100" placeholder="Masukkan nama guru baharu" value={newGuru} onChange={(e) => setNewGuru(e.target.value)} />
                <button onClick={addGuru} className="h-14 rounded-2xl bg-slate-950 px-5 font-black text-white">Tambah Guru</button>
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {guruList.length === 0 ? <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">Belum ada nama guru.</div> : guruList.map((guru, index) => (
                  <div key={guru.firebaseId} className="flex items-center justify-between rounded-2xl border p-3">
                    <div><p className="text-xs text-slate-500">#{index + 1}</p><p className="font-bold">{guru.nama}</p></div>
                    <button onClick={() => deleteGuru(guru)} className="rounded-xl border px-3 py-2 text-sm font-bold text-red-600">Padam</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-sky-50 to-indigo-50 p-4 shadow-sm md:p-6">
              <h3 className="mb-4 text-lg font-black text-slate-950">Pengurusan Kelas</h3>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input className="h-14 rounded-2xl border px-4 text-base outline-none focus:ring-4 focus:ring-slate-100" placeholder="Masukkan nama kelas baharu" value={newKelas} onChange={(e) => setNewKelas(e.target.value)} />
                <button onClick={addKelas} className="h-14 rounded-2xl bg-slate-950 px-5 font-black text-white">Tambah Kelas</button>
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {kelasList.length === 0 ? <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">Belum ada nama kelas.</div> : kelasList.map((kelas, index) => (
                  <div key={kelas.firebaseId} className="flex items-center justify-between rounded-2xl border p-3">
                    <div><p className="text-xs text-slate-500">#{index + 1}</p><p className="font-bold">{kelas.nama}</p></div>
                    <button onClick={() => deleteKelas(kelas)} className="rounded-xl border px-3 py-2 text-sm font-bold text-red-600">Padam</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

               
