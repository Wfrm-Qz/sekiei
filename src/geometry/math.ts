/**
 * 幾何計算で使う最小限のベクトル演算をまとめる。
 *
 * Three.js へ依存させたくない前処理や validation で使うため、
 * object ベースの軽量な math helper として切り出している。
 */
export const EPSILON = 1e-8;

/** 度数法をラジアンへ変換する。 */
export function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

/** x,y,z を持つ簡易ベクトル object を作る。 */
export function vec(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

/** ベクトル和を返す。 */
export function add(a, b) {
  return vec(a.x + b.x, a.y + b.y, a.z + b.z);
}

/** ベクトル差を返す。 */
export function subtract(a, b) {
  return vec(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** ベクトルをスカラー倍する。 */
export function scale(v, factor) {
  return vec(v.x * factor, v.y * factor, v.z * factor);
}

/** 内積を返す。 */
export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** 外積を返す。 */
export function cross(a, b) {
  return vec(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

/** ベクトル長を返す。 */
export function magnitude(v) {
  return Math.sqrt(dot(v, v));
}

/** ベクトルを正規化する。極小長ならゼロベクトルへ退避する。 */
export function normalize(v) {
  const length = magnitude(v);
  if (length < EPSILON) {
    return vec(0, 0, 0);
  }
  return scale(v, 1 / length);
}

/** 3x3 行列の行列式を返す。 */
export function determinant3x3(rows) {
  const [[a, b, c], [d, e, f], [g, h, i]] = rows;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

/**
 * 3x3 線形方程式をクラメルの公式で解く。
 *
 * 退化行列の場合は `null` を返し、呼び出し側に幾何不正として扱わせる。
 */
export function solve3x3(rows, rhs) {
  const det = determinant3x3(rows);
  if (Math.abs(det) < EPSILON) {
    return null;
  }

  const x =
    determinant3x3([
      [rhs[0], rows[0][1], rows[0][2]],
      [rhs[1], rows[1][1], rows[1][2]],
      [rhs[2], rows[2][1], rows[2][2]],
    ]) / det;
  const y =
    determinant3x3([
      [rows[0][0], rhs[0], rows[0][2]],
      [rows[1][0], rhs[1], rows[1][2]],
      [rows[2][0], rhs[2], rows[2][2]],
    ]) / det;
  const z =
    determinant3x3([
      [rows[0][0], rows[0][1], rhs[0]],
      [rows[1][0], rows[1][1], rhs[1]],
      [rows[2][0], rows[2][1], rhs[2]],
    ]) / det;

  return vec(x, y, z);
}

/** 点群の重心を返す。 */
export function centroid(points) {
  const total = points.reduce((sum, point) => add(sum, point), vec(0, 0, 0));
  return scale(total, 1 / points.length);
}
