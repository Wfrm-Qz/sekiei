import * as THREE from "three";
import {
  buildCrystalMeshData,
  buildCrystalStlCompositeMeshData,
} from "../geometry/crystalGeometry.js";
import { t } from "../i18n.js";
import { buildThreeGeometry } from "../io/exporters.js";
import { createDefaultTwinParameters } from "./parameters.js";
import { unionMeshDataWithJscad } from "./jscadCsg.js";
import {
  createReflectionMatrix,
  createRotationMatrix,
  twinAxisDirection,
  twinAxisPlaneInterceptLength,
  twinPlaneNormal,
} from "./crystalFrame.js";
import { resolveContactReferenceAxisDirection } from "./contactReferenceAxis.js";
import { getTwinAxisOffsetAmount } from "./penetrationOffsets.js";

/**
 * 双晶の複数結晶を配置し、必要なら CSG 和集合して preview / export 用 meshData を返す。
 *
 * 貫入双晶と接触双晶で配置ロジックが大きく異なるため、
 * 変換行列作成・接触面合わせ・fallback・validation 集約をここで一元管理している。
 *
 * 主に扱う日本語文言:
 * - [和集合診断]
 * - 双晶軸 / 双晶面 / 接触面の計算失敗
 * - 一部の結晶は閉じた立体を生成できなかったため...
 */

/** 双晶 build 中に集めるエラー / 警告入れ物を作る。 */
function createValidation() {
  return { errors: [], warnings: [] };
}

/** 子 build の validation を親 validation へマージする。 */
function mergeValidation(target, source) {
  target.errors.push(...(source?.errors ?? []));
  target.warnings.push(...(source?.warnings ?? []));
}

/** 和集合まわりの診断文を validation warning として積む。 */
function pushUnionDiagnostic(validation, message) {
  validation.warnings.push(t("builder.unionDiagnostic", { message }));
}

/** console 上の和集合診断ログ。SVG / preview 切り分け時に使う。 */
function logUnionDiagnostic(stage, payload) {
  console.warn(`[Twin Union] ${stage}`, payload);
}

/** 面上テキストを除いた parameter clone を作る。CSG 安定化のために使う。 */
function cloneParametersWithoutText(parameters) {
  const cloned = structuredClone(parameters);
  cloned.faces = cloned.faces.map((face) => ({
    ...face,
    text: {
      ...(face.text ?? {}),
      content: "",
      depth: 0,
    },
  }));
  return cloned;
}

/** face 配列だけを対象に、面上テキスト内容を無効化する。 */
function stripFaceText(faces) {
  return faces.map((face) => ({
    ...face,
    text: {
      ...(face.text ?? {}),
      content: "",
      depth: 0,
    },
  }));
}

/** 双晶内の指定結晶が使う face 配列を返す。 */
function getTwinCrystalFaces(parameters, crystalIndex) {
  if (crystalIndex === 0) {
    return parameters.twin?.crystals?.[0]?.faces ?? parameters.faces;
  }
  return parameters.twin?.crystals?.[crystalIndex]?.faces ?? parameters.faces;
}

/** 指定 crystal が non-empty な face text を持つかを返す。 */
function crystalHasFaceText(parameters, crystalIndex) {
  return getTwinCrystalFaces(parameters, crystalIndex).some(
    (face) => String(face?.text?.content ?? "").trim().length > 0,
  );
}

/**
 * 双晶内の 1 結晶分だけを単結晶 builder に流せる parameter object に変換する。
 *
 * `shouldStripText` は CSG 安定化のための暫定措置で、刻印文字を除いて立体を先に作るためにある。
 */
function buildCrystalParametersForTwin(
  parameters,
  crystalIndex,
  shouldStripText,
) {
  const source = shouldStripText
    ? cloneParametersWithoutText(parameters)
    : structuredClone(parameters);
  const faces = shouldStripText
    ? stripFaceText(
        structuredClone(getTwinCrystalFaces(parameters, crystalIndex)),
      )
    : structuredClone(getTwinCrystalFaces(parameters, crystalIndex));
  source.mode = "twin";
  source.twin = {
    ...structuredClone(parameters.twin),
    enabled: false,
  };
  source.faces = faces;
  return source;
}

/** 面 1 枚分の頂点と法線を行列変換する。 */
function transformFace(face, matrix, normalMatrix) {
  const vertices = face.vertices.map((vertex) =>
    new THREE.Vector3(vertex.x, vertex.y, vertex.z).applyMatrix4(matrix),
  );
  const normal = new THREE.Vector3(face.normal.x, face.normal.y, face.normal.z)
    .applyMatrix3(normalMatrix)
    .normalize();

  return {
    ...face,
    vertices: vertices.map((vertex) => ({
      x: vertex.x,
      y: vertex.y,
      z: vertex.z,
    })),
    normal: { x: normal.x, y: normal.y, z: normal.z },
  };
}

