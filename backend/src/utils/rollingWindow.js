// === HELPER FUNCTIONS (Rolling Window) ===
// Membuat struktur data rolling window untuk kalkulasi indikator teknikal.
export function createRollingWindow(size) {
  // Simpan data dalam array berukuran tetap.
  const data = new Array(size);
  // Menyimpan total nilai agar getAverage lebih cepat.
  let sum = 0;
  // Penunjuk posisi tulis saat ini (circular index).
  let index = 0;
  // Menandai apakah window sudah terisi penuh.
  let filled = false;
  // Jumlah data valid yang saat ini tersimpan.
  let count = 0;

  return {
    add(value) {
      // Jika penuh, kurangi dulu nilai lama yang akan tertimpa.
      if (filled) {
        sum -= data[index];
      } else if (index === size - 1) {
        filled = true;
      }

      // Tulis nilai baru ke slot index saat ini.
      data[index] = value;
      sum += value;
      count = filled ? size : index + 1;
      // Geser index secara melingkar.
      index = (index + 1) % size;
    },

    // Hitung rata-rata nilai yang ada di window.
    getAverage() {
      return count > 0 ? sum / count : null;
    },

    // Ambil isi window dalam urutan waktu lama -> baru.
    getArray() {
      if (!filled) {
        return data.slice(0, count);
      }
      const result = new Array(size);
      for (let i = 0; i < size; i++) {
        result[i] = data[(index + i) % size];
      }
      return result;
    },

    // Ambil nilai maksimum dari isi window saat ini.
    getMax() {
      if (count === 0) return null;
      let max = data[0];
      for (let i = 1; i < count; i++) {
        const val = filled ? data[(index + i) % size] : data[i];
        if (val > max) max = val;
      }
      return max;
    },

    // Ambil nilai minimum dari isi window saat ini.
    getMin() {
      if (count === 0) return null;
      let min = data[0];
      for (let i = 1; i < count; i++) {
        const val = filled ? data[(index + i) % size] : data[i];
        if (val < min) min = val;
      }
      return min;
    },

    // Cek apakah kapasitas window sudah penuh.
    isFull() {
      return filled;
    },

    // Ambil jumlah elemen valid dalam window.
    getCount() {
      return count;
    },
  };
}
