import * as THREE from "three";
import { usesFourAxisMiller } from "../constants.js";

const EPSILON = 1e-9;

/**
 * 双晶則の軸 / 面指数を、実際の 3D 方向ベクトルや変換行列へ変換する。
 *
 * 現在の builder では「面法線」「軸方向」「反転行列」「回転行列」が必要になるため、
 * 結晶系依存の基底変換をここへ集約している。
 */

/** degree を radian へ変換する。 */
function degToRad(value) {
  return THREE.MathUtils.degToRad(Number(value));
}

/**
 * 軸長と軸角から direct basis を作る。
 *
 * 出力の a,b,c は実空間ベクトルで、以後の面法線計算や軸線表示の基礎になる。
 */
export function buildDirectBasis(axes, angles) {
  const alpha = degToRad(angles.alpha);
  const beta = degToRad(angles.beta);
  const gamma = degToRad(angles.gamma);

  const a = new THREE.Vector3(Number(axes.a), 0, 0);
  const b = new THREE.Vector3(
    Number(axes.b) * Math.cos(gamma),
    Number(axes.b) * Math.sin(gamma),
    0,
  );

  const cx = Number(axes.c) * Math.cos(beta);
  const sinGamma = Math.sin(gamma);
  const cy =
    Number(axes.c) *
    ((Math.cos(alpha) - Math.cos(beta) * Math.cos(gamma)) / sinGamma);
  const czSquared = Number(axes.c) ** 2 - cx ** 2 - cy ** 2;
  const c = new THREE.Vector3(cx, cy, Math.sqrt(Math.max(0, czSquared)));

  return { a, b, c };
}

/** direct basis から reciprocal basis を作る。面法線計算で使う。 */
export function buildReciprocalBasis(directBasis) {
  const volume = directBasis.a.dot(
    new THREE.Vector3().crossVectors(directBasis.b, directBasis.c),
  );
  return {
    aStar: new THREE.Vector3()
      .crossVectors(directBasis.b, directBasis.c)
      .divideScalar(volume),
    bStar: new THREE.Vector3()
      .crossVectors(directBasis.c, directBasis.a)
      .divideScalar(volume),
    cStar: new THREE.Vector3()
      .crossVectors(directBasis.a, directBasis.b)
      .divideScalar(volume),
  };
}

/** 六方 / 三方の 4 指数計算で使う direct / reciprocal 軸セットを組み立てる。 */
function buildFourAxisSets(parameters) {
  const directBasis = buildDirectBasis(parameters.axes, parameters.angles);
  const reciprocalBasis = buildReciprocalBasis(directBasis);
  const a1 = directBasis.a.clone();
  const a2 = directBasis.b.clone();
  const a3 = directBasis.a.clone().add(directBasis.b).multiplyScalar(-1);
  const a1Star = reciprocalBasis.aStar.clone();
  const a2Star = reciprocalBasis.bStar.clone();
  const a3Star = reciprocalBasis.aStar
    .clone()
    .add(reciprocalBasis.bStar)
    .multiplyScalar(-1);

  return {
    directBasis,
    reciprocalBasis,
    directAxes: { a1, a2, a3, c: directBasis.c.clone() },
    reciprocalAxes: {
      a1Star,
      a2Star,
      a3Star,
      cStar: reciprocalBasis.cStar.clone(),
    },
  };
}

/** 双晶面指数から、正規化前の reciprocal 空間法線ベクトルを求める。 */
function twinPlaneNormalVector(indexes, parameters) {
  const { reciprocalBasis, reciprocalAxes } = buildFourAxisSets(parameters);
  if (usesFourAxisMiller(parameters.crystalSystem)) {
    return reciprocalAxes.a1Star
      .clone()
      .multiplyScalar(Number(indexes.h))
      .add(reciprocalAxes.a2Star.clone().multiplyScalar(Number(indexes.k)))
      .add(reciprocalAxes.a3Star.clone().multiplyScalar(Number(indexes.i)))
      .add(reciprocalAxes.cStar.clone().multiplyScalar(Number(indexes.l)));
  }

  return reciprocalBasis.aStar
    .clone()
    .multiplyScalar(Number(indexes.h))
    .add(reciprocalBasis.bStar.clone().multiplyScalar(Number(indexes.k)))
    .add(reciprocalBasis.cStar.clone().multiplyScalar(Number(indexes.l)));
}