/** meshData 全体へ行列変換を適用する。preview helper も合わせて更新する。 */
function transformMeshData(meshData, matrix) {
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const positions = [];

  for (let index = 0; index < meshData.positions.length; index += 3) {
    const point = new THREE.Vector3(
      meshData.positions[index],
      meshData.positions[index + 1],
      meshData.positions[index + 2],
    ).applyMatrix4(matrix);
    positions.push(point.x, point.y, point.z);
  }

  return {
    ...meshData,
    positions,
    vertices: (meshData.vertices ?? []).map((vertex) => {
      const point = new THREE.Vector3(
        vertex.x,
        vertex.y,
        vertex.z,
      ).applyMatrix4(matrix);
      return { x: point.x, y: point.y, z: point.z };
    }),
    axisGuides: (meshData.axisGuides ?? []).map((axis) => {
      const start = new THREE.Vector3(
        axis.start.x,
        axis.start.y,
        axis.start.z,
      ).applyMatrix4(matrix);
      const end = new THREE.Vector3(
        axis.end.x,
        axis.end.y,
        axis.end.z,
      ).applyMatrix4(matrix);
      return {
        ...axis,
        start: { x: start.x, y: start.y, z: start.z },
        end: { x: end.x, y: end.y, z: end.z },
      };
    }),
    faces: (meshData.faces ?? []).map((face) =>
      transformFace(face, matrix, normalMatrix),
    ),
  };
}

/** 面頂点の重心を返す。接触双晶の位置合わせに使う。 */
function faceCenter(face) {
  const sum = face.vertices.reduce(
    (accumulator, vertex) =>
      accumulator.add(new THREE.Vector3(vertex.x, vertex.y, vertex.z)),
    new THREE.Vector3(),
  );
  return sum.divideScalar(Math.max(face.vertices.length, 1));
}

/** axis guide 群から、候補ラベル順に最初に見つかる方向を返す。 */
function axisDirectionFromGuides(axisGuides, labels) {
  for (const label of labels) {
    const direction = resolveContactReferenceAxisDirection(axisGuides, label);
    if (direction) {
      return direction;
    }
  }
  return null;
}

/**
 * 接触面内での基準方向ベクトルを決める。
 *
 * まず user 指定の `preferredAxisLabel` を試し、無効なら `c -> b/a2 -> a/a1 -> a3`
 * の順で fallback する。
 */
function buildFaceReferenceVector(
  meshData,
  faceNormal,
  preferredAxisLabel = null,
) {
  if (preferredAxisLabel) {
    const preferredDirection = resolveContactReferenceAxisDirection(
      meshData.axisGuides,
      preferredAxisLabel,
    );
    if (preferredDirection) {
      const projected = preferredDirection.clone().projectOnPlane(faceNormal);
      if (projected.lengthSq() > 1e-8) {
        return projected.normalize();
      }
    }
  }

  const referenceCandidates = [["c"], ["b", "a2"], ["a", "a1"], ["a3"]];

  for (const labels of referenceCandidates) {
    const axisDirection = axisDirectionFromGuides(meshData.axisGuides, labels);
    if (!axisDirection) {
      continue;
    }
    const projected = axisDirection.clone().projectOnPlane(faceNormal);
    if (projected.lengthSq() > 1e-8) {
      return projected.normalize();
    }
  }

  return null;
}

/**
 * 接触双晶の面内回転を追加で合わせる。
 *
 * 法線合わせだけでは接触面上で自由回転が残るため、基準方向ベクトル同士が揃うよう
 * 面法線まわりに twist をかける。
 */
function applyContactRollAlignment(
  baseMeshData,
  alignedMeshData,
  baseFace,
  derivedFace,
  alignQuaternion,
) {
  const baseNormal = new THREE.Vector3(
    baseFace.normal.x,
    baseFace.normal.y,
    baseFace.normal.z,
  ).normalize();
  const alignedDerivedNormal = new THREE.Vector3(
    derivedFace.normal.x,
    derivedFace.normal.y,
    derivedFace.normal.z,
  )
    .applyQuaternion(alignQuaternion)
    .normalize();
  const baseReference = buildFaceReferenceVector(baseMeshData, baseNormal);
  const derivedReferenceSource = buildFaceReferenceVector(
    alignedMeshData,
    alignedDerivedNormal,
    derivedFace?.contactReferenceAxisLabel ?? null,
  );

  if (!baseReference || !derivedReferenceSource) {
    return alignedMeshData;
  }

  const derivedReference = derivedReferenceSource
    .clone()
    .projectOnPlane(baseNormal)
    .normalize();
  if (derivedReference.lengthSq() === 0) {
    return alignedMeshData;
  }

  const signedAngle = Math.atan2(
    baseNormal.dot(
      new THREE.Vector3().crossVectors(derivedReference, baseReference),
    ),
    THREE.MathUtils.clamp(derivedReference.dot(baseReference), -1, 1),
  );

  if (Math.abs(signedAngle) <= 1e-8) {
    return alignedMeshData;
  }

  const twistMatrix = new THREE.Matrix4().makeRotationAxis(
    baseNormal,
    signedAngle,
  );
  return transformMeshData(alignedMeshData, twistMatrix);
}

