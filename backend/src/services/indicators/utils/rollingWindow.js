// === HELPER FUNCTIONS (Rolling Window) ===
export function createRollingWindow(size) {
  const data = new Array(size);
  let sum = 0;
  let index = 0;
  let filled = false;
  let count = 0;

  return {
    add(value) {
      if (filled) {
        sum -= data[index];
      } else if (index === size - 1) {
        filled = true;
      }

      data[index] = value;
      sum += value;
      count = filled ? size : index + 1;
      index = (index + 1) % size;
    },

    getAverage() {
      return count > 0 ? sum / count : null;
    },

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

    getMax() {
      if (count === 0) return null;
      let max = data[0];
      for (let i = 1; i < count; i++) {
        const val = filled ? data[(index + i) % size] : data[i];
        if (val > max) max = val;
      }
      return max;
    },

    getMin() {
      if (count === 0) return null;
      let min = data[0];
      for (let i = 1; i < count; i++) {
        const val = filled ? data[(index + i) % size] : data[i];
        if (val < min) min = val;
      }
      return min;
    },

    isFull() {
      return filled;
    },

    getCount() {
      return count;
    },
  };
}
