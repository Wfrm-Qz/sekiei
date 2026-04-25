/**
 * 係数入力欄の増減規則をまとめる helper。
 *
 * 面一覧テーブルのスピンボタンと数値入力は UI 操作なので、
 * 色生成とは切り離して `ui` 層へ置く。
 */

/** 係数入力の増減で使う丸め精度をそろえる。 */
export function roundCoefficientValue(value: number) {
  return Math.round(value * 100) / 100;
}

/** 係数スピンボタン用の次値を返す。 */
export function getNextCoefficientValue(
  currentValue: number,
  direction: number,
) {
  const value = Math.max(0, Number(currentValue) || 0);
  if (direction > 0) {
    if (value < 1) {
      return roundCoefficientValue(value + 0.01);
    }
    if (value === 1) {
      return 1.1;
    }
    if (value <= 1.1) {
      return roundCoefficientValue(value + 0.1);
    }
    return roundCoefficientValue(value + 0.1);
  }

  if (value < 1) {
    return roundCoefficientValue(Math.max(0, value - 0.01));
  }
  if (value === 1) {
    return 0.99;
  }
  if (value <= 1.1) {
    return 1;
  }
  return roundCoefficientValue(Math.max(0, value - 0.1));
}