/**
 * 結晶 1 個に対して双晶則行列を作る。
 *
 * 接触双晶は事前反転を使わず identity にし、接触面合わせ側で剛体配置する。
 * ここは過去に不具合が出た箇所なので意図を明示しておく。
 */
function buildRuleMatrixForCrystal(parameters, crystal, validation) {
  try {
    if (crystal?.twinType === "contact") {
      // 接触双晶は、選択された接触面どうしを合わせて配置する。
      // ここで双晶面反転を先に掛けると、面合わせ結果が不安定になるため行わない。
      return new THREE.Matrix4().identity();
    }

    const ruleType = crystal?.ruleType ?? "axis";
    if (ruleType === "axis") {
      const axis = twinAxisDirection(
        crystal?.axis ?? parameters.twin.axis,
        parameters,
      );
      if (!Number.isFinite(axis.lengthSq()) || axis.lengthSq() === 0) {
        validation.errors.push(t("builder.error.invalidAxisVector"));
        return new THREE.Matrix4().identity();
      }
      return createRotationMatrix(
        axis,
        crystal?.rotationAngleDeg ?? parameters.twin.rotationAngleDeg,
      );
    }

    const normal = twinPlaneNormal(
      crystal?.plane ?? parameters.twin.plane,
      parameters,
    );
    if (!Number.isFinite(normal.lengthSq()) || normal.lengthSq() === 0) {
      validation.errors.push(t("builder.error.invalidPlaneNormal"));
      return new THREE.Matrix4().identity();
    }
    return createReflectionMatrix(normal);
  } catch (error) {
    validation.errors.push(
      t("builder.error.ruleMatrixFailed", { message: error.message }),
    );
    return new THREE.Matrix4().identity();
  }
}

/**
 * 貫入双晶の軸方向 offset を平行移動ベクトルに変換する。
 *
 * `amount = 1` は、双晶軸と同じ指数で coefficient 1 の面が双晶軸正方向と
 * 交わる点までの距離。amount はこの基準長に対して線形に効く。
 */
function buildPenetrationAxisOffsetVector(parameters, crystal, validation) {
  const amount = getTwinAxisOffsetAmount(crystal);
  if (Math.abs(amount) < 1e-12) {
    return new THREE.Vector3();
  }

  const axisRule = crystal?.axis ?? parameters.twin.axis;
  const direction = twinAxisDirection(axisRule, parameters);
  const basisLength = twinAxisPlaneInterceptLength(axisRule, parameters);
  if (
    !Number.isFinite(direction.lengthSq()) ||
    direction.lengthSq() === 0 ||
    !Number.isFinite(basisLength) ||
    basisLength === 0
  ) {
    validation.errors.push(t("builder.error.invalidAxisVector"));
    return new THREE.Vector3();
  }

  return direction.normalize().multiplyScalar(basisLength * amount);
}

/**
 * 接触双晶の派生結晶を、指定した 2 面が向かい合うように回転・平行移動する。
 *
 * 手順:
 * 1. 面法線を正対させる
 * 2. 面内基準方向を揃える
 * 3. 面重心を一致させる
 */
function alignDerivedForContact(
  baseMeshData,
  derivedMeshData,
  baseFaces,
  derivedFaces,
  crystal,
  validation,
  crystalIndex,
) {
  const baseSourceFace = baseFaces.find(
    (face) => face.id === crystal?.contact?.baseFaceRef,
  );
  const derivedSourceFace = derivedFaces.find(
    (face) => face.id === crystal?.contact?.derivedFaceRef,
  );
  const baseFace = baseMeshData.faces.find(
    (face) => face.id === baseSourceFace?.id,
  );
  const derivedFace = derivedMeshData.faces.find(
    (face) => face.id === derivedSourceFace?.id,
  );

  if (!baseFace || !derivedFace) {
    validation.errors.push(
      t("builder.error.contactFaceMissing", { index: crystalIndex + 1 }),
    );
    return derivedMeshData;
  }

  const baseNormal = new THREE.Vector3(
    baseFace.normal.x,
    baseFace.normal.y,
    baseFace.normal.z,
  ).normalize();
  const derivedNormal = new THREE.Vector3(
    derivedFace.normal.x,
    derivedFace.normal.y,
    derivedFace.normal.z,
  ).normalize();
  const alignQuaternion = new THREE.Quaternion().setFromUnitVectors(
    derivedNormal,
    baseNormal.clone().negate(),
  );
  const alignMatrix = new THREE.Matrix4().makeRotationFromQuaternion(
    alignQuaternion,
  );
  let alignedMeshData = transformMeshData(derivedMeshData, alignMatrix);
  const derivedFaceWithReference = {
    ...derivedFace,
    contactReferenceAxisLabel: crystal?.contact?.referenceAxisLabel ?? null,
  };
  alignedMeshData = applyContactRollAlignment(
    baseMeshData,
    alignedMeshData,
    baseFace,
    derivedFaceWithReference,
    alignQuaternion,
  );
  const alignedFace = alignedMeshData.faces.find(
    (face) => face.id === derivedFace.id,
  );

  if (!alignedFace) {
    validation.errors.push(
      t("builder.error.contactFaceTracking", { index: crystalIndex + 1 }),
    );
    return derivedMeshData;
  }

  const translation = faceCenter(baseFace).sub(faceCenter(alignedFace));
  const translationMatrix = new THREE.Matrix4().makeTranslation(
    translation.x,
    translation.y,
    translation.z,
  );
  alignedMeshData = transformMeshData(alignedMeshData, translationMatrix);

  const finalFace = alignedMeshData.faces.find(
    (face) => face.id === derivedFace.id,
  );
  if (finalFace) {
    const finalNormal = new THREE.Vector3(
      finalFace.normal.x,
      finalFace.normal.y,
      finalFace.normal.z,
    ).normalize();
    if (finalNormal.dot(baseNormal) > -0.94) {
      validation.warnings.push(
        t("builder.warning.contactAlignFallback", {
          index: crystalIndex + 1,
        }),
      );
    } else {
      validation.warnings.push(
        t("builder.warning.contactCentroidFallback", {
          index: crystalIndex + 1,
        }),
      );
    }
  }

  return alignedMeshData;
}

