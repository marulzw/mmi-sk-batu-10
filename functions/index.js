const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const os = require("os");
const path = require("path");
const OpenAI = require("openai");

admin.initializeApp();

let openai = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openai;
}

function kiraPeratus(nilai, jumlah) {
  return jumlah > 0 ? ((nilai / jumlah) * 100).toFixed(1) : "0.0";
}

function dapatkanNamaBulan(bulanInput) {
  const nomborBulan = Number(bulanInput);

  if (!Number.isInteger(nomborBulan) || nomborBulan < 1 || nomborBulan > 12) {
    return null;
  }

  return new Date(2026, nomborBulan - 1, 1).toLocaleString("ms-MY", {
    month: "long",
  });
}

function dapatkanTop(data, medan, had = 5) {
  const kiraan = {};

  data.forEach((item) => {
    const key = item[medan] || "Tidak dikenal pasti";
    kiraan[key] = (kiraan[key] || 0) + 1;
  });

  return Object.entries(kiraan)
    .sort((a, b) => b[1] - a[1])
    .slice(0, had)
    .map(([nama, jumlah]) => ({ nama, jumlah }));
}

function dapatkanTopSitInKelas(data, had = 5) {
  const kiraan = {};

  data
    .filter((item) => item.jenisGuru === "Guru Sit-in")
    .forEach((item) => {
      const key = item.kelas || "Tidak dikenal pasti";
      kiraan[key] = (kiraan[key] || 0) + 1;
    });

  return Object.entries(kiraan)
    .sort((a, b) => b[1] - a[1])
    .slice(0, had)
    .map(([nama, jumlah]) => ({ nama, jumlah }));
}

function normalisasiNama(nama) {
  return String(nama || "").trim().toLowerCase();
}

const GURU_DIKECUALIKAN_TIADA_REKOD = [
  "Affra Binti Yahya",
  "Azlin Bin Sylvia",
  "Jainap Binti Jamaluddin @ Jateng",
  "Noorliza Bt. Abdul Khalid",
  "Hasmah Binti Basni",
].map(normalisasiNama);

function cariLogoSekolah() {
  const lokasiCalon = [
    path.join(__dirname, "assets", "logo-sekolah.png"),
    path.join(__dirname, "logo-sekolah.png"),
    path.join(__dirname, "..", "public", "logo-sekolah.png"),
  ];

  return lokasiCalon.find((lokasi) => fs.existsSync(lokasi)) || null;
}

function tambahNomborHalaman(doc, teksFooter = "Laporan MMI SK Batu 10, Sibu") {
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748b")
      .text(teksFooter, 50, doc.page.height - 42, {
        align: "center",
        width: doc.page.width - 100,
      });

    doc.text(`Halaman ${i + 1}`, 50, doc.page.height - 30, {
      align: "center",
      width: doc.page.width - 100,
    });

    doc.fillColor("#000000");
  }
}

function ruangCukup(doc, tinggiBlok, marginBawah = 70) {
  return doc.y + tinggiBlok <= doc.page.height - marginBawah;
}

function pastikanRuang(doc, tinggiBlok) {
  if (!ruangCukup(doc, tinggiBlok)) {
    doc.addPage();
  }
}

function resetKedudukan(doc) {
  doc.x = 50;
}

function tajukSeksyen(doc, tajuk) {
  resetKedudukan(doc);
  pastikanRuang(doc, 55);

  doc
    .moveDown(0.8)
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#0f172a")
    .text(tajuk, 50, doc.y, {
      width: doc.page.width - 100,
      align: "left",
    });

  doc
    .moveDown(0.2)
    .strokeColor("#cbd5e1")
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .stroke();

  doc.moveDown(0.7).fillColor("#000000");
  resetKedudukan(doc);
}

