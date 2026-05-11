import {
  EPSILON,
  add,
  centroid,
  cross,
  degreesToRadians,
  dot,
  magnitude,
  normalize,
  scale,
  solve3x3,
  subtract,
  vec,
} from "./math.js";
import { usesFourAxisMiller } from "../constants.js";
import { t } from "../i18n.js";
import {
  buildFaceClosedShellWithText,
  buildFaceStlReplacementPatchWithText,
  buildFaceTrianglesWithText,
  validateFaceTextSettings,
} from "../text/faceTextGeometry.js";
import { getFaceTextFont } from "../text/fonts.js";

/**
 * 結晶パラメーターから閉じた立体 meshData を組み立てる中核モジュール。
 *
 * 半空間交差で頂点を求め、面ポリゴン化・三角形化・警告生成・軸線生成まで行う。
 * 単結晶 / 双晶の両方で使われるため、UI ではなく「幾何そのもの」の規則をここへ集約している。
 *
 * 主に扱う日本語文言:
 * - 軸長 / 軸角 / モデルサイズの入力エラー
 * - 面距離 / ミラー指数 / h + k + i = 0 の検証エラー
 * - 最小稜線長 / 最小面内半径 / 細長さの警告
 */

const PLANE_TOLERANCE = 1e-5;
const VERTEX_TOLERANCE = 1e-5;
const RECOMMENDED_MIN_FEATURE_MM = 0.4;
const RECOMMENDED_SLENDER_RATIO = 8;

interface BuildMeshOptions {
  normalizeSize?: boolean;
  resolveFaceTextFont?: (fontId: string | null | undefined) => unknown;
}