/** geometry を原点基準スケールで更新する。 */
function scaleGeometryInPlace(geometry, scaleFactor) {
  geometry.scale(scaleFactor, scaleFactor, scaleFactor);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** geometry 全体を平行移動する。 */
function translateGeometryInPlace(geometry, offset) {
  geometry.translate(offset.x, offset.y, offset.z);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** meshData の座標群をまとめて平行移動する。 */
function translateMeshData(meshData, offset) {
  return {
    ...meshData,
    positions: meshData.positions.flatMap((value, index) => {
      const axisIndex = index % 3;
      if (axisIndex === 0) {
        return value + offset.x;
      }
      if (axisIndex === 1) {
        return value + offset.y;
      }
      return value + offset.z;
    }),
    vertices: (meshData.vertices ?? []).map((vertex) => ({
      x: vertex.x + offset.x,
      y: vertex.y + offset.y,
      z: vertex.z + offset.z,
    })),
    faces: (meshData.faces ?? []).map((face) => ({
      ...face,
      vertices: (face.vertices ?? []).map((vertex) => ({
        x: vertex.x + offset.x,
        y: vertex.y + offset.y,
        z: vertex.z + offset.z,
      })),
    })),
    axisGuides: (meshData.axisGuides ?? []).map((axis) => ({
      ...axis,
      start: {
        x: axis.start.x + offset.x,
        y: axis.start.y + offset.y,
        z: axis.start.z + offset.z,
      },
      end: {
        x: axis.end.x + offset.x,
        y: axis.end.y + offset.y,
        z: axis.end.z + offset.z,
      },
    })),
  };
}

/** axis guide の start/end も meshData と同じ比率でスケールする。 */
function scaleAxisGuides(meshData, scaleFactor) {
  if (!meshData || !Array.isArray(meshData.axisGuides) || scaleFactor === 1) {
    return meshData;
  }

  return {
    ...meshData,
    axisGuides: meshData.axisGuides.map((axis) => {
      const start = new THREE.Vector3(axis.start.x, axis.start.y, axis.start.z);
      const end = new THREE.Vector3(axis.end.x, axis.end.y, axis.end.z);
      const center = start.clone().add(end).multiplyScalar(0.5);
      const halfDelta = end
        .clone()
        .sub(start)
        .multiplyScalar(0.5 * scaleFactor);
      return {
        ...axis,
        start: {
          x: center.x - halfDelta.x,
          y: center.y - halfDelta.y,
          z: center.z - halfDelta.z,
        },
        end: {
          x: center.x + halfDelta.x,
          y: center.y + halfDelta.y,
          z: center.z + halfDelta.z,
        },
      };
    }),
  };
}

/** 和集合後 geometry を原点中心へ戻すための offset を計算する。 */
function buildCenteringOffset(geometry) {
  geometry.computeBoundingBox();
  const center =
    geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
  return center.multiplyScalar(-1);
}

/** bounding 情報と法線を整え、最終 geometry として使える状態へする。 */
function finalizeGeometry(geometry) {
  const next = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  next.computeVertexNormals();
  next.computeBoundingBox();
  next.computeBoundingSphere();
  return next;
}

/** preview 用に複数 geometry を単純結合する。CSG fallback 表示で使う。 */
function mergePreviewGeometries(geometries) {
  const mergedPositions = [];

  for (const geometry of geometries.filter(Boolean)) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    const positionAttribute = source.getAttribute("position");
    if (!positionAttribute) {
      continue;
    }
    mergedPositions.push(...positionAttribute.array);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(mergedPositions, 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * CSG に失敗した場合の fallback build result を作る。
 *
 * ログでの切り分けと UI 継続を両立するため、「有効結晶だけ表示・書き出し」できる形で返す。
 */
function buildFallbackResult({
  baseMeshData,
  derivedMeshData,
  crystalMeshData = [],
  crystalStlCompositeMeshData = [],
  validation,
  sizeMm,
  warningMessage = null,
}) {
  const alignedCrystalMeshData =
    crystalMeshData.length > 0
      ? crystalMeshData
      : [baseMeshData, derivedMeshData];
  const crystalPreviewGeometries = alignedCrystalMeshData.map((meshData) =>
    meshData ? buildThreeGeometry(meshData) : null,
  );
  const crystalStlCompositeGeometries = crystalStlCompositeMeshData.map(
    (meshData) => (meshData ? buildThreeGeometry(meshData) : null),
  );
  const basePreviewGeometry = crystalPreviewGeometries[0] ?? null;
  const derivedPreviewGeometry = crystalPreviewGeometries[1] ?? null;
  const previewFinalGeometry = mergePreviewGeometries(
    crystalPreviewGeometries.filter(Boolean),
  );

  if (
    !previewFinalGeometry.getAttribute("position") ||
    previewFinalGeometry.getAttribute("position").count === 0
  ) {
    return {
      finalGeometry: null,
      previewFinalGeometry: null,
      basePreviewGeometry: null,
      derivedPreviewGeometry: null,
      crystalPreviewGeometries: [],
      crystalStlCompositeGeometries: [],
      basePreviewMeshData: null,
      derivedPreviewMeshData: null,
      crystalPreviewMeshData: [],
      crystalStlCompositeMeshData: [],
      validation,
      metrics: { vertexCount: 0, faceCount: 0, maxDimensionMm: null },
    };
  }

  const metricsBeforeScale = buildMetrics(previewFinalGeometry);
  const scaleFactor = metricsBeforeScale.maxDimensionMm
    ? Number(sizeMm) / metricsBeforeScale.maxDimensionMm
    : 1;

  const finalGeometry = previewFinalGeometry.clone();
  scaleGeometryInPlace(finalGeometry, scaleFactor);
  const previewCenteringOffset = buildCenteringOffset(previewFinalGeometry);
  translateGeometryInPlace(previewFinalGeometry, previewCenteringOffset);
  crystalPreviewGeometries
    .filter(Boolean)
    .forEach((geometry) =>
      translateGeometryInPlace(geometry, previewCenteringOffset),
    );
  crystalStlCompositeGeometries
    .filter(Boolean)
    .forEach((geometry) =>
      translateGeometryInPlace(geometry, previewCenteringOffset),
    );
  const finalCenteringOffset = buildCenteringOffset(finalGeometry);
  translateGeometryInPlace(finalGeometry, finalCenteringOffset);
  const translatedCrystalPreviewMeshData = alignedCrystalMeshData.map(
    (meshData) =>
      meshData
        ? scaleAxisGuides(
            translateMeshData(meshData, previewCenteringOffset),
            1.5,
          )
        : null,
  );
  const translatedCrystalStlCompositeMeshData = crystalStlCompositeMeshData.map(
    (meshData) =>
      meshData
        ? scaleAxisGuides(
            translateMeshData(meshData, previewCenteringOffset),
            1.5,
          )
        : null,
  );

  if (warningMessage) {
    validation.warnings.push(warningMessage);
  }

  return {
    finalGeometry,
    previewFinalGeometry,
    basePreviewGeometry,
    derivedPreviewGeometry,
    crystalPreviewGeometries,
    crystalStlCompositeGeometries,
    basePreviewMeshData: translatedCrystalPreviewMeshData[0] ?? null,
    derivedPreviewMeshData: translatedCrystalPreviewMeshData[1] ?? null,
    crystalPreviewMeshData: translatedCrystalPreviewMeshData,
    crystalStlCompositeMeshData: translatedCrystalStlCompositeMeshData,
    validation,
    metrics: buildMetrics(finalGeometry),
  };
}

/** geometry から頂点数・面数・最大寸法などの統計値を作る。 */
function buildMetrics(geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = new THREE.Vector3();
  box?.getSize(size);
  return {
    vertexCount: geometry.getAttribute("position")?.count ?? 0,
    faceCount: Math.trunc((geometry.getAttribute("position")?.count ?? 0) / 3),
    maxDimensionMm: size ? Math.max(size.x, size.y, size.z) : null,
  };
}

/**
 * 双晶 parameter から最終 build result を返す。
 *
 * 出力:
 * - 和集合済み geometry または fallback geometry
 * - 各結晶の配置済み meshData
 * - validation と診断情報
 *
 * 接触双晶 / 貫入双晶 / CSG fallback の分岐が集中する最上位関数。
 */
export function buildTwinMeshData(parameters, options = {}) {
  const resolveFaceTextFont = options.resolveFaceTextFont;
  const validation = createValidation();
  const crystalDefinitions =
    Array.isArray(parameters.twin?.crystals) &&
    parameters.twin.crystals.length > 0
      ? parameters.twin.crystals
      : createDefaultTwinParameters().twin.crystals;
  const activeCrystalCount = crystalDefinitions.filter(
    (crystal, index) => index === 0 || crystal?.enabled !== false,
  ).length;
  // 面上テキストは単結晶相当の経路では再度有効にする。
  // 複数結晶の CSG 和集合はまだ不安定なので、当面は twin build 時だけ strip を維持する。
  const shouldStripText = activeCrystalCount > 1;
  const shouldBuildTextPreviewMeshes =
    shouldStripText &&
    crystalDefinitions.some(
      (crystal, index) =>
        (index === 0 || crystal?.enabled !== false) &&
        crystalHasFaceText(parameters, index),
    );
  const shouldBuildStlCompositeMeshes = crystalDefinitions.some(
    (crystal, index) =>
      (index === 0 || crystal?.enabled !== false) &&
      crystalHasFaceText(parameters, index),
  );
  const crystalBuilds = [];

  crystalDefinitions.forEach((crystal, index) => {
    const crystalParameters = buildCrystalParametersForTwin(
      parameters,
      index,
      shouldStripText,
    );
    const crystalResult = buildCrystalMeshData(crystalParameters, {
      normalizeSize: false,
      resolveFaceTextFont,
    });
    const previewCrystalParameters = shouldBuildTextPreviewMeshes
      ? buildCrystalParametersForTwin(parameters, index, false)
      : null;
    const previewCrystalResult = previewCrystalParameters
      ? buildCrystalMeshData(previewCrystalParameters, {
          normalizeSize: false,
          resolveFaceTextFont,
        })
      : null;
    const stlCompositeCrystalResult = previewCrystalParameters
      ? buildCrystalStlCompositeMeshData(previewCrystalParameters, {
          normalizeSize: false,
          resolveFaceTextFont,
        })
      : shouldBuildStlCompositeMeshes
        ? buildCrystalStlCompositeMeshData(crystalParameters, {
            normalizeSize: false,
            resolveFaceTextFont,
          })
        : null;
    mergeValidation(validation, crystalResult.validation);
    if (previewCrystalResult) {
      mergeValidation(validation, previewCrystalResult.validation);
    }
    if (stlCompositeCrystalResult) {
      mergeValidation(validation, stlCompositeCrystalResult.validation);
    }
    if (!crystalResult.geometry) {
      pushUnionDiagnostic(
        validation,
        t("builder.error.crystalBuildFailed", { index: index + 1 }),
      );
      logUnionDiagnostic("crystal-build-failed", {
        crystalIndex: index,
        crystalId: crystal?.id ?? null,
        twinType: crystal?.twinType ?? null,
        errors: crystalResult.validation?.errors ?? [],
        warnings: crystalResult.validation?.warnings ?? [],
      });
    }
    crystalBuilds.push({
      crystal,
      parameters: crystalParameters,
      previewParameters: previewCrystalParameters,
      sourceMeshData: crystalResult.geometry ?? null,
      previewSourceMeshData: previewCrystalResult?.geometry ?? null,
      stlCompositeSourceMeshData: stlCompositeCrystalResult?.geometry ?? null,
      placedMeshData: null,
      previewPlacedMeshData: null,
      stlCompositePlacedMeshData: null,
      previewGeometry: null,
    });
  });

  if (!crystalBuilds.some((build) => build.sourceMeshData)) {
    return {
      finalGeometry: null,
      previewFinalGeometry: null,
      basePreviewGeometry: null,
      derivedPreviewGeometry: null,
      crystalPreviewGeometries: [],
      crystalStlCompositeGeometries: [],
      crystalPreviewMeshData: [],
      crystalStlCompositeMeshData: [],
      validation,
      metrics: { vertexCount: 0, faceCount: 0, maxDimensionMm: null },
    };
  }

  if (activeCrystalCount <= 1) {
    logUnionDiagnostic("skip-csg-single-crystal", { activeCrystalCount });
    const baseMeshData = crystalBuilds[0]?.sourceMeshData ?? null;
    return buildFallbackResult({
      baseMeshData,
      derivedMeshData: null,
      crystalMeshData: crystalBuilds.map((build, index) =>
        index === 0 || build?.crystal?.enabled !== false
          ? (build?.sourceMeshData ?? null)
          : null,
      ),
      crystalStlCompositeMeshData: crystalBuilds.map((build, index) =>
        index === 0 || build?.crystal?.enabled !== false
          ? (build?.stlCompositeSourceMeshData ?? null)
          : null,
      ),
      validation,
      sizeMm: parameters.sizeMm,
    });
  }

  crystalBuilds.forEach((build, index) => {
    if (!build.sourceMeshData) {
      return;
    }
    if (index === 0) {
      build.placedMeshData = build.sourceMeshData;
      build.previewPlacedMeshData =
        build.previewSourceMeshData ?? build.sourceMeshData;
      build.stlCompositePlacedMeshData =
        build.stlCompositeSourceMeshData ?? null;
      return;
    }
    if (build.crystal?.enabled === false) {
      return;
    }

    const parentIndex = Math.max(
      0,
      Math.min(Math.trunc(Number(build.crystal?.from ?? 0)), index - 1),
    );
    const parentBuild = crystalBuilds[parentIndex];
    if (!parentBuild?.placedMeshData) {
      validation.warnings.push(
        t("builder.warning.parentMissing", {
          index: index + 1,
          parentIndex: parentIndex + 1,
        }),
      );
      pushUnionDiagnostic(
        validation,
        t("builder.warning.parentDisabled", {
          index: index + 1,
          parentIndex: parentIndex + 1,
        }),
      );
      return;
    }

    const ruleMatrix = buildRuleMatrixForCrystal(
      parameters,
      build.crystal,
      validation,
    );
    let placedMeshData = transformMeshData(build.sourceMeshData, ruleMatrix);
    let previewPlacedMeshData = build.previewSourceMeshData
      ? transformMeshData(build.previewSourceMeshData, ruleMatrix)
      : placedMeshData;
    let stlCompositePlacedMeshData = build.stlCompositeSourceMeshData
      ? transformMeshData(build.stlCompositeSourceMeshData, ruleMatrix)
      : null;

    if (build.crystal?.twinType === "contact") {
      placedMeshData = alignDerivedForContact(
        parentBuild.placedMeshData,
        placedMeshData,
        parentBuild.parameters.faces,
        build.parameters.faces,
        build.crystal,
        validation,
        index,
      );
      previewPlacedMeshData = alignDerivedForContact(
        parentBuild.previewPlacedMeshData ?? parentBuild.placedMeshData,
        previewPlacedMeshData,
        parentBuild.previewParameters?.faces ?? parentBuild.parameters.faces,
        build.previewParameters?.faces ?? build.parameters.faces,
        build.crystal,
        validation,
        index,
      );
      if (stlCompositePlacedMeshData) {
        stlCompositePlacedMeshData = alignDerivedForContact(
          parentBuild.previewPlacedMeshData ?? parentBuild.placedMeshData,
          stlCompositePlacedMeshData,
          parentBuild.previewParameters?.faces ?? parentBuild.parameters.faces,
          build.previewParameters?.faces ?? build.parameters.faces,
          build.crystal,
          validation,
          index,
        );
      }
    } else {
      const offset = buildPenetrationAxisOffsetVector(
        parameters,
        build.crystal,
        validation,
      );
      if (offset.lengthSq() > 0) {
        placedMeshData = translateMeshData(placedMeshData, offset);
        previewPlacedMeshData = translateMeshData(
          previewPlacedMeshData,
          offset,
        );
        if (stlCompositePlacedMeshData) {
          stlCompositePlacedMeshData = translateMeshData(
            stlCompositePlacedMeshData,
            offset,
          );
        }
      }
    }

    build.placedMeshData = placedMeshData;
    build.previewPlacedMeshData = previewPlacedMeshData;
    build.stlCompositePlacedMeshData = stlCompositePlacedMeshData;
  });

  const validPlacedBuilds = crystalBuilds.filter(
    (build, index) =>
      (index === 0 || build.crystal?.enabled !== false) && build.placedMeshData,
  );
  if (validPlacedBuilds.length === 0 || validation.errors.length > 0) {
    pushUnionDiagnostic(
      validation,
      t("builder.error.csgAborted", {
        validPlacedBuilds: validPlacedBuilds.length,
        validationErrors: validation.errors.length,
      }),
    );
    logUnionDiagnostic("pre-csg-abort", {
      activeCrystalCount,
      validPlacedBuildCount: validPlacedBuilds.length,
      errors: validation.errors,
      warnings: validation.warnings,
      crystals: crystalBuilds.map((build, index) => ({
        crystalIndex: index,
        enabled: index === 0 ? true : build?.crystal?.enabled !== false,
        hasSourceMesh: Boolean(build?.sourceMeshData),
        hasPlacedMesh: Boolean(build?.placedMeshData),
        from: build?.crystal?.from ?? 0,
        twinType: build?.crystal?.twinType ?? null,
      })),
    });
    return buildFallbackResult({
      baseMeshData:
        crystalBuilds[0]?.previewPlacedMeshData ??
        crystalBuilds[0]?.placedMeshData ??
        crystalBuilds[0]?.previewSourceMeshData ??
        crystalBuilds[0]?.sourceMeshData ??
        null,
      derivedMeshData: null,
      crystalMeshData: crystalBuilds.map((build, index) =>
        index === 0 || build?.crystal?.enabled !== false
          ? (build?.previewPlacedMeshData ??
            build?.placedMeshData ??
            build?.previewSourceMeshData ??
            null)
          : null,
      ),
      validation,
      sizeMm: parameters.sizeMm,
      warningMessage: t("builder.warning.partialCrystalDisplay"),
    });
  }

  try {
    const previewFinalGeometry = finalizeGeometry(
      unionMeshDataWithJscad(
        validPlacedBuilds.map((build) => build.placedMeshData),
      ),
    );
    const metricsBeforeScale = buildMetrics(previewFinalGeometry);
    const scaleFactor = metricsBeforeScale.maxDimensionMm
      ? Number(parameters.sizeMm) / metricsBeforeScale.maxDimensionMm
      : 1;

    const finalGeometry = previewFinalGeometry.clone();
    scaleGeometryInPlace(finalGeometry, scaleFactor);
    const crystalPreviewGeometries = crystalBuilds.map((build, index) =>
      (index === 0 || build?.crystal?.enabled !== false) &&
      (build?.previewPlacedMeshData ?? build?.placedMeshData)
        ? buildThreeGeometry(
            build.previewPlacedMeshData ?? build.placedMeshData,
          )
        : null,
    );
    const crystalStlCompositeGeometries = crystalBuilds.map((build, index) =>
      (index === 0 || build?.crystal?.enabled !== false) &&
      build?.stlCompositePlacedMeshData
        ? buildThreeGeometry(build.stlCompositePlacedMeshData)
        : null,
    );
    const basePreviewGeometry = crystalPreviewGeometries[0] ?? null;
    const derivedPreviewGeometry = crystalPreviewGeometries[1] ?? null;
    const previewCenteringOffset = buildCenteringOffset(previewFinalGeometry);
    translateGeometryInPlace(previewFinalGeometry, previewCenteringOffset);
    crystalPreviewGeometries
      .filter(Boolean)
      .forEach((geometry) =>
        translateGeometryInPlace(geometry, previewCenteringOffset),
      );
    crystalStlCompositeGeometries
      .filter(Boolean)
      .forEach((geometry) =>
        translateGeometryInPlace(geometry, previewCenteringOffset),
      );
    const finalCenteringOffset = buildCenteringOffset(finalGeometry);
    translateGeometryInPlace(finalGeometry, finalCenteringOffset);
    const crystalPreviewMeshData = crystalBuilds.map((build, index) =>
      (index === 0 || build?.crystal?.enabled !== false) &&
      (build?.previewPlacedMeshData ?? build?.placedMeshData)
        ? scaleAxisGuides(
            translateMeshData(
              build.previewPlacedMeshData ?? build.placedMeshData,
              previewCenteringOffset,
            ),
            1.5,
          )
        : null,
    );
    const crystalStlCompositeMeshData = crystalBuilds.map((build, index) =>
      (index === 0 || build?.crystal?.enabled !== false) &&
      build?.stlCompositePlacedMeshData
        ? scaleAxisGuides(
            translateMeshData(
              build.stlCompositePlacedMeshData,
              previewCenteringOffset,
            ),
            1.5,
          )
        : null,
    );
    const basePreviewMeshData = crystalPreviewMeshData[0] ?? null;
    const derivedPreviewMeshData = crystalPreviewMeshData[1] ?? null;

    return {
      finalGeometry,
      previewFinalGeometry,
      basePreviewGeometry,
      derivedPreviewGeometry,
      crystalPreviewGeometries,
      crystalStlCompositeGeometries,
      basePreviewMeshData,
      derivedPreviewMeshData,
      crystalPreviewMeshData,
      crystalStlCompositeMeshData,
      validation,
      metrics: buildMetrics(finalGeometry),
    };
  } catch (error) {
    pushUnionDiagnostic(
      validation,
      t("builder.unionDiagnosticException", { message: error.message }),
    );
    logUnionDiagnostic("csg-exception", {
      message: error.message,
      stack: error.stack ?? null,
      activeCrystalCount,
      validPlacedBuildCount: validPlacedBuilds.length,
      crystals: validPlacedBuilds.map((build, index) => ({
        unionOrder: index,
        crystalId: build?.crystal?.id ?? null,
        twinType: build?.crystal?.twinType ?? null,
        from: build?.crystal?.from ?? 0,
        positionCount: build?.placedMeshData?.positions?.length ?? 0,
        faceCount: Math.trunc(
          (build?.placedMeshData?.positions?.length ?? 0) / 9,
        ),
      })),
    });
    return buildFallbackResult({
      baseMeshData:
        crystalBuilds[0]?.previewPlacedMeshData ??
        crystalBuilds[0]?.placedMeshData ??
        crystalBuilds[0]?.previewSourceMeshData ??
        crystalBuilds[0]?.sourceMeshData ??
        null,
      derivedMeshData: null,
      crystalMeshData: crystalBuilds.map((build, index) =>
        index === 0 || build?.crystal?.enabled !== false
          ? (build?.previewPlacedMeshData ??
            build?.placedMeshData ??
            build?.previewSourceMeshData ??
            null)
          : null,
      ),
      validation,
      sizeMm: parameters.sizeMm,
      warningMessage: t("builder.warning.unionFallback", {
        message: error.message,
      }),
    });
  }
}

// @ts-nocheck