function kadStatistik(doc, statistik) {
  resetKedudukan(doc);
  pastikanRuang(doc, 95);

  const startX = 50;
  const y = doc.y;
  const gap = 12;
  const lebar = (doc.page.width - 100 - gap * 2) / 3;
  const tinggi = 70;

  const kad = [
    {
      label: "Jumlah Rekod",
      nilai: statistik.jumlahRekod,
      warna: "#e0f2fe",
    },
    {
      label: "Guru Mata Pelajaran",
      nilai: statistik.jumlahGMP,
      warna: "#dcfce7",
    },
    {
      label: "Guru Sit-in",
      nilai: statistik.jumlahSitIn,
      warna: "#fef3c7",
    },
  ];

  kad.forEach((item, index) => {
    const x = startX + index * (lebar + gap);

    doc
      .roundedRect(x, y, lebar, tinggi, 12)
      .fillAndStroke(item.warna, "#cbd5e1");

    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(String(item.nilai), x + 12, y + 14, {
        width: lebar - 24,
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#475569")
      .text(item.label, x + 12, y + 44, {
        width: lebar - 24,
        align: "center",
      });
  });

  doc.y = y + tinggi + 18;
  doc.fillColor("#000000");
  resetKedudukan(doc);
}

function lukisBarChart(doc, tajuk, data, pilihan = {}) {
  if (!data || data.length === 0) return;

  resetKedudukan(doc);

  const tinggiBlok = 210;
  pastikanRuang(doc, tinggiBlok);

  const x = 60;
  const y = doc.y + 10;
  const chartWidth = doc.page.width - 140;
  const barHeight = 18;
  const gap = 10;
  const maxValue = Math.max(...data.map((item) => item.jumlah), 1);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#0f172a")
    .text(tajuk, 50, doc.y, {
      width: doc.page.width - 100,
      align: "center",
    });

  let currentY = y + 24;

  data.slice(0, pilihan.had || 5).forEach((item) => {
    const labelWidth = 140;
    const barWidth = Math.max(
      (item.jumlah / maxValue) * (chartWidth - labelWidth - 45),
      8
    );

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#334155")
      .text(item.nama, x, currentY, { width: labelWidth - 8 });

    doc
      .roundedRect(x + labelWidth, currentY - 2, barWidth, barHeight, 4)
      .fill(pilihan.warna || "#38bdf8");

    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(String(item.jumlah), x + labelWidth + barWidth + 8, currentY + 2);

    currentY += barHeight + gap;
  });

  doc.y = currentY + 12;
  doc.fillColor("#000000");
  resetKedudukan(doc);
}

function lukisPieRingkas(doc, tajuk, nilaiA, nilaiB, labelA, labelB) {
  resetKedudukan(doc);

  const tinggiBlok = 160;
  pastikanRuang(doc, tinggiBlok);

  const jumlah = nilaiA + nilaiB;
  const peratusA = jumlah > 0 ? nilaiA / jumlah : 0;
  const peratusB = jumlah > 0 ? nilaiB / jumlah : 0;

  const startY = doc.y;

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#0f172a")
    .text(tajuk, 50, doc.y, {
      width: doc.page.width - 100,
      align: "center",
    });

  const x = 170;
  const y = startY + 45;
  const totalWidth = 250;

  doc.roundedRect(x, y, totalWidth * peratusA, 28, 6).fill("#22c55e");

  doc
    .roundedRect(x + totalWidth * peratusA, y, totalWidth * peratusB, 28, 6)
    .fill("#f59e0b");

  doc
    .fillColor("#0f172a")
    .font("Helvetica")
    .fontSize(9)
    .text(
      `${labelA}: ${nilaiA} rekod (${kiraPeratus(nilaiA, jumlah)}%)`,
      x,
      y + 42,
      {
        width: doc.page.width - 100,
      }
    );

  doc.text(
    `${labelB}: ${nilaiB} rekod (${kiraPeratus(nilaiB, jumlah)}%)`,
    x,
    y + 58,
    {
      width: doc.page.width - 100,
    }
  );

  doc.y = y + 88;
  doc.fillColor("#000000");
  resetKedudukan(doc);
}

async function janaRumusanAI({
  bulan,
  tahun,
  jumlahRekod,
  jumlahGMP,
  jumlahSitIn,
  topKelas,
  topGuru,
  topSitInKelas,
  guruTiadaRekod,
}) {
  try {
    const prompt = `
Tulis rumusan laporan pemantauan MMI sekolah dalam Bahasa Malaysia.

Peranan:
Anda menulis seperti pegawai pemantauan pendidikan.

Data laporan:
- Bulan: ${bulan} ${tahun}
- Jumlah rekod MMI: ${jumlahRekod}
- Rekod Guru Mata Pelajaran: ${jumlahGMP}
- Rekod Guru Sit-in: ${jumlahSitIn}
- Peratus Guru Mata Pelajaran: ${kiraPeratus(jumlahGMP, jumlahRekod)}%
- Peratus Guru Sit-in: ${kiraPeratus(jumlahSitIn, jumlahRekod)}%
- Kelas rekod tertinggi: ${
      topKelas.map((item) => `${item.nama} (${item.jumlah})`).join(", ") ||
      "Tiada data"
    }
- Guru rekod tertinggi: ${
      topGuru.map((item) => `${item.nama} (${item.jumlah})`).join(", ") ||
      "Tiada data"
    }
- Guru tanpa rekod sepanjang bulan: ${
      guruTiadaRekod.join(", ") || "Tiada"
    }
- Jumlah guru tanpa rekod sepanjang bulan: ${guruTiadaRekod.length}
- Kelas sit-in tertinggi: ${
      topSitInKelas
        .map((item) => `${item.nama} (${item.jumlah})`)
        .join(", ") || "Tiada data"
    }

Arahan penulisan:
- Fokus kepada dapatan data, bukan kepada penggunaan sistem atau aplikasi.
- Jangan tulis ayat seperti "dijana oleh AI", "dijana secara automatik", atau "sistem ini".
- Gunakan nada profesional seperti laporan pemantauan pendidikan.
- Tulis 3 perenggan sahaja.
- Perenggan 1: ringkasan dapatan keseluruhan.
- Perenggan 2: analisis pola Guru Mata Pelajaran dan Guru Sit-in.
- Perenggan 3: cadangan tindakan pemantauan berdasarkan data.
- Jangan berlebihan memuji.
- Jangan gunakan frasa "selepas pengecualian" dalam laporan.
- Jangan reka data baharu di luar data yang diberi.
`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "Anda ialah pegawai pemantauan pendidikan yang menulis laporan rasmi berasaskan data sekolah.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.45,
      max_tokens: 450,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Ralat OpenAI:", error);

    return "Rumusan tidak dapat dijana. Sila semak data laporan dan konfigurasi perkhidmatan AI.";
  }
}

function janaPDFLaporan({
  bulan,
  tahun,
  jumlahRekod,
  jumlahGMP,
  jumlahSitIn,
  topKelas,
  topGuru,
  topSitInKelas,
  guruTiadaRekod,
  rumusanAI,
}) {
  const namaFail = `laporan_${bulan}_${tahun}.pdf`;
  const tempFilePath = path.join(os.tmpdir(), namaFail);

  const docPdf = new PDFDocument({
    size: "A4",
    margins: {
      top: 50,
      bottom: 60,
      left: 50,
      right: 50,
    },
    bufferPages: true,
  });

  const writeStream = fs.createWriteStream(tempFilePath);
  const logoPath = cariLogoSekolah();

  docPdf.pipe(writeStream);

  if (logoPath) {
    try {
      const logoSize = 78;

      docPdf.image(logoPath, (docPdf.page.width - logoSize) / 2, 45, {
        fit: [logoSize, logoSize],
      });

      docPdf.y = 135;
    } catch (error) {
      console.error("Logo gagal dimasukkan ke PDF:", error);
      docPdf.y = 70;
    }
  } else {
    docPdf.y = 70;
  }

  resetKedudukan(docPdf);

  docPdf
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor("#0f172a")
    .text("LAPORAN ANALISIS PEMANTAUAN MMI", 50, docPdf.y, {
      width: docPdf.page.width - 100,
      align: "center",
    });

  docPdf
    .moveDown(0.3)
    .fontSize(13)
    .text("SK BATU 10, SIBU", 50, docPdf.y, {
      width: docPdf.page.width - 100,
      align: "center",
    });

  docPdf
    .moveDown(0.3)
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#475569")
    .text(`${String(bulan).toUpperCase()} ${tahun}`, 50, docPdf.y, {
      width: docPdf.page.width - 100,
      align: "center",
    });

  docPdf
    .moveDown(1.1)
    .strokeColor("#cbd5e1")
    .lineWidth(1)
    .moveTo(75, docPdf.y)
    .lineTo(docPdf.page.width - 75, docPdf.y)
    .stroke();

  docPdf.moveDown(1.2).fillColor("#000000");
  resetKedudukan(docPdf);

  tajukSeksyen(docPdf, "1. Ringkasan Statistik Utama");

  kadStatistik(docPdf, {
    jumlahRekod,
    jumlahGMP,
    jumlahSitIn,
  });

  tajukSeksyen(docPdf, "2. Rumusan Pemantauan");

  pastikanRuang(docPdf, 180);
  resetKedudukan(docPdf);

  docPdf
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#111827")
    .text(rumusanAI, 50, docPdf.y, {
      width: docPdf.page.width - 100,
      align: "justify",
      lineGap: 4,
    });

  resetKedudukan(docPdf);

  pastikanRuang(docPdf, 260);

tajukSeksyen(docPdf, "3. Visualisasi Data");

lukisPieRingkas(
    docPdf,
    "Nisbah Rekod Guru Mata Pelajaran dan Guru Sit-in",
    jumlahGMP,
    jumlahSitIn,
    "Guru Mata Pelajaran",
    "Guru Sit-in"
  );

  lukisBarChart(docPdf, "Kelas Dengan Rekod Tertinggi", topKelas, {
    warna: "#38bdf8",
    had: 5,
  });

  lukisBarChart(
    docPdf,
    "Kelas Dengan Rekod Guru Sit-in Tertinggi",
    topSitInKelas,
    {
      warna: "#f59e0b",
      had: 5,
    }
  );

  tajukSeksyen(docPdf, "4. Dapatan Ringkas");

  pastikanRuang(docPdf, 120);
  resetKedudukan(docPdf);

  docPdf
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#111827")
    .text(
      `Jumlah keseluruhan rekod MMI bagi bulan ${bulan} ${tahun} ialah ${jumlahRekod}. Daripada jumlah tersebut, ${jumlahGMP} rekod melibatkan Guru Mata Pelajaran dan ${jumlahSitIn} rekod melibatkan Guru Sit-in.`,
      50,
      docPdf.y,
      {
        width: docPdf.page.width - 100,
        align: "justify",
        lineGap: 4,
      }
    );

  docPdf.moveDown(0.8);
  resetKedudukan(docPdf);

  if (topKelas.length > 0) {
    docPdf.text(
      `Kelas dengan rekod tertinggi ialah ${topKelas[0].nama} dengan ${topKelas[0].jumlah} rekod. Data ini boleh dijadikan rujukan awal untuk melihat pola pengisian rekod mengikut kelas.`,
      50,
      docPdf.y,
      {
        width: docPdf.page.width - 100,
        align: "justify",
        lineGap: 4,
      }
    );
  }

  if (topSitInKelas.length > 0) {
    docPdf.moveDown(0.8);
    resetKedudukan(docPdf);

    docPdf.text(
      `Kelas dengan rekod Guru Sit-in tertinggi ialah ${topSitInKelas[0].nama} dengan ${topSitInKelas[0].jumlah} rekod. Kelas ini boleh diberikan perhatian dalam pemantauan keberadaan guru dan kesinambungan PdP.`,
      50,
      docPdf.y,
      {
        width: docPdf.page.width - 100,
        align: "justify",
        lineGap: 4,
      }
    );
  }

  docPdf.moveDown(0.8);
  resetKedudukan(docPdf);
  pastikanRuang(docPdf, 110);

  docPdf
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#0f172a")
    .text("Guru Yang Tiada Rekod MMI Sepanjang Bulan", 50, docPdf.y, {
      width: docPdf.page.width - 100,
    });

  docPdf.moveDown(0.3);
  resetKedudukan(docPdf);

  docPdf
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#111827")
    .text(
      guruTiadaRekod.length > 0
        ? `Jumlah: ${guruTiadaRekod.length} orang\nNama guru: ${guruTiadaRekod.join(", ")}`
        : "Tiada. Semua guru mempunyai sekurang-kurangnya satu rekod MMI dalam bulan ini.",
      50,
      docPdf.y,
      {
        width: docPdf.page.width - 100,
        align: "justify",
        lineGap: 4,
      }
    );

  tambahNomborHalaman(docPdf);

  docPdf.end();

  return new Promise((resolve) => {
    writeStream.on("finish", () => resolve(tempFilePath));
  });
}

async function dapatkanDataLaporan(bulan, tahun) {
  const rekodSnapshot = await admin.firestore().collection("rekod_mmi").get();
  const guruSnapshot = await admin.firestore().collection("senarai_guru").get();
  const rekodBulanIni = [];
  const senaraiGuru = [];

  guruSnapshot.forEach((doc) => {
    const nama = String(doc.data().nama || "").trim();
    if (nama) senaraiGuru.push(nama);
  });

  rekodSnapshot.forEach((doc) => {
    const data = doc.data();
    const parts = String(data.tarikh || "").split("/");

    if (parts.length === 3) {
      const bulanNombor = parts[1];
      const tahunRekod = parts[2];

      const namaBulan = new Date(
        `${tahunRekod}-${bulanNombor}-01`
      ).toLocaleString("ms-MY", {
        month: "long",
      });

      if (
        namaBulan.toLowerCase() === bulan.toLowerCase() &&
        String(tahunRekod) === String(tahun)
      ) {
        rekodBulanIni.push(data);
      }
    }
  });

  const jumlahRekod = rekodBulanIni.length;

  const jumlahGMP = rekodBulanIni.filter(
    (item) => item.jenisGuru === "Guru Mata Pelajaran"
  ).length;

  const jumlahSitIn = rekodBulanIni.filter(
    (item) => item.jenisGuru === "Guru Sit-in"
  ).length;

  const topKelas = dapatkanTop(rekodBulanIni, "kelas", 5);
  const topGuru = dapatkanTop(rekodBulanIni, "guru", 5);
  const topSitInKelas = dapatkanTopSitInKelas(rekodBulanIni, 5);
  const guruAdaRekod = new Set(
    rekodBulanIni
      .map((item) => normalisasiNama(item.guru))
      .filter(Boolean)
  );
  const guruTiadaRekod = senaraiGuru
    .filter((nama) => {
      const namaNormal = normalisasiNama(nama);
      return (
        !guruAdaRekod.has(namaNormal) &&
        !GURU_DIKECUALIKAN_TIADA_REKOD.includes(namaNormal)
      );
    })
    .sort((a, b) => a.localeCompare(b, "ms", { numeric: true }));

  return {
    rekodBulanIni,
    jumlahRekod,
    jumlahGMP,
    jumlahSitIn,
    topKelas,
    topGuru,
    topSitInKelas,
    guruTiadaRekod,
  };
}

async function janaDanSimpanLaporan({ bulan, tahun, manual = false }) {
  const {
    jumlahRekod,
    jumlahGMP,
    jumlahSitIn,
    topKelas,
    topGuru,
    topSitInKelas,
    guruTiadaRekod,
  } = await dapatkanDataLaporan(bulan, tahun);

  const rumusanAI = await janaRumusanAI({
    bulan,
    tahun,
    jumlahRekod,
    jumlahGMP,
    jumlahSitIn,
    topKelas,
    topGuru,
    topSitInKelas,
    guruTiadaRekod,
  });

  const tempFilePath = await janaPDFLaporan({
    bulan,
    tahun,
    jumlahRekod,
    jumlahGMP,
    jumlahSitIn,
    topKelas,
    topGuru,
    topSitInKelas,
    guruTiadaRekod,
    rumusanAI,
  });

  const namaFail = manual
    ? `laporan_${bulan}_${tahun}_${Date.now()}.pdf`
    : `laporan_${bulan}_${tahun}.pdf`;

  const bucket = admin.storage().bucket();
  const destination = `laporan_bulanan/${namaFail}`;

  await bucket.upload(tempFilePath, {
    destination,
    contentType: "application/pdf",
  });

  const file = bucket.file(destination);

  const [pdfUrl] = await file.getSignedUrl({
    action: "read",
    expires: "03-01-2500",
  });

  const laporanRef = await admin.firestore().collection("laporan_bulanan").add({
    tajuk: `Laporan Bulan ${bulan}`,
    bulan,
    tahun,
    pdfUrl,
    jumlahRekod,
    jumlahGMP,
    jumlahSitIn,
    peratusGMP: kiraPeratus(jumlahGMP, jumlahRekod),
    peratusSitIn: kiraPeratus(jumlahSitIn, jumlahRekod),
    topKelas,
    topGuru,
    topSitInKelas,
    guruTiadaRekod,
    rumusanAI,
    status: "Selesai",
    manual,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  fs.unlinkSync(tempFilePath);

  return {
    id: laporanRef.id,
    pdfUrl,
    jumlahRekod,
    jumlahGMP,
    jumlahSitIn,
  };
}

exports.janaLaporanBulananManual = onRequest(
  {
    region: "us-central1",
    cors: true,
    secrets: ["OPENAI_API_KEY"],
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({
          success: false,
          message: "Kaedah request tidak dibenarkan.",
        });
        return;
      }

      const payload = req.body?.data || req.body || {};
      const sekarang = new Date();
      const bulan =
        dapatkanNamaBulan(payload.bulan) ||
        sekarang.toLocaleString("ms-MY", {
          month: "long",
        });
      const tahun = Number(payload.tahun) || sekarang.getFullYear();

      const hasil = await janaDanSimpanLaporan({
        bulan,
        tahun,
        manual: true,
      });

      res.status(200).json({
        success: true,
        message: "Laporan berjaya dijana",
        ...hasil,
      });
    } catch (error) {
      console.error("Ralat janaLaporanBulananManual:", error);

      res.status(500).json({
        success: false,
        message: "Laporan gagal dijana.",
      });
    }
  }
);

exports.janaLaporanBulananAuto = onSchedule(
  {
    schedule: "59 23 28-31 * *",
    timeZone: "Asia/Kuching",
    secrets: ["OPENAI_API_KEY"],
  },
  async () => {
    const sekarang = new Date();

    const esok = new Date(sekarang);
    esok.setDate(sekarang.getDate() + 1);

    if (esok.getDate() !== 1) {
      console.log("Bukan hari terakhir bulan. Fungsi dihentikan.");
      return null;
    }

    const bulan = sekarang.toLocaleString("ms-MY", {
      month: "long",
    });

    const tahun = sekarang.getFullYear();

    await janaDanSimpanLaporan({
      bulan,
      tahun,
      manual: false,
    });

    console.log("Laporan bulanan berjaya dijana secara automatik.");

    return null;
  }
);
