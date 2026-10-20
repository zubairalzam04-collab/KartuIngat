const $ = s => document.querySelector(s);
const KUNCI = 'kartuingat.v1';

// ---------- DATA ----------
let S = { decks: [], xp: 0, days: {}, theme: 'samudra' };
try {
  const tersimpan = JSON.parse(localStorage.getItem(KUNCI));
  if (tersimpan) S = tersimpan;
} catch (e) {}
S.bonus = S.bonus || {};   // mencatat tanggal bonus harian sudah diambil

const simpan = () => localStorage.setItem(KUNCI, JSON.stringify(S));
const uid = () => Math.random().toString(36).slice(2, 9);

// esc() mencegah teks pengguna dibaca sebagai kode HTML
const esc = s => String(s).replace(/[&<>"]/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

const hariIni = () => new Date().toLocaleDateString('en-CA'); // format 2026-10-19

// md(): markdown dasar. **tebal**, *miring*, `kode`, baris baru
const md = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\*([^*]+)\*/g, '<i>$1</i>')
  .replace(/\n/g, '<br>');

// mk(): membuat satu kartu baru
const mk = (f, b) => ({ id: uid(), f, b, ease: 2.5, int: 0, reps: 0, due: hariIni() });

// ---------- ALGORITMA SPACED REPETITION ----------
const tambahHari = n => { const d = new Date(); d.setDate(d.getDate() + n);
                          return d.toLocaleDateString('en-CA'); };
const perluUlas = d => d.cards.filter(c => c.due <= hariIni());

// Jeda hari sampai kartu muncul lagi. r: 0=Lagi, 1=Bagus, 2=Mudah
const jedaBerikut = (c, r) =>
  r === 0 ? 0 :
  r === 1 ? (c.reps ? Math.max(c.int + 1, Math.round(c.int * c.ease)) : 1) :
            (c.reps ? Math.max(c.int + 2, Math.round(c.int * c.ease * 1.4)) : 4);

const labelJeda = n => n === 0 ? 'hari ini' : n < 7 ? n + ' hari'
  : n < 30 ? Math.round(n / 7) + ' minggu' : Math.round(n / 30) + ' bulan';

// ---------- HELPER STATISTIK ----------
const semuaKartu = () => S.decks.flatMap(d => d.cards);
const dikuasai = () => semuaKartu().filter(c => c.int >= 21).length;

// Streak: hari berturut-turut belajar. Jika hari ini belum belajar,
// hitungan mulai dari kemarin, jadi streak tidak langsung jadi 0 di pagi hari.
const streak = () => {
  let n = 0, i = S.days[hariIni()] ? 0 : 1;
  while (S.days[tambahHari(-i)]) { n++; i++; }
  return n;
};

// ---------- HELPER GAMIFIKASI ----------
// Level naik makin lambat: level 2 di 40 energi, level 3 di 160, level 4 di 360, dst.
const level = () => Math.floor(Math.sqrt(S.xp / 40)) + 1;

// [kode, nama, level minimal, warna]
const TEMA = [
  ['samudra', 'Samudra',    1, '#3b6fd4'],
  ['hutan',   'Hutan',      2, '#2f8f5b'],
  ['senja',   'Senja',      3, '#d9622b'],
  ['malam',   'Ungu Malam', 5, '#7a4fd1']
];

// [ikon, nama, syarat, fungsi pengecek]
const LENCANA = [
  ['🌱', 'Langkah Pertama', '1 ulasan',        () => Object.values(S.days).reduce((a, b) => a + b, 0) >= 1],
  ['📚', 'Kolektor',        '10 kartu',        () => semuaKartu().length >= 10],
  ['🔥', 'Konsisten',       'Streak 3 hari',   () => streak() >= 3],
  ['🏅', 'Rajin Seminggu',  'Streak 7 hari',   () => streak() >= 7],
  ['🎓', 'Penguasa',        'Kuasai 10 kartu', () => dikuasai() >= 10],
  ['💯', 'Seratus',         '100 ulasan',      () => Object.values(S.days).reduce((a, b) => a + b, 0) >= 100]
];

// ---------- STATUS LAYAR ----------
let layar = 'decks';
let siapHapus = null;   // dek yang menunggu konfirmasi hapus
let deckAktif = null;   // dek yang sedang diedit
let editId = null;      // kartu yang sedang diubah (null = kartu baru)
let sesi = null;        // data sesi belajar yang sedang berjalan

// ---------- DEK ----------
function tampilDek() {
  const daftar = S.decks.map(d => `
    <div class="box">
      <b>${esc(d.name)}</b>
      <div class="mu">${d.cards.length} kartu · ${perluUlas(d).length} perlu diulas</div>
      <div class="row">
        <button class="b" ${perluUlas(d).length ? '' : 'disabled'}
                onclick="mulaiBelajar('${d.id}')">Belajar</button>
        <button class="g" onclick="bukaEditor('${d.id}')">Kartu</button>
        <button class="g" onclick="hapusDek('${d.id}')">
          ${siapHapus === d.id ? 'Yakin?' : 'Hapus'}
        </button>
      </div>
    </div>`).join('');

  return `<h3>Dek saya</h3>
    <div class="row">
      <input id="namaDek" placeholder="Nama dek baru, mis. Kosakata Jepang">
      <button class="b" onclick="tambahDek()">Buat</button>
    </div>
    ${daftar || '<p class="mu">Belum ada dek.</p>'}`;
}

function tambahDek() {
  const nama = $('#namaDek').value.trim();
  if (!nama) return;
  S.decks.push({ id: uid(), name: nama, cards: [] });
  simpan();
  render();
}

function hapusDek(id) {
  if (siapHapus !== id) { siapHapus = id; return render(); } // ketukan 1: minta konfirmasi
  S.decks = S.decks.filter(d => d.id !== id);                // ketukan 2: hapus
  siapHapus = null;
  simpan();
  render();
}

// ---------- EDITOR KARTU ----------
function bukaEditor(id) { deckAktif = id; editId = null; layar = 'edit'; render(); }

function tampilEdit() {
  const d = S.decks.find(x => x.id === deckAktif);
  if (!d) { layar = 'decks'; return tampilDek(); }
  const e = d.cards.find(c => c.id === editId) || { f: '', b: '' };

  const daftar = d.cards.map(c => `
    <div class="box">
      <div>${md(c.f)}</div>
      <div class="mu">${md(c.b)}</div>
      <div class="row">
        <button class="g" onclick="ubahKartu('${c.id}')">Ubah</button>
        <button class="g" onclick="hapusKartu('${c.id}')">Hapus</button>
      </div>
    </div>`).join('');

  return `<button class="g" onclick="layar='decks';render()">← Kembali</button>
    <h3>${esc(d.name)}</h3>
    <div class="box">
      <label>Depan (pertanyaan)</label>
      <textarea id="kf">${esc(e.f)}</textarea>
      <label>Belakang (jawaban)</label>
      <textarea id="kb">${esc(e.b)}</textarea>
      <div class="mu">Mendukung **tebal**, *miring*, dan &#96;kode&#96;</div>
      <div class="row">
        <button class="b" onclick="simpanKartu()">${editId ? 'Simpan perubahan' : 'Tambah kartu'}</button>
      </div>
    </div>
    ${daftar || '<p class="mu">Belum ada kartu.</p>'}`;
}

function simpanKartu() {
  const d = S.decks.find(x => x.id === deckAktif);
  const f = $('#kf').value.trim(), b = $('#kb').value.trim();
  if (!f || !b) return;                       // dua-duanya wajib diisi
  const lama = d.cards.find(c => c.id === editId);
  if (lama) { lama.f = f; lama.b = b; }       // mode ubah
  else d.cards.push(mk(f, b));                // mode tambah
  editId = null;
  simpan();
  render();
}

function ubahKartu(id) { editId = id; render(); window.scrollTo(0, 0); }

function hapusKartu(id) {
  const d = S.decks.find(x => x.id === deckAktif);
  d.cards = d.cards.filter(c => c.id !== id);
  simpan();
  render();
}

// ---------- SESI BELAJAR ----------
function mulaiBelajar(id) {
  const d = S.decks.find(x => x.id === id);
  sesi = { deck: id, antrean: perluUlas(d).map(c => c.id), terbalik: false, selesai: 0 };
  layar = 'study';
  render();
}

function tampilBelajar() {
  const d = S.decks.find(x => x.id === sesi.deck);
  if (!sesi.antrean.length) return `
    <div class="box" style="text-align:center">
      <h3>Selesai 🎉</h3>
      <p>${sesi.selesai} kartu diulas.${sesi.bonus ? ' Bonus +20 energi! ⚡' : ''}</p>
      <button class="b" onclick="layar='decks';render()">Kembali ke dek</button>
    </div>`;
  const c = d.cards.find(x => x.id === sesi.antrean[0]);
  const tombol = [['Lagi', 0], ['Bagus', 1], ['Mudah', 2]].map(([t, r]) =>
    `<button class="r${r}" onclick="nilai(${r})">${t}<small>${labelJeda(jedaBerikut(c, r))}</small></button>`
  ).join('');
  return `<div class="mu">${esc(d.name)} · sisa ${sesi.antrean.length}</div>
    <div class="card ${sesi.terbalik ? 'fl' : ''}" id="kartu" onclick="balik()">
      <div class="in">
        <div class="face">${md(c.f)}</div>
        <div class="face bk">${md(c.b)}</div>
      </div>
    </div>
    ${sesi.terbalik ? `<div class="row">${tombol}</div>`
      : '<p class="mu" style="text-align:center">Ketuk kartu untuk membalik</p>'}`;
}

function balik() {
  if (sesi.terbalik) return;
  sesi.terbalik = true;
  $('#kartu').classList.add('fl');   // memicu animasi
  setTimeout(render, 520);           // setelah animasi, munculkan tombol
}

function nilai(r) {
  const d = S.decks.find(x => x.id === sesi.deck);
  const c = d.cards.find(x => x.id === sesi.antrean[0]);
  const n = jedaBerikut(c, r);
  sesi.antrean.shift();
  if (r === 0) {                     // Lagi: turunkan ease, muncul lagi hari ini
    c.ease = Math.max(1.3, c.ease - 0.2); c.reps = 0; c.int = 0; c.due = hariIni();
    sesi.antrean.splice(Math.min(3, sesi.antrean.length), 0, c.id);
  } else {                           // Bagus/Mudah: jadwalkan hari berikutnya
    c.int = n; if (r === 2) c.ease += 0.15;
    c.reps++; c.due = tambahHari(n); sesi.selesai++;
  }
  S.xp += [1, 5, 8][r];                                  // Lagi +1, Bagus +5, Mudah +8
  S.days[hariIni()] = (S.days[hariIni()] || 0) + 1;
  if (!sesi.antrean.length && !S.bonus[hariIni()]) {     // sesi tuntas, bonus sekali sehari
    S.bonus[hariIni()] = true; S.xp += 20; sesi.bonus = true;
  }
  simpan(); sesi.terbalik = false; render();
}

// ---------- STATISTIK ----------
function tampilStats() {
  const hari = [...Array(7)].map((_, i) => tambahHari(i - 6));  // 6 hari lalu s/d hari ini
  const jml = hari.map(h => S.days[h] || 0);
  const maks = Math.max(1, ...jml);                              // cegah bagi nol
  const perluHariIni = S.decks.reduce((a, d) => a + perluUlas(d).length, 0);

  const batang = hari.map((h, i) => `
    <div><span>${jml[i]}</span>
      <i style="height:${jml[i] / maks * 100}%"></i>
      <span>${h.slice(8)}</span></div>`).join('');

  return `<h3>Statistik</h3>
    <div class="grid">
      <div class="box"><big>${perluHariIni}</big>perlu diulas hari ini</div>
      <div class="box"><big>${dikuasai()}</big>kartu dikuasai</div>
      <div class="box"><big>${streak()} 🔥</big>streak hari</div>
      <div class="box"><big>${semuaKartu().length}</big>total kartu</div>
    </div>
    <div class="box"><b>Ulasan 7 hari terakhir</b><div class="chart">${batang}</div></div>
    <p class="mu">Dikuasai = kartu dengan jeda ulasan 21 hari atau lebih.</p>`;
}

// ---------- PROFIL ----------
function tampilProfil() {
  const L = level(), a = 40 * (L - 1) ** 2, b = 40 * L * L;   // batas energi level ini
  const tema = TEMA.map(([k, nama, min]) => `
    <button class="${S.theme === k ? 'b' : 'g'}" ${L < min ? 'disabled' : ''}
            onclick="pilihTema('${k}')">${nama}${L < min ? ' 🔒 Lv' + min : ''}</button>`).join('');
  const lencana = LENCANA.map(([ikon, nama, syarat, cek]) => `
    <div class="box lencana ${cek() ? 'on' : ''}"><big>${ikon}</big>
      <b style="color:var(--tx)">${nama}</b><br>${syarat}</div>`).join('');

  return `<div class="box"><big>Level ${L}</big>
      <div class="bar"><i style="width:${(S.xp - a) / (b - a) * 100}%"></i></div>
      <div class="mu">${S.xp} ⚡ energi · ${b - S.xp} lagi ke level ${L + 1}.
        Dapat energi dari tiap ulasan (Lagi +1, Bagus +5, Mudah +8) dan +20 saat sesi harian tuntas.</div></div>
    <h3>Tema</h3><div class="row" style="flex-wrap:wrap">${tema}</div>
    <h3>Lencana</h3><div class="grid">${lencana}</div>`;
}

function pilihTema(k) { S.theme = k; simpan(); render(); }

// ---------- TAMPILAN ----------
const tampilan = {
  decks:   tampilDek,
  edit:    tampilEdit,
  study:   tampilBelajar,
  stats:   tampilStats,
  profile: tampilProfil
};

function render() {
  const t = TEMA.find(x => x[0] === S.theme) || TEMA[0];
  document.documentElement.style.setProperty('--ac', t[3]);   // terapkan warna tema
  $('#chip').textContent = 'Lv ' + level() + ' · ' + S.xp + ' ⚡';
  $('#app').innerHTML = tampilan[layar]();
  document.querySelectorAll('nav button').forEach(b =>
    b.classList.toggle('on', b.dataset.s === layar ||
      (b.dataset.s === 'decks' && ['edit', 'study'].includes(layar))));
}

document.querySelectorAll('nav button').forEach(b =>
  b.onclick = () => { layar = b.dataset.s; siapHapus = null; render(); });

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');