/** 双晶軸指数から、正規化前の direct 空間軸ベクトルを求める。 */
function twinAxisVector(indexes, parameters) {
  const { directBasis, directAxes } = buildFourAxisSets(parameters);
  if (usesFourAxisMiller(parameters.crystalSystem)) {
    return directAxes.a1
      .clone()
      .multiplyScalar(Number(indexes.h))
      .add(directAxes.a2.clone().multiplyScalar(Number(indexes.k)))
      .add(directAxes.a3.clone().multiplyScalar(Number(indexes.i)))
      .add(directAxes.c.clone().multiplyScalar(Number(indexes.l)));
  }

  return directBasis.a
    .clone()
    .multiplyScalar(Number(indexes.h))
    .add(directBasis.b.clone().multiplyScalar(Number(indexes.k)))
    .add(directBasis.c.clone().multiplyScalar(Number(indexes.l)));
}

/**
 * 結晶形状の面生成と同じ plane equation で、distance 1 の面法線を返す。
 *
 * 四指数系でも現在の面生成は h/k/l と reciprocal basis から plane を作るため、
 * offset 基準長も同じ面生成モデルへ揃える。
 */
function distanceOneFaceNormalVector(indexes, parameters) {
  const { reciprocalBasis } = buildFourAxisSets(parameters);
  return reciprocalBasis.aStar
    .clone()
    .multiplyScalar(Number(indexes.h))
    .add(reciprocalBasis.bStar.clone().multiplyScalar(Number(indexes.k)))
    .add(reciprocalBasis.cStar.clone().multiplyScalar(Number(indexes.l)));
}

/**
 * 双晶面指数から、実空間での法線ベクトルを求める。
 *
 * 四軸系では a1/a2/a3/c の reciprocal 軸を合成する。
 */
export function twinPlaneNormal(indexes, parameters) {
  return twinPlaneNormalVector(indexes, parameters).normalize();
}

/**
 * 双晶軸指数から、実空間での方向ベクトルを求める。
 *
 * 四軸系では a1/a2/a3/c の direct 軸を合成する。
 */
export function twinAxisDirection(indexes, parameters) {
  return twinAxisVector(indexes, parameters).normalize();
}

/**
 * `amount = 1` の基準長を返す。
 *
 * 双晶軸と同じ指数で distance 1 の面を仮想的に置き、双晶軸の正方向
 * との交点までの軸上距離を基準にする。実際の offset はこの値へ amount を掛ける。
 */
export function twinAxisPlaneInterceptLength(indexes, parameters) {
  const axis = twinAxisVector(indexes, parameters);
  const normal = distanceOneFaceNormalVector(indexes, parameters);
  if (
    !Number.isFinite(axis.lengthSq()) ||
    !Number.isFinite(normal.lengthSq()) ||
    axis.lengthSq() <= EPSILON ||
    normal.lengthSq() <= EPSILON
  ) {
    return 0;
  }

  const dot = normal.dot(axis.clone().normalize());
  if (!Number.isFinite(dot) || Math.abs(dot) <= EPSILON) {
    return 0;
  }
  return 1 / Math.abs(dot);
}

/** 面法線に対する鏡映行列を作る。 */
export function createReflectionMatrix(normal) {
  const unitNormal = normal.clone().normalize();
  const nx = unitNormal.x;
  const ny = unitNormal.y;
  const nz = unitNormal.z;

  return new THREE.Matrix4().set(
    1 - 2 * nx * nx,
    -2 * nx * ny,
    -2 * nx * nz,
    0,
    -2 * ny * nx,
    1 - 2 * ny * ny,
    -2 * ny * nz,
    0,
    -2 * nz * nx,
    -2 * nz * ny,
    1 - 2 * nz * nz,
    0,
    0,
    0,
    0,
    1,
  );
}

/** 軸と角度から回転行列を作る。 */
export function createRotationMatrix(axis, angleDeg) {
  return new THREE.Matrix4().makeRotationAxis(
    axis.clone().normalize(),
    degToRad(angleDeg),
  );
}
