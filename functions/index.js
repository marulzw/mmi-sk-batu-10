const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const os = require("os");
const path = require("path");

admin.initializeApp();

function janaRumusanAI({ jumlahRekod, jumlahGMP, jumlahSitIn }) {
  const peratusGMP = jumlahRekod > 0 ? ((jumlahGMP / jumlahRekod) * 100).toFixed(1) : 0;
  const peratusSitIn = jumlahRekod > 0 ? ((jumlahSitIn / jumlahRekod) * 100).toFixed(1) : 0;

  if (jumlahRekod === 0) {
    return "Tiada rekod MMI direkodkan bagi bulan ini. Pemantauan dan pengisian rekod perlu diperkukuh bagi memastikan data MMI sekolah lengkap.";
  }

  if (jumlahSitIn === 0) {
    return `Sepanjang bulan ini, sebanyak ${jumlahRekod} rekod MMI telah direkodkan. Semua rekod melibatkan Guru Mata Pelajaran tanpa keperluan Guru Sit-in. Ini menunjukkan keberadaan guru dalam kelas berada pada tahap sangat baik.`;
  }

  return `Sepanjang bulan ini, sebanyak ${jumlahRekod} rekod MMI telah direkodkan. Daripada jumlah tersebut, ${jumlahGMP} rekod atau ${peratusGMP}% melibatkan Guru Mata Pelajaran, manakala ${jumlahSitIn} rekod atau ${peratusSitIn}% melibatkan Guru Sit-in. Secara keseluruhannya, pelaksanaan MMI berjalan baik, namun kelas yang memerlukan Guru Sit-in perlu terus dipantau bagi mengurangkan gangguan terhadap masa instruksional murid.`;
}

exports.janaLaporanBulananAuto = onSchedule(
  {
    schedule: "59 23 28-31 * *",
    timeZone: "Asia/Kuching",
  },
  async () => {
    const sekarang = new Date();

    const esok = new Date(sekarang);
    esok.setDate(sekarang.getDate() + 1);

    if (esok.getDate() !== 1) {
      console.log("Bukan hari terakhir bulan. Fungsi dihentikan.");
      return null;
    }

    const bulan = sekarang.toLocaleString("ms-MY", { month: "long" });
    const tahun = sekarang.getFullYear();

    const rekodSnapshot = await admin.firestore().collection("rekod_mmi").get();
    const rekodBulanIni = [];

    rekodSnapshot.forEach((doc) => {
      const data = doc.data();
      const parts = String(data.tarikh || "").split("/");

      if (parts.length === 3) {
        const bulanNombor = parts[1];
        const tahunRekod = parts[2];

        const namaBulan = new Date(
          `${tahunRekod}-${bulanNombor}-01`
        ).toLocaleString("ms-MY", { month: "long" });

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
    const rumusanAI = janaRumusanAI({
  jumlahRekod,
  jumlahGMP,
  jumlahSitIn,
});

    const namaFail = `laporan_${bulan}_${tahun}.pdf`;
    const tempFilePath = path.join(os.tmpdir(), namaFail);

    const docPdf = new PDFDocument();
    const writeStream = fs.createWriteStream(tempFilePath);

    docPdf.pipe(writeStream);

    docPdf.fontSize(20).text("LAPORAN BULANAN MMI", { align: "center" });
    docPdf.moveDown();
    docPdf.fontSize(14).text("SK Batu 10, Sibu");
    docPdf.text(`Bulan: ${bulan}`);
    docPdf.text(`Tahun: ${tahun}`);
    docPdf.moveDown();
    docPdf.text(`Jumlah Rekod: ${jumlahRekod}`);
    docPdf.text(`Guru Mata Pelajaran: ${jumlahGMP}`);
    docPdf.text(`Guru Sit-in: ${jumlahSitIn}`);
    docPdf.moveDown();
    docPdf.fontSize(14).text("Rumusan AI:", { underline: true });
docPdf.moveDown(0.5);
docPdf.fontSize(12).text(rumusanAI, {
  align: "justify",
});

    docPdf.end();

    await new Promise((resolve) => {
      writeStream.on("finish", resolve);
    });

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

    await admin.firestore().collection("laporan_bulanan").add({
      tajuk: `Laporan Bulan ${bulan}`,
      bulan,
      tahun,
      pdfUrl,
      jumlahRekod,
      jumlahGMP,
      jumlahSitIn,
rumusanAI,
status: "Selesai",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    fs.unlinkSync(tempFilePath);

    console.log("Laporan bulanan berjaya dijana secara automatik.");
    return null;
  }
);