/** ミラー指数表示用に、ほぼ整数の値を安定した文字列へ整形する。 */
function formatIndexValue(value) {
  const rounded = Math.round(Number(value) * 1e6) / 1e6;
  if (Math.abs(rounded) < 1e-6) {
    return "0";
  }
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** 面ラベル描画用に、指数の符号情報と本文字列を分解する。 */
function buildFaceLabelParts(face, systemId) {
  const parts = [Number(face.h), Number(face.k)];

  if (usesFourAxisMiller(systemId)) {
    parts.push(Number(face.i));
  }

  parts.push(Number(face.l));
  return parts.map((value) => ({
    negative: value < 0,
    text: formatIndexValue(Math.abs(value)),
  }));
}

/** 軸長・軸角から direct basis を組み立てる。 */
function buildDirectBasis(axes, angles) {
  const alpha = degreesToRadians(angles.alpha);
  const beta = degreesToRadians(angles.beta);
  const gamma = degreesToRadians(angles.gamma);

  const a = vec(axes.a, 0, 0);
  const b = vec(axes.b * Math.cos(gamma), axes.b * Math.sin(gamma), 0);

  const cx = axes.c * Math.cos(beta);
  const sinGamma = Math.sin(gamma);
  const cy =
    axes.c * ((Math.cos(alpha) - Math.cos(beta) * Math.cos(gamma)) / sinGamma);
  const czSquared = axes.c ** 2 - cx ** 2 - cy ** 2;
  const c = vec(cx, cy, Math.sqrt(Math.max(0, czSquared)));

  return { a, b, c };
}

/** direct basis から reciprocal basis を組み立てる。 */
function buildReciprocalBasis(basis) {
  const cellVolume = dot(basis.a, cross(basis.b, basis.c));
  return {
    aStar: scale(cross(basis.b, basis.c), 1 / cellVolume),
    bStar: scale(cross(basis.c, basis.a), 1 / cellVolume),
    cStar: scale(cross(basis.a, basis.b), 1 / cellVolume),
  };
}

/** 角度組の Gram determinant を返す。負なら幾何学的に不正。 */
function gramDeterminant(angles) {
  const alpha = degreesToRadians(angles.alpha);
  const beta = degreesToRadians(angles.beta);
  const gamma = degreesToRadians(angles.gamma);
  const ca = Math.cos(alpha);
  const cb = Math.cos(beta);
  const cg = Math.cos(gamma);
  return 1 + 2 * ca * cb * cg - ca ** 2 - cb ** 2 - cg ** 2;
}

/** 許容誤差内で一致する既存頂点 index を探す。 */
function findVertexIndex(vertices, target) {
  return vertices.findIndex(
    (candidate) =>
      Math.abs(candidate.x - target.x) < VERTEX_TOLERANCE &&
      Math.abs(candidate.y - target.y) < VERTEX_TOLERANCE &&
      Math.abs(candidate.z - target.z) < VERTEX_TOLERANCE,
  );
}

/** 交点列から重複頂点を除去する。 */
function dedupeVertices(points) {
  const unique = [];
  for (const point of points) {
    if (findVertexIndex(unique, point) === -1) {
      unique.push(point);
    }
  }
  return unique;
}

/**
 * 面法線の三つ組から交点候補を集め、全半空間の内側にある頂点だけを残す。
 *
 * ここが「閉じた立体を作れるか」の最初のふるいになる。
 */
function collectVertices(planes) {
  const points = [];

  for (let i = 0; i < planes.length - 2; i += 1) {
    for (let j = i + 1; j < planes.length - 1; j += 1) {
      for (let k = j + 1; k < planes.length; k += 1) {
        const rows = [
          [planes[i].normal.x, planes[i].normal.y, planes[i].normal.z],
          [planes[j].normal.x, planes[j].normal.y, planes[j].normal.z],
          [planes[k].normal.x, planes[k].normal.y, planes[k].normal.z],
        ];
        const point = solve3x3(rows, [
          planes[i].distance,
          planes[j].distance,
          planes[k].distance,
        ]);
        if (!point) {
          continue;
        }

        const inside = planes.every(
          (plane) =>
            dot(plane.normal, point) <= plane.distance + PLANE_TOLERANCE,
        );
        if (inside) {
          points.push(point);
        }
      }
    }
  }

  return dedupeVertices(points);
}

/** 面上頂点を法線向きに揃った周回順へ並べ替える。 */
function orderFaceVertices(points, normal) {
  const center = centroid(points);
  const reference = Math.abs(normal.x) < 0.9 ? vec(1, 0, 0) : vec(0, 1, 0);
  const tangent = normalize(cross(reference, normal));
  const bitangent = normalize(cross(normal, tangent));

  const ordered = [...points].sort((left, right) => {
    const leftVector = subtract(left, center);
    const rightVector = subtract(right, center);
    const leftAngle = Math.atan2(
      dot(bitangent, leftVector),
      dot(tangent, leftVector),
    );
    const rightAngle = Math.atan2(
      dot(bitangent, rightVector),
      dot(tangent, rightVector),
    );
    return leftAngle - rightAngle;
  });

  const sampleNormal = cross(
    subtract(ordered[1], ordered[0]),
    subtract(ordered[2], ordered[0]),
  );
  if (dot(sampleNormal, normal) < 0) {
    ordered.reverse();
  }

  return ordered;
}

/** 各 plane に属する頂点を拾って面ポリゴンへ変換する。 */
function buildFacePolygons(planes, vertices) {
  return planes
    .map((plane) => {
      const onPlane = vertices
        .filter(
          (vertex) =>
            Math.abs(dot(plane.normal, vertex) - plane.distance) <
            PLANE_TOLERANCE,
        )
        .map((vertex) => findVertexIndex(vertices, vertex))
        .filter((index) => index !== -1);

      const uniqueIndexes = [...new Set<number>(onPlane)];
      if (uniqueIndexes.length < 3) {
        return null;
      }

      const points = uniqueIndexes.map((index) => vertices[index]);
      return {
        ...plane,
        vertexIndexes: uniqueIndexes,
        vertices: orderFaceVertices(points, normalize(plane.normal)),
      };
    })
    .filter(Boolean);
}

/**
 * 立体を指定サイズへスケーリングし、中心と bounding 情報も返す。
 *
 * `normalizeSize` が true の場合は最大寸法を `sizeMm` に合わせる。
 */
function scaleVertices(vertices, sizeMm, { normalizeSize = true } = {}) {
  const bounds = vertices.reduce(
    (accumulator, point) => ({
      min: vec(
        Math.min(accumulator.min.x, point.x),
        Math.min(accumulator.min.y, point.y),
        Math.min(accumulator.min.z, point.z),
      ),
      max: vec(
        Math.max(accumulator.max.x, point.x),
        Math.max(accumulator.max.y, point.y),
        Math.max(accumulator.max.z, point.z),
      ),
    }),
    {
      min: vec(Infinity, Infinity, Infinity),
      max: vec(-Infinity, -Infinity, -Infinity),
    },
  );

  const size = vec(
    bounds.max.x - bounds.min.x,
    bounds.max.y - bounds.min.y,
    bounds.max.z - bounds.min.z,
  );
  const maxDimension = Math.max(size.x, size.y, size.z);
  const center = vec(
    (bounds.min.x + bounds.max.x) / 2,
    (bounds.min.y + bounds.max.y) / 2,
    (bounds.min.z + bounds.max.z) / 2,
  );
  const scaleFactor =
    normalizeSize && maxDimension > EPSILON ? sizeMm / maxDimension : 1;
  const scaled = vertices.map((point) =>
    scale(subtract(point, center), scaleFactor),
  );

  return {
    center,
    size,
    scaleFactor,
    scaled,
    maxDimensionMm: maxDimension * scaleFactor,
  };
}

/** direct basis とスケール結果から、プレビュー用軸線ガイドを作る。 */
function buildAxisGuides(directBasis, scaleSet) {
  const origin = scale(scaleSet.center, -scaleSet.scaleFactor);
  const axisLength = scaleSet.maxDimensionMm * 0.75;
  const a3 = scale(add(directBasis.a, directBasis.b), -1);
  const axisDefinitions = usesFourAxisMiller(directBasis.systemId)
    ? [
        { label: "a1", vector: directBasis.a, color: "#c2544a" },
        { label: "a2", vector: directBasis.b, color: "#2f8f63" },
        { label: "a3", vector: a3, color: "#c08a2d" },
        { label: "c", vector: directBasis.c, color: "#3f6fc7" },
      ]
    : [
        { label: "a", vector: directBasis.a, color: "#c2544a" },
        { label: "b", vector: directBasis.b, color: "#2f8f63" },
        { label: "c", vector: directBasis.c, color: "#3f6fc7" },
      ];

  return axisDefinitions
    .map((axis) => ({
      label: axis.label,
      color: axis.color,
      vector: normalize(axis.vector),
    }))
    .map((axis) => {
      return {
        label: axis.label,
        color: axis.color,
        start: add(origin, scale(axis.vector, -axisLength)),
        end: add(origin, scale(axis.vector, axisLength)),
      };
    });
}

/** ベクトルを面法線へ直交化する。 */
function projectVectorOntoPlane(vector, normal) {
  const normalUnit = normalize(normal);
  return subtract(vector, scale(normalUnit, dot(vector, normalUnit)));
}

/** 面上テキストの上方向ベクトルを決める。 */
function buildFaceTextUpVector(faceNormal, directBasis) {
  const candidates = [directBasis.c, directBasis.b, directBasis.a];

  for (const candidate of candidates) {
    const projected = projectVectorOntoPlane(candidate, faceNormal);
    if (magnitude(projected) > EPSILON) {
      return normalize(projected);
    }
  }

  return null;
}

/** 面ポリゴンの内接円半径近似を求める。薄すぎる面の警告に使う。 */
function getFaceInradius(face) {
  const center = centroid(face.vertices);
  const normal = normalize(face.normal);
  const distances = [];

  for (let index = 0; index < face.vertices.length; index += 1) {
    const start = face.vertices[index];
    const end = face.vertices[(index + 1) % face.vertices.length];
    const edge = subtract(end, start);
    const inward = normalize(cross(normal, edge));
    distances.push(Math.abs(dot(inward, subtract(center, start))));
  }

  return Math.min(...distances);
}

/**
 * 稜線長・面内半径・縦横比から造形警告を追加する。
 *
 * ここは仕様書とログで何度も調整してきた閾値群に依存するため、
 * UI ではなく geometry 側で一貫して判定する。
 */
function appendManufacturabilityWarnings(facePolygons, scaledSet, validation) {
  let minEdgeLength = Infinity;
  let minFaceInradius = Infinity;

  facePolygons.forEach((face) => {
    minFaceInradius = Math.min(minFaceInradius, getFaceInradius(face));

    for (let index = 0; index < face.vertices.length; index += 1) {
      const start = face.vertices[index];
      const end = face.vertices[(index + 1) % face.vertices.length];
      minEdgeLength = Math.min(minEdgeLength, magnitude(subtract(end, start)));
    }
  });

  if (
    Number.isFinite(minEdgeLength) &&
    minEdgeLength < RECOMMENDED_MIN_FEATURE_MM
  ) {
    validation.warnings.push(
      t("geometry.warning.minEdge", { value: minEdgeLength.toFixed(2) }),
    );
  }

  if (
    Number.isFinite(minFaceInradius) &&
    minFaceInradius < RECOMMENDED_MIN_FEATURE_MM
  ) {
    validation.warnings.push(
      t("geometry.warning.minInradius", {
        value: minFaceInradius.toFixed(2),
      }),
    );
  }

  const scaledSize = vec(
    scaledSet.size.x * scaledSet.scaleFactor,
    scaledSet.size.y * scaledSet.scaleFactor,
    scaledSet.size.z * scaledSet.scaleFactor,
  );
  const nonZeroDimensions = [scaledSize.x, scaledSize.y, scaledSize.z].filter(
    (value) => value > EPSILON,
  );
  if (nonZeroDimensions.length >= 2) {
    const slenderRatio =
      Math.max(...nonZeroDimensions) / Math.min(...nonZeroDimensions);
    if (slenderRatio >= RECOMMENDED_SLENDER_RATIO) {
      validation.warnings.push(
        t("geometry.warning.slender", { value: slenderRatio.toFixed(1) }),
      );
    }
  }
}

/** 面ポリゴン一覧をレンダリング / export 用の三角形配列へ変換する。 */
function triangulateFaces(
  facePolygons,
  sourceFaceMap,
  validation,
  resolveFaceTextFont,
) {
  const positions = [];
  const faceVertexCounts = [];

  for (const face of facePolygons) {
    const sourceFace = sourceFaceMap.get(face.id) ?? null;
    const font = resolveFaceTextFont(sourceFace?.text?.fontId);
    const faceTriangles = buildFaceTrianglesWithText(
      face,
      sourceFace,
      font,
      validation,
      face.label,
    );

    for (const point of faceTriangles.positions) {
      positions.push(point.x, point.y, point.z);
    }

    faceVertexCounts.push({
      id: face.id,
      vertexCount: faceTriangles.positions.length,
    });
  }

  return { positions, faceVertexCounts };
}

/** 面ポリゴン一覧を STL 用 closed shell builder で三角形配列へ変換する。 */
function triangulateFacesForStl(
  facePolygons,
  sourceFaceMap,
  validation,
  resolveFaceTextFont,
) {
  const positions = [];
  const faceVertexCounts = [];

  for (const face of facePolygons) {
    const sourceFace = sourceFaceMap.get(face.id) ?? null;
    const font = resolveFaceTextFont(sourceFace?.text?.fontId);
    const faceTriangles = buildFaceClosedShellWithText(
      face,
      sourceFace,
      font,
      validation,
      face.label,
    );

    for (const point of faceTriangles.positions) {
      positions.push(point.x, point.y, point.z);
    }

    faceVertexCounts.push({
      id: face.id,
      vertexCount: faceTriangles.positions.length,
    });
  }

  return { positions, faceVertexCounts };
}

/** UI/JSON 上の mm 指定 text 設定を、現在の geometry 単位へ換算する。 */
function scaleFaceTextSettingsForGeometry(text, geometryUnitsPerMm = 1) {
  if (!text || geometryUnitsPerMm === 1) {
    return text;
  }
  return {
    ...text,
    fontSize: Number(text.fontSize ?? 0) * geometryUnitsPerMm,
    depth: Number(text.depth ?? 0) * geometryUnitsPerMm,
    offsetU: Number(text.offsetU ?? 0) * geometryUnitsPerMm,
    offsetV: Number(text.offsetV ?? 0) * geometryUnitsPerMm,
  };
}

function stripFaceTextForStlBase(faces = []) {
  return faces.map((face) => ({
    ...face,
    text: {
      ...(face.text ?? {}),
      content: "",
      depth: 0,
    },
  }));
}

function getLooseObjectField(record, key) {
  return record && typeof record === "object" ? Reflect.get(record, key) : null;
}

/** スケーリング後の頂点配列に合わせて face polygon 頂点参照を張り替える。 */
function rebuildScaledPolygons(facePolygons, scaledVertices, originalVertices) {
  return facePolygons.map((face) => ({
    ...face,
    vertices: face.vertices.map((vertex) => {
      const index = findVertexIndex(originalVertices, vertex);
      return scaledVertices[index];
    }),
  }));
}

/** 単結晶 parameter の幾何妥当性を検証し、エラー / 警告を返す。 */
export function validateParameters(parameters) {
  const errors = [];
  const warnings = [];

  for (const axisName of ["a", "b", "c"]) {
    const value = Number(parameters.axes[axisName]);
    if (!Number.isFinite(value) || value <= 0) {
      errors.push(t("geometry.error.axisPositive", { axisName }));
    }
  }

  for (const angleName of ["alpha", "beta", "gamma"]) {
    const value = Number(parameters.angles[angleName]);
    if (!Number.isFinite(value) || value <= 0 || value >= 180) {
      errors.push(t("geometry.error.angleRange", { angleName }));
    }
  }

  if (!Number.isFinite(parameters.sizeMm) || parameters.sizeMm <= 0) {
    errors.push(t("geometry.error.modelSize"));
  }

  const determinant = gramDeterminant(parameters.angles);
  if (!Number.isFinite(determinant) || determinant <= EPSILON) {
    errors.push(t("geometry.error.invalidAxisAngles"));
  }

  const activeFaces = parameters.faces.filter((face) => face.enabled !== false);

  activeFaces.forEach((face, index) => {
    const distance = Number(face.distance);
    if (!Number.isFinite(distance)) {
      errors.push(t("geometry.error.faceDistance", { index: index + 1 }));
    }

    const h = Number(face.h);
    const k = Number(face.k);
    const i = Number(face.i);
    const l = Number(face.l);
    if (![h, k, l].every(Number.isFinite)) {
      errors.push(t("geometry.error.faceIndexNumeric", { index: index + 1 }));
      return;
    }

    if (usesFourAxisMiller(parameters.crystalSystem) && !Number.isFinite(i)) {
      errors.push(t("geometry.error.faceIndexINumeric", { index: index + 1 }));
      return;
    }

    if (
      Math.abs(h) < EPSILON &&
      Math.abs(k) < EPSILON &&
      Math.abs(l) < EPSILON
    ) {
      errors.push(t("geometry.error.faceZeroIndex", { index: index + 1 }));
    }

    if (
      usesFourAxisMiller(parameters.crystalSystem) &&
      Math.abs(h + k + i) > 1e-6
    ) {
      errors.push(t("geometry.error.faceFourAxisRule", { index: index + 1 }));
    }
  });

  if (activeFaces.length < 4) {
    warnings.push(t("geometry.warning.closedSolidNeedsFaces"));
  }

  validateFaceTextSettings(parameters, { errors, warnings });

  return { errors, warnings };
}

/**
 * 単結晶 parameter から meshData・軸線・検証結果をまとめて構築する。
 *
 * 出力:
 * - geometry: preview / export 用の meshData
 * - validation: UI 表示用エラー / 警告
 * - metrics / axisGuides / facePolygons などの補助情報
 */
function buildCrystalMeshDataInternal(
  parameters,
  options: BuildMeshOptions = {},
  triangulateFacesFn = triangulateFaces,
) {
  const { normalizeSize = true } = options;
  const resolveFaceTextFont = options.resolveFaceTextFont ?? getFaceTextFont;
  const validation = validateParameters(parameters);
  if (validation.errors.length > 0) {
    return {
      geometry: null,
      validation,
      metrics: { vertexCount: 0, faceCount: 0, maxDimensionMm: null },
    };
  }

  const directBasis = {
    ...buildDirectBasis(parameters.axes, parameters.angles),
    systemId: parameters.crystalSystem,
  };
  const reciprocalBasis = buildReciprocalBasis(directBasis);

  const planes = parameters.faces
    .filter((face) => face.enabled !== false)
    .map((face, index) => {
      const effective = {
        h: Number(face.h),
        k: Number(face.k),
        l: Number(face.l),
      };

      if (
        Math.abs(effective.h) < EPSILON &&
        Math.abs(effective.k) < EPSILON &&
        Math.abs(effective.l) < EPSILON
      ) {
        return null;
      }

      const normal = add(
        add(
          scale(reciprocalBasis.aStar, effective.h),
          scale(reciprocalBasis.bStar, effective.k),
        ),
        scale(reciprocalBasis.cStar, effective.l),
      );

      if (magnitude(normal) < EPSILON) {
        validation.warnings.push(
          t("geometry.warning.faceNormalIgnored", { index: index + 1 }),
        );
        return null;
      }

      return {
        id: face.id,
        label: t("geometry.faceLabel", { index: index + 1 }),
        labelParts: buildFaceLabelParts(face, parameters.crystalSystem),
        normal,
        distance: Number(face.distance),
      };
    })
    .filter(Boolean);

  if (planes.length < 4) {
    validation.errors.push(t("geometry.error.notEnoughFaces"));
    return {
      geometry: null,
      validation,
      metrics: { vertexCount: 0, faceCount: 0, maxDimensionMm: null },
    };
  }

  const vertices = collectVertices(planes);
  if (vertices.length < 4) {
    validation.errors.push(t("geometry.error.cannotBuildClosedSolid"));
    return {
      geometry: null,
      validation,
      metrics: { vertexCount: 0, faceCount: 0, maxDimensionMm: null },
    };
  }

  const facePolygons = buildFacePolygons(planes, vertices);
  if (
    facePolygons.length < 4 ||
    facePolygons.some((face) => face.vertices.length < 3)
  ) {
    validation.errors.push(t("geometry.error.cannotBuildPolygons"));
    return {
      geometry: null,
      validation,
      metrics: { vertexCount: 0, faceCount: 0, maxDimensionMm: null },
    };
  }

  const scaledSet = scaleVertices(vertices, Number(parameters.sizeMm), {
    normalizeSize,
  });
  const geometryUnitsPerMm =
    normalizeSize || !Number.isFinite(Number(parameters.sizeMm))
      ? 1
      : scaledSet.maxDimensionMm > EPSILON
        ? scaledSet.maxDimensionMm / Number(parameters.sizeMm)
        : 1;
  const sourceFaceMap = new Map(
    parameters.faces
      .filter((face) => face.enabled !== false)
      .map((face) => [
        face.id,
        {
          ...face,
          text: scaleFaceTextSettingsForGeometry(face.text, geometryUnitsPerMm),
        },
      ]),
  );
  const scaledPolygons = rebuildScaledPolygons(
    facePolygons,
    scaledSet.scaled,
    vertices,
  ).map((face) => ({
    ...face,
    text: getLooseObjectField(sourceFaceMap.get(face.id), "text") ?? null,
    textUpVector: buildFaceTextUpVector(face.normal, directBasis),
  }));
  const triangulated = triangulateFacesFn(
    scaledPolygons,
    sourceFaceMap,
    validation,
    resolveFaceTextFont,
  );
  appendManufacturabilityWarnings(scaledPolygons, scaledSet, validation);
  const axisGuides = buildAxisGuides(directBasis, scaledSet);

  return {
    geometry: {
      axisGuides,
      positions: triangulated.positions,
      faceVertexCounts: triangulated.faceVertexCounts,
      vertices: scaledSet.scaled,
      faces: scaledPolygons,
    },
    validation,
    metrics: {
      vertexCount: scaledSet.scaled.length,
      faceCount: scaledPolygons.length,
      maxDimensionMm: scaledSet.maxDimensionMm,
    },
  };
}

export function buildCrystalMeshData(
  parameters,
  options: BuildMeshOptions = {},
) {
  return buildCrystalMeshDataInternal(parameters, options, triangulateFaces);
}

export function buildCrystalStlMeshData(
  parameters,
  options: BuildMeshOptions = {},
) {
  return buildCrystalMeshDataInternal(
    parameters,
    options,
    triangulateFacesForStl,
  );
}

export function buildCrystalStlTextShellData(
  parameters,
  options: BuildMeshOptions = {},
) {
  const { normalizeSize = true } = options;
  const baseParameters = {
    ...structuredClone(parameters),
    faces: stripFaceTextForStlBase(structuredClone(parameters.faces ?? [])),
  };
  const baseResult = buildCrystalMeshDataInternal(
    baseParameters,
    options,
    triangulateFaces,
  );

  if (!baseResult.geometry) {
    return {
      baseGeometry: null,
      textShells: [],
      validation: baseResult.validation,
      metrics: baseResult.metrics,
    };
  }

  const resolveFaceTextFont = options.resolveFaceTextFont ?? getFaceTextFont;
  const geometryUnitsPerMm =
    normalizeSize || !Number.isFinite(Number(parameters.sizeMm))
      ? 1
      : baseResult.metrics.maxDimensionMm > EPSILON
        ? baseResult.metrics.maxDimensionMm / Number(parameters.sizeMm)
        : 1;
  /** @type {Map<string, any>} */
  const sourceFaceMap = new Map(
    (parameters.faces ?? []).map((face) => [
      face.id,
      {
        ...face,
        text: scaleFaceTextSettingsForGeometry(face.text, geometryUnitsPerMm),
      },
    ]),
  );

  const textShells = (baseResult.geometry.faces ?? [])
    .map((face) => {
      const sourceFace = sourceFaceMap.get(face.id) ?? null;
      const sourceFaceText = getLooseObjectField(sourceFace, "text");
      if (
        !sourceFace ||
        String(getLooseObjectField(sourceFaceText, "content") ?? "").trim()
          .length === 0 ||
        Math.abs(Number(getLooseObjectField(sourceFaceText, "depth") ?? 0)) <
          EPSILON
      ) {
        return null;
      }

      const font = resolveFaceTextFont(
        getLooseObjectField(sourceFaceText, "fontId"),
      );
      const shell = buildFaceClosedShellWithText(
        face,
        sourceFace,
        font,
        baseResult.validation,
        face.label,
      );
      return {
        faceId: face.id,
        label: face.label,
        positions: shell.positions,
        debug: shell.debug,
      };
    })
    .filter(Boolean);

  return {
    baseGeometry: baseResult.geometry,
    textShells,
    validation: baseResult.validation,
    metrics: baseResult.metrics,
  };
}

export function buildCrystalStlTextPatchData(
  parameters,
  options: BuildMeshOptions = {},
) {
  const { normalizeSize = true } = options;
  const baseParameters = {
    ...structuredClone(parameters),
    faces: stripFaceTextForStlBase(structuredClone(parameters.faces ?? [])),
  };
  const baseResult = buildCrystalMeshDataInternal(
    baseParameters,
    options,
    triangulateFaces,
  );

  if (!baseResult.geometry) {
    return {
      baseGeometry: null,
      textPatches: [],
      validation: baseResult.validation,
      metrics: baseResult.metrics,
    };
  }

  const resolveFaceTextFont = options.resolveFaceTextFont ?? getFaceTextFont;
  const geometryUnitsPerMm =
    normalizeSize || !Number.isFinite(Number(parameters.sizeMm))
      ? 1
      : baseResult.metrics.maxDimensionMm > EPSILON
        ? baseResult.metrics.maxDimensionMm / Number(parameters.sizeMm)
        : 1;
  /** @type {Map<string, any>} */
  const sourceFaceMap = new Map(
    (parameters.faces ?? []).map((face) => [
      face.id,
      {
        ...face,
        text: scaleFaceTextSettingsForGeometry(face.text, geometryUnitsPerMm),
      },
    ]),
  );

  const textPatches = (baseResult.geometry.faces ?? [])
    .map((face) => {
      const sourceFace = sourceFaceMap.get(face.id) ?? null;
      const sourceFaceText = getLooseObjectField(sourceFace, "text");
      if (
        !sourceFace ||
        String(getLooseObjectField(sourceFaceText, "content") ?? "").trim()
          .length === 0 ||
        Math.abs(Number(getLooseObjectField(sourceFaceText, "depth") ?? 0)) <
          EPSILON
      ) {
        return null;
      }

      const font = resolveFaceTextFont(
        getLooseObjectField(sourceFaceText, "fontId"),
      );
      const patch = buildFaceStlReplacementPatchWithText(
        face,
        sourceFace,
        font,
        baseResult.validation,
        face.label,
      );
      return {
        faceId: face.id,
        label: face.label,
        positions: patch.positions,
        debug: patch.debug,
      };
    })
    .filter(Boolean);

  return {
    baseGeometry: baseResult.geometry,
    textPatches,
    validation: baseResult.validation,
    metrics: baseResult.metrics,
  };
}

export function buildCrystalStlCompositeMeshData(
  parameters,
  options: BuildMeshOptions = {},
) {
  const patchData = buildCrystalStlTextPatchData(parameters, options);
  if (!patchData.baseGeometry) {
    return {
      geometry: null,
      validation: patchData.validation,
      metrics: patchData.metrics,
    };
  }

  const textFaceIds = new Set(
    patchData.textPatches.map((patch) => patch.faceId),
  );
  const faceVertexCounts = patchData.baseGeometry.faceVertexCounts ?? [];
  const basePositions = patchData.baseGeometry.positions ?? [];
  const compositePositions = [];
  const compositeFaceVertexCounts = [];
  let cursor = 0;

  faceVertexCounts.forEach((entry) => {
    const vertexCount = Number(entry?.vertexCount ?? 0);
    const nextCursor = cursor + vertexCount * 3;
    if (!textFaceIds.has(entry.id)) {
      compositePositions.push(...basePositions.slice(cursor, nextCursor));
      compositeFaceVertexCounts.push(entry);
    }
    cursor = nextCursor;
  });

  patchData.textPatches.forEach((patch) => {
    const patchPositions = patch.positions.flatMap((point) => [
      point.x,
      point.y,
      point.z,
    ]);
    compositePositions.push(...patchPositions);
    compositeFaceVertexCounts.push({
      id: patch.faceId,
      vertexCount: patch.positions.length,
    });
  });

  return {
    geometry: {
      ...patchData.baseGeometry,
      positions: compositePositions,
      faceVertexCounts: compositeFaceVertexCounts,
    },
    validation: patchData.validation,
    metrics: patchData.metrics,
    textShells: patchData.textPatches,
  };
}
