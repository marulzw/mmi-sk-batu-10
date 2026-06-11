# Project Rules: MMI SK Batu 10

## 1. Peraturan Pembangunan Projek

- Projek ini ialah aplikasi web React + Vite untuk merekod keberadaan guru di kelas mengikut slot masa instruksional.
- Sebarang perubahan mesti mengekalkan tujuan utama aplikasi: rekod MMI harian, analisis harian, laporan bulanan, dan pengurusan admin.
- Jangan ubah aliran utama tanpa arahan jelas:
  - Guru isi rekod harian melalui tab `Rekod`.
  - Admin mengurus guru, kelas, dan laporan melalui tab `Login/Admin`.
  - Analisis harian dipaparkan melalui tab `Analisis`.
  - Laporan bulanan dipaparkan melalui tab `Laporan Bulanan`.
- Paparan harian mesti berdasarkan tarikh semasa sahaja.
- Rekod sejarah dalam Firestore tidak boleh dipadam semata-mata untuk reset paparan harian.
- Reset harian mesti dibuat melalui penapisan tarikh, bukan melalui pemadaman data.
- Perubahan UI mesti mengekalkan kesesuaian paparan telefon kerana URL utama digunakan melalui QR code.
- URL rasmi pengguna ialah Vercel:
  - `https://mmi-sk-batu-10.vercel.app`
- Firebase Hosting ialah backup:
  - `https://mmi-sk-batu-10.web.app`

## 2. Struktur Database Yang Tidak Boleh Diubah Tanpa Arahan

Struktur koleksi Firestore berikut tidak boleh diubah, dinamakan semula, atau dipadam tanpa arahan jelas.

### `rekod_mmi`

Koleksi utama untuk rekod MMI harian.

Medan penting:

- `tarikh`
- `hari`
- `masaHantar`
- `kelas`
- `guru`
- `masa`
- `masaArray`
- `jenisGuru`
- `guruYangDiganti`
- `createdAt`

Peraturan:

- `tarikh` digunakan untuk reset paparan harian.
- `masaArray` perlu dikekalkan untuk semakan slot masa.
- `jenisGuru` mesti mengekalkan nilai:
  - `Guru Mata Pelajaran`
  - `Guru Sit-in`
- `guruYangDiganti` digunakan apabila `jenisGuru` ialah `Guru Sit-in`.
- Jangan tukar nama koleksi `rekod_mmi`.

### `senarai_guru`

Koleksi senarai guru untuk dropdown.

Medan penting:

- `nama`

Peraturan:

- Nama guru digunakan dalam borang rekod.
- Nama guru sendiri mesti dikecualikan daripada dropdown `Guru yang diganti`.
- Jangan tukar nama koleksi `senarai_guru`.

### `senarai_kelas`

Koleksi senarai kelas untuk dropdown dan analisis.

Medan penting:

- `nama`

Peraturan:

- Nama kelas digunakan untuk rekod, filter, analisis, dan laporan PDF.
- Jangan tukar nama koleksi `senarai_kelas`.

### `laporan_bulanan`

Koleksi metadata laporan bulanan dan pautan PDF.

Medan penting:

- `tajuk`
- `bulan`
- `tahun`
- `pdfUrl`
- `createdAt`

Peraturan:

- Laporan bulanan mesti berdasarkan data sejarah.
- Jangan tukar nama koleksi `laporan_bulanan`.

## 3. Fail Kritikal Yang Tidak Boleh Diubah Tanpa Arahan

Fail berikut dianggap kritikal dan tidak boleh diubah tanpa arahan khusus:

- `src/App.jsx`
  - Mengandungi logik utama app, Firebase reads/writes, borang rekod, analisis, admin, dan PDF.

- `functions/index.js`
  - Mengandungi Firebase Functions untuk laporan bulanan automatik dan manual.

- `firebase.json`
  - Mengandungi konfigurasi Firebase Functions dan Hosting.

- `.firebaserc`
  - Mengikat projek kepada Firebase project `mmi-sk-batu-10`.

- `public/manifest.json`
  - Mengawal metadata PWA dan ikon app.

- `public/icon-192.png`
  - Ikon app saiz kecil.

- `public/icon-512.png`
  - Ikon app saiz besar.

- `public/icon-original.png`
  - Sumber ikon asal.

- `public/logo-sekolah.png`
  - Logo sekolah, berasingan daripada ikon app.

- `vite.config.js`
  - Mengawal konfigurasi Vite dan akses rangkaian untuk ujian telefon.

Peraturan:

- Jangan padam fail kritikal.
- Jangan tukar Firebase project ID tanpa arahan jelas.
- Jangan tukar URL rasmi atau fallback tanpa arahan jelas.
- Jangan tukar ikon atau logo tanpa arahan jelas.

## 4. Standard Keselamatan

- Authentication mesti menggunakan Firebase Authentication.
- Login admin semasa ialah email dan password.
- Bahagian admin mesti dilindungi oleh status login.
- Fungsi admin tidak boleh boleh diakses oleh pengguna yang belum login.
- Jangan tambah kaedah login baharu tanpa arahan.
- Jangan bergantung pada Firebase Dynamic Links untuk login.
- Jangan dedahkan credential rahsia atau token deployment dalam fail projek.
- Jangan simpan password dalam Firestore.
- Jangan ubah logik admin supaya pengguna biasa boleh:
  - tambah guru
  - padam guru
  - tambah kelas
  - padam kelas
  - jana laporan bulanan manual
- Firebase Functions hanya perlu deploy apabila backend berubah.
- Email link authentication tidak digunakan dalam app ini.

## 5. Standard Prestasi

- Build mesti dijalankan sebelum deploy:

```bash
npm run build
```

- Paparan harian mesti menapis data berdasarkan tarikh semasa.
- Dashboard harian tidak boleh mengira keseluruhan rekod sejarah.
- Modul analisis harian mesti menggunakan rekod hari ini sahaja.
- Laporan bulanan boleh menggunakan data sejarah.
- Jangan padam rekod sejarah untuk meningkatkan prestasi paparan harian.
- Chart harian mesti berdasarkan data yang telah ditapis mengikut tarikh semasa.
- App mesti kekal sesuai untuk telefon kerana QR code digunakan oleh pengguna.
- Navigasi utama mesti muat pada paparan telefon:
  - `Rekod`
  - `Analisis`
  - `Laporan Bulanan`
  - `Login/Admin`

## 6. Standard Laporan PDF

- PDF mesti mengekalkan format jadual penuh mengikut slot jadual waktu.
- Setiap hari aktif dan setiap kelas mesti memaparkan semua slot masa yang diperlukan.
- Slot kosong mesti dipaparkan dengan `-`.
- Waktu rehat mesti dipaparkan sebagai baris khas.
- Waktu rehat tidak dikira sebagai slot instruksional.
- Kolum PDF wajib:
  - `Bil`
  - `Masa`
  - `Kelas`
  - `Guru`
  - `Guru Diganti`
  - `Jenis Guru`
  - `Masa Hantar`
- `Guru Diganti` mesti dipaparkan untuk rekod `Guru Sit-in`.
- Sabtu dan Ahad tidak perlu dijana sebagai hari persekolahan.
- Jika semua kelas tiada rekod pada sesuatu tarikh, laporan mesti menandakan hari tersebut sebagai tidak aktif atau cuti.
- Layout PDF mesti padat supaya sehingga 12 slot boleh muat dalam satu halaman landscape.
- Laporan bulanan mesti menggunakan data sejarah bulanan, bukan hanya data hari ini.
- Fungsi laporan bulanan automatik berada dalam Firebase Functions.

## 7. Standard Commit Git

- Commit mesti dibuat selepas perubahan siap dan build lulus.
- Mesej commit mesti ringkas dan menerangkan perubahan.
- Contoh gaya commit:

```bash
git commit -m "Betulkan kiraan harian dashboard dan analisis"
```

- Jangan commit `node_modules`.
- Jangan commit fail sementara yang tidak diperlukan.
- Jangan commit perubahan yang tidak berkaitan dengan tugasan semasa.
- Semak status sebelum commit:

```bash
git status -sb
```

- Semak diff sebelum commit:

```bash
git diff
```

- Push utama menggunakan branch `main`:

```bash
git push origin main
```

## 8. Standard Deployment

### Vercel

- Vercel ialah URL rasmi kerana QR code telah menggunakan URL ini:

```text
https://mmi-sk-batu-10.vercel.app
```

- Push ke branch `main` akan trigger Vercel auto-deploy.
- Selepas push, status Vercel mesti disemak.
- Delay Vercel yang diperhatikan biasanya sekitar 25-30 saat.

### Firebase Hosting

- Firebase Hosting ialah backup deployment:

```text
https://mmi-sk-batu-10.web.app
```

- Deploy Firebase Hosting hanya selepas build berjaya.
- Command deploy:

```bash
firebase deploy --only hosting --project mmi-sk-batu-10
```

### Firebase Functions

- Functions hanya deploy apabila `functions/index.js` atau backend berkaitan berubah.
- Command deploy:

```bash
firebase deploy --only functions --project mmi-sk-batu-10
```

### Standard Workflow Deploy

1. Edit local.
2. Build:

```bash
npm run build
```

3. Test local atau telefon:

```bash
npm run dev
```

4. Commit:

```bash
git add .
git commit -m "Descriptive message"
```

5. Push:

```bash
git push origin main
```

6. Semak Vercel auto-deploy.
7. Deploy Firebase Hosting jika perlu.
8. Deploy Firebase Functions hanya jika backend berubah.

