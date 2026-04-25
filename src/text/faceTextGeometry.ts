import * as THREE from "three";
import {
  centroid,
  cross,
  dot,
  normalize,
  subtract,
  vec,
} from "../geometry/math.js";
import { FACE_TEXT_DEFAULTS } from "../constants.js";

/**
 * 面上テキストの刻印形状を生成する。
 *
 * 現在の UI では一時的に無効化しているが、保守再開時に理解しやすいよう
 * 文字 shape の変換・面内フィット・押し出し三角形化をこの file に残している。
 */

const OUTLINE_SAMPLE_SEGMENTS = 3;
const EXTRUDE_CURVE_SEGMENTS = 10;
const INSIDE_MARGIN = 0.05;
const EPSILON = 1e-6;
const RECOMMENDED_MIN_TEXT_SIZE_MM = 1.2;
const RECOMMENDED_MIN_TEXT_DEPTH_MM = 0.25;
const RECOMMENDED_MAX_TEXT_DEPTH_MM = 2.5;

/** 汎用 point object を Three.js Vector3 へ変換する。 */
function toVector3(point) {
  return new THREE.Vector3(point.x, point.y, point.z);
}

/** Three.js Vector3 を軽量 point object へ戻す。 */
function toPoint(vector) {
  return vec(vector.x, vector.y, vector.z);
}

/** 数値入力を安全に normalize する。 */
function normalizeNumericValue(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/** 面上テキスト設定を既定値込みで正規化する。 */
function normalizeTextSettings(text) {
  return {
    content: String(text?.content ?? FACE_TEXT_DEFAULTS.content),
    fontId: String(text?.fontId ?? FACE_TEXT_DEFAULTS.fontId),
    fontSize: normalizeNumericValue(
      text?.fontSize,
      FACE_TEXT_DEFAULTS.fontSize,
    ),
    depth: normalizeNumericValue(text?.depth, FACE_TEXT_DEFAULTS.depth),
    offsetU: normalizeNumericValue(text?.offsetU, FACE_TEXT_DEFAULTS.offsetU),
    offsetV: normalizeNumericValue(text?.offsetV, FACE_TEXT_DEFAULTS.offsetV),
    rotationDeg: normalizeNumericValue(
      text?.rotationDeg,
      FACE_TEXT_DEFAULTS.rotationDeg,
    ),
  };
}

/** 浮動小数誤差で輪郭が暴れないよう 2D 点を丸める。 */
function roundPoint2(point) {
  return new THREE.Vector2(
    Math.round(point.x * 1e6) / 1e6,
    Math.round(point.y * 1e6) / 1e6,
  );
}

/** 2 点がほぼ一致しているか判定する。 */
function pointsAlmostEqual(left, right) {
  return (
    Math.abs(left.x - right.x) < EPSILON && Math.abs(left.y - right.y) < EPSILON
  );
}

/** 閉ループ末尾の重複点を除去する。 */
function dedupeLoop(points) {
  const loop = points.map((point) => roundPoint2(point));
  if (loop.length >= 2 && pointsAlmostEqual(loop[0], loop[loop.length - 1])) {
    loop.pop();
  }
  return loop;
}

/** ShapeUtils が期待する winding へ輪郭向きを揃える。 */
function ensureWinding(points, clockwise) {
  if (points.length < 3) {
    return points;
  }

  const isClockwise = THREE.ShapeUtils.isClockWise(points);
  return isClockwise === clockwise ? points : [...points].reverse();
}

/**
 * 面ごとのローカル座標系を作る。
 *
 * textUpVector がある場合はそれを優先し、ない場合は world up 候補から面内ベクトルを探す。
 */
function createFaceBasis(face) {
  const faceCenter = centroid(face.vertices);
  const normal = normalize(face.normal);
  const normalVector = new THREE.Vector3(normal.x, normal.y, normal.z);

  let vertical = null;
  if (face.textUpVector) {
    const textUpVector = new THREE.Vector3(
      face.textUpVector.x,
      face.textUpVector.y,
      face.textUpVector.z,
    );
    if (textUpVector.lengthSq() > EPSILON) {
      vertical = textUpVector.normalize();
    }
  }

  if (!vertical) {
    const worldUpCandidates = [
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(1, 0, 0),
    ];

    for (const candidate of worldUpCandidates) {
      const projected = candidate.clone().projectOnPlane(normalVector);
      if (projected.lengthSq() > EPSILON) {
        vertical = projected.normalize();
        break;
      }
    }
  }

  if (!vertical) {
    return null;
  }

  const tangent = new THREE.Vector3()
    .crossVectors(vertical, normalVector)
    .normalize();
  const bitangent = new THREE.Vector3()
    .crossVectors(normalVector, tangent)
    .normalize();

  return {
    origin: toVector3(faceCenter),
    tangent,
    bitangent,
    normal: normalVector,
  };
}

/** 3D 点を面ローカル 2D 座標へ射影する。 */
function projectPoint(point, basis) {
  const relative = toVector3(point).sub(basis.origin);
  return new THREE.Vector2(
    relative.dot(basis.tangent),
    relative.dot(basis.bitangent),
  );
}

/** 面ローカル 2D 点を 3D 空間へ持ち上げる。 */
function liftPoint(point, basis, depth = 0) {
  const vector = basis.origin
    .clone()
    .addScaledVector(basis.tangent, point.x)
    .addScaledVector(basis.bitangent, point.y)
    .addScaledVector(basis.normal, depth);
  return toPoint(vector);
}

/** 点が線分上にあるかを許容誤差付きで判定する。 */
function pointOnSegment(point, start, end) {
  const edgeX = end.x - start.x;
  const edgeY = end.y - start.y;
  const offsetX = point.x - start.x;
  const offsetY = point.y - start.y;
  const crossValue = edgeX * offsetY - edgeY * offsetX;

  if (Math.abs(crossValue) > INSIDE_MARGIN) {
    return false;
  }

  const dotValue = offsetX * edgeX + offsetY * edgeY;
  if (dotValue < -INSIDE_MARGIN) {
    return false;
  }

  const edgeLengthSquared = edgeX * edgeX + edgeY * edgeY;
  if (dotValue - edgeLengthSquared > INSIDE_MARGIN) {
    return false;
  }

  return true;
}

/** 点がポリゴン内にあるかを判定する。境界上は内側扱いにする。 */
function pointInPolygon(point, polygon) {
  let inside = false;

  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[previousIndex];

    if (pointOnSegment(point, previous, current)) {
      return true;
    }

    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y || EPSILON) +
          current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function buildLoopSamples(path, transformPoint) {
  return dedupeLoop(
    path.getPoints(OUTLINE_SAMPLE_SEGMENTS).map(transformPoint),
  );
}

function buildTransformedTextShapes(font, textSettings, basis, shapeScale = 1) {
  const rawShapes = font.generateShapes(
    textSettings.content,
    textSettings.fontSize,
  );
  if (!rawShapes || rawShapes.length === 0) {
    return null;
  }

  const rawPoints = [];
  for (const shape of rawShapes) {
    rawPoints.push(...shape.getPoints(OUTLINE_SAMPLE_SEGMENTS));
    for (const hole of shape.holes) {
      rawPoints.push(...hole.getPoints(OUTLINE_SAMPLE_SEGMENTS));
    }
  }

  if (rawPoints.length === 0) {
    return null;
  }

  const bounds = rawPoints.reduce(
    (accumulator, point) => ({
      minX: Math.min(accumulator.minX, point.x),
      maxX: Math.max(accumulator.maxX, point.x),
      minY: Math.min(accumulator.minY, point.y),
      maxY: Math.max(accumulator.maxY, point.y),
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    },
  );

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const rotationRad = THREE.MathUtils.degToRad(textSettings.rotationDeg);
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  const transformPoint = (point) => {
    const localX = (point.x - centerX) * shapeScale;
    const localY = (point.y - centerY) * shapeScale;
    return new THREE.Vector2(
      localX * cos - localY * sin + textSettings.offsetU,
      localX * sin + localY * cos + textSettings.offsetV,
    );
  };

  return rawShapes
    .map((shape) => ({
      contour: ensureWinding(buildLoopSamples(shape, transformPoint), true),
      holes: shape.holes.map((hole) =>
        ensureWinding(buildLoopSamples(hole, transformPoint), false),
      ),
    }))
    .filter((shape) => shape.contour.length >= 3);
}

function canShapesFitFace(shapes, faceContour) {
  return shapes.every((shape) => {
    const loops = [shape.contour, ...shape.holes];
    return loops.every((loop) =>
      loop.every((point) => pointInPolygon(point, faceContour)),
    );
  });
}

function fitTextShapesToFace(font, textSettings, basis, faceContour) {
  for (let scalePercent = 100; scalePercent >= 35; scalePercent -= 1) {
    const roundedScale = scalePercent / 100;
    const shapes = buildTransformedTextShapes(
      font,
      textSettings,
      basis,
      roundedScale,
    );
    if (!shapes || shapes.length === 0) {
      continue;
    }

    if (canShapesFitFace(shapes, faceContour)) {
      return {
        shapes,
        scaleFactor: roundedScale,
        fitConfirmed: true,
      };
    }
  }

  const fallbackScale = 0.35;
  const fallbackShapes = buildTransformedTextShapes(
    font,
    textSettings,
    basis,
    fallbackScale,
  );
  if (!fallbackShapes || fallbackShapes.length === 0) {
    return null;
  }

  return {
    shapes: fallbackShapes,
    scaleFactor: fallbackScale,
    fitConfirmed: false,
  };
}

function triangulateLoop(contour, holes, depth, basis) {
  const triangles = [];
  const indices = THREE.ShapeUtils.triangulateShape(contour, holes);
  const allPoints = contour.concat(...holes);

  for (const [aIndex, bIndex, cIndex] of indices) {
    const a = liftPoint(allPoints[aIndex], basis, depth);
    const b = liftPoint(allPoints[bIndex], basis, depth);
    const c = liftPoint(allPoints[cIndex], basis, depth);
    triangles.push(a, b, c);
  }

  return triangles;
}

function reverseTriangleWinding(triangles) {
  const reversed = [];
  for (let index = 0; index + 2 < triangles.length; index += 3) {
    reversed.push(triangles[index], triangles[index + 2], triangles[index + 1]);
  }
  return reversed;
}

function appendLoopWallTriangles(
  target,
  loop,
  topDepth,
  bottomDepth,
  basis,
  inward = false,
) {
  for (let index = 0; index < loop.length; index += 1) {
    const start = loop[index];
    const end = loop[(index + 1) % loop.length];
    const topStart = liftPoint(start, basis, topDepth);
    const topEnd = liftPoint(end, basis, topDepth);
    const bottomStart = liftPoint(start, basis, bottomDepth);
    const bottomEnd = liftPoint(end, basis, bottomDepth);

    if (inward) {
      target.push(
        topStart,
        topEnd,
        bottomStart,
        bottomStart,
        topEnd,
        bottomEnd,
      );
    } else {
      target.push(
        topStart,
        bottomStart,
        topEnd,
        bottomStart,
        bottomEnd,
        topEnd,
      );
    }
  }
}

function createThreePath(points) {
  const path = new THREE.Path();
  path.setFromPoints(points);
  path.autoClose = true;
  return path;
}

function createThreeShape(contour, holes) {
  const shape = new THREE.Shape();
  shape.setFromPoints(contour);
  shape.autoClose = true;
  shape.holes = holes.map((hole) => createThreePath(hole));
  return shape;
}

function appendExtrudedShapeTriangles(
  target,
  shape,
  basis,
  depthSign,
  depthAmount,
) {
  const extrudedGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: depthAmount,
    steps: 1,
    bevelEnabled: false,
    curveSegments: EXTRUDE_CURVE_SEGMENTS,
  });
  const nonIndexedGeometry = extrudedGeometry.index
    ? extrudedGeometry.toNonIndexed()
    : extrudedGeometry;
  const positions = nonIndexedGeometry.getAttribute("position");

  for (let index = 0; index < positions.count; index += 3) {
    const triangle = [
      new THREE.Vector3(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index),
      ),
      new THREE.Vector3(
        positions.getX(index + 1),
        positions.getY(index + 1),
        positions.getZ(index + 1),
      ),
      new THREE.Vector3(
        positions.getX(index + 2),
        positions.getY(index + 2),
        positions.getZ(index + 2),
      ),
    ];

    // z=0 側の開口面は元の面ポリゴンで既に表現されている。
    // ここでは文字押し出しの側面と奥側キャップだけを残す。
    const isNearCap = triangle.every((point) => Math.abs(point.z) < EPSILON);
    if (isNearCap) {
      continue;
    }

    for (const point of triangle) {
      const worldPoint = toPoint(
        basis.origin
          .clone()
          .addScaledVector(basis.tangent, point.x)
          .addScaledVector(basis.bitangent, point.y)
          .addScaledVector(basis.normal, point.z * depthSign),
      );
      target.push(worldPoint);
    }
  }

  if (nonIndexedGeometry !== extrudedGeometry) {
    nonIndexedGeometry.dispose();
  }
  extrudedGeometry.dispose();
}

function appendTriangles(target, triangles) {
  for (const point of triangles) {
    target.push(point);
  }
}

function buildPlainFaceTriangles(face) {
  const plainTriangles = [];
  for (let index = 1; index < face.vertices.length - 1; index += 1) {
    plainTriangles.push(
      face.vertices[0],
      face.vertices[index],
      face.vertices[index + 1],
    );
  }
  return plainTriangles;
}

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

export function validateFaceTextSettings(parameters, validation) {
  parameters.faces.forEach((face, index) => {
    const text = normalizeTextSettings(face.text);
    if (text.content.trim() === "") {
      return;
    }

    if (!Number.isFinite(text.fontSize) || text.fontSize <= 0) {
      validation.errors.push(
        `面 ${index + 1} のフォントサイズは正の数にしてください。`,
      );
    }

    if (!Number.isFinite(text.depth)) {
      validation.errors.push(
        `面 ${index + 1} の文字深さは数値にしてください。`,
      );
    }

    if (!Number.isFinite(text.offsetU) || !Number.isFinite(text.offsetV)) {
      validation.errors.push(
        `面 ${index + 1} の面内位置オフセットは数値にしてください。`,
      );
    }

    if (!Number.isFinite(text.rotationDeg)) {
      validation.errors.push(
        `面 ${index + 1} の面内回転角は数値にしてください。`,
      );
    }

    if (text.fontSize < RECOMMENDED_MIN_TEXT_SIZE_MM) {
      validation.warnings.push(
        `面 ${index + 1} の文字サイズ ${text.fontSize} mm は小さく、造形で潰れる可能性があります。`,
      );
    }

    const absoluteDepth = Math.abs(text.depth);
    if (absoluteDepth > 0 && absoluteDepth < RECOMMENDED_MIN_TEXT_DEPTH_MM) {
      validation.warnings.push(
        `面 ${index + 1} の文字深さ ${text.depth} mm は浅く、造形で視認しづらい可能性があります。`,
      );
    }

    if (absoluteDepth > RECOMMENDED_MAX_TEXT_DEPTH_MM) {
      validation.warnings.push(
        `面 ${index + 1} の文字深さ ${text.depth} mm は深すぎるため、造形やメッシュ安定性に影響する可能性があります。`,
      );
    }
  });
}

export function buildFaceTrianglesWithText(
  face,
  sourceFace,
  font,
  validation,
  faceLabel,
) {
  const triangles = [];
  const plainTriangles = buildPlainFaceTriangles(face);

  const textSettings = normalizeTextSettings(sourceFace?.text);
  if (
    !font ||
    textSettings.content.trim() === "" ||
    Math.abs(textSettings.depth) < EPSILON
  ) {
    return { positions: plainTriangles };
  }

  const basis = createFaceBasis(face);
  if (!basis) {
    validation.warnings.push(
      `${faceLabel} の文字配置基準を作れないため、文字加工をスキップしました。`,
    );
    return { positions: plainTriangles };
  }

  const faceContour = ensureWinding(
    face.vertices.map((vertex) => projectPoint(vertex, basis)),
    true,
  );
  const fittedShapes = fitTextShapesToFace(
    font,
    textSettings,
    basis,
    faceContour,
  );
  if (!fittedShapes || fittedShapes.shapes.length === 0) {
    validation.warnings.push(
      `${faceLabel} の文字列から有効な文字輪郭を作れなかったため、文字加工をスキップしました。`,
    );
    return { positions: plainTriangles };
  }

  const transformedShapes = fittedShapes.shapes;
  const outlineLoops = [];
  for (const shape of transformedShapes) {
    outlineLoops.push(ensureWinding(shape.contour, false));
  }

  if (fittedShapes.scaleFactor < 1) {
    validation.warnings.push(
      `${faceLabel} の文字が面内に収まるよう ${Math.round(fittedShapes.scaleFactor * 100)}% に自動縮小されました。`,
    );
  }

  if (!fittedShapes.fitConfirmed) {
    validation.warnings.push(
      `${faceLabel} は収まり判定が不安定なため、最小縮尺で文字加工を継続しました。`,
    );
  }

  const faceInradius = getFaceInradius(face);
  if (Math.abs(textSettings.depth) > faceInradius * 1.2) {
    validation.warnings.push(
      `${faceLabel} の文字深さが大きく、メッシュ破綻の可能性があります。`,
    );
  }

  appendTriangles(
    triangles,
    triangulateLoop(faceContour, outlineLoops, 0, basis),
  );

  const depthSign = textSettings.depth > 0 ? -1 : 1;
  const depthAmount = Math.abs(textSettings.depth);
  for (const shape of transformedShapes) {
    const threeShape = createThreeShape(shape.contour, shape.holes);
    appendExtrudedShapeTriangles(
      triangles,
      threeShape,
      basis,
      depthSign,
      depthAmount,
    );
  }

  return { positions: triangles };
}

export function buildFaceClosedShellWithText(
  face,
  sourceFace,
  font,
  validation,
  faceLabel,
) {
  const plainTriangles = buildPlainFaceTriangles(face);
  const textSettings = normalizeTextSettings(sourceFace?.text);
  const basis = createFaceBasis(face);

  if (!basis) {
    validation.warnings.push(
      `${faceLabel} の文字配置基準を作れないため、STL 用文字加工をスキップしました。`,
    );
    return {
      positions: plainTriangles,
      debug: {
        topFaceTriangleCount: plainTriangles.length / 3,
        topIslandTriangleCount: 0,
        outerSideTriangleCount: 0,
        cavitySideTriangleCount: 0,
        cavityBottomTriangleCount: 0,
      },
    };
  }

  const faceContour = ensureWinding(
    face.vertices.map((vertex) => projectPoint(vertex, basis)),
    true,
  );
  const topTriangles = [];
  const cavitySideTriangles = [];
  const cavityBottomTriangles = [];
  const topIslandTriangles = [];
  const outerSideTriangles = [];

  const shellThickness = Math.max(
    Math.abs(textSettings.depth) + RECOMMENDED_MIN_TEXT_DEPTH_MM,
    RECOMMENDED_MIN_TEXT_DEPTH_MM,
  );

  appendTriangles(topTriangles, triangulateLoop(faceContour, [], 0, basis));
  appendTriangles(
    topTriangles,
    reverseTriangleWinding(
      triangulateLoop(faceContour, [], -shellThickness, basis),
    ),
  );
  appendLoopWallTriangles(
    outerSideTriangles,
    ensureWinding(faceContour, true),
    0,
    -shellThickness,
    basis,
    false,
  );

  if (
    font &&
    textSettings.content.trim() !== "" &&
    Math.abs(textSettings.depth) >= EPSILON &&
    textSettings.depth > 0
  ) {
    const fittedShapes = fitTextShapesToFace(
      font,
      textSettings,
      basis,
      faceContour,
    );
    if (fittedShapes?.shapes?.length) {
      const outlineLoops = [];
      for (const shape of fittedShapes.shapes) {
        outlineLoops.push(ensureWinding(shape.contour, false));
      }

      topTriangles.length = 0;
      appendTriangles(
        topTriangles,
        triangulateLoop(faceContour, outlineLoops, 0, basis),
      );
      appendTriangles(
        topTriangles,
        reverseTriangleWinding(
          triangulateLoop(faceContour, [], -shellThickness, basis),
        ),
      );

      const cavityDepth = -Math.abs(textSettings.depth);
      for (const shape of fittedShapes.shapes) {
        appendTriangles(
          cavityBottomTriangles,
          triangulateLoop(shape.contour, shape.holes, cavityDepth, basis),
        );
        for (const hole of shape.holes) {
          appendTriangles(
            topIslandTriangles,
            triangulateLoop(ensureWinding(hole, true), [], 0, basis),
          );
        }

        appendLoopWallTriangles(
          cavitySideTriangles,
          ensureWinding(shape.contour, false),
          0,
          cavityDepth,
          basis,
          true,
        );
        for (const hole of shape.holes) {
          appendLoopWallTriangles(
            cavitySideTriangles,
            ensureWinding(hole, true),
            0,
            cavityDepth,
            basis,
            false,
          );
        }
      }
    } else {
      validation.warnings.push(
        `${faceLabel} の STL 用文字輪郭を作れなかったため、平面シェルへ fallback しました。`,
      );
    }
  } else if (textSettings.depth < 0 && textSettings.content.trim() !== "") {
    validation.warnings.push(
      `${faceLabel} の負の文字深さは STL 用閉シェルでは未対応のため、平面シェルへ fallback しました。`,
    );
  }

  return {
    positions: [
      ...topTriangles,
      ...topIslandTriangles,
      ...outerSideTriangles,
      ...cavitySideTriangles,
      ...cavityBottomTriangles,
    ],
    debug: {
      topFaceTriangleCount: topTriangles.length / 3,
      topIslandTriangleCount: topIslandTriangles.length / 3,
      outerSideTriangleCount: outerSideTriangles.length / 3,
      cavitySideTriangleCount: cavitySideTriangles.length / 3,
      cavityBottomTriangleCount: cavityBottomTriangles.length / 3,
    },
  };
}

export function buildFaceStlReplacementPatchWithText(
  face,
  sourceFace,
  font,
  validation,
  faceLabel,
) {
  const plainTriangles = buildPlainFaceTriangles(face);
  const textSettings = normalizeTextSettings(sourceFace?.text);

  if (
    !font ||
    textSettings.content.trim() === "" ||
    Math.abs(textSettings.depth) < EPSILON
  ) {
    return {
      positions: plainTriangles,
      debug: {
        topFaceTriangleCount: plainTriangles.length / 3,
        topIslandTriangleCount: 0,
        cavitySideTriangleCount: 0,
        cavityBottomTriangleCount: 0,
      },
    };
  }

  const basis = createFaceBasis(face);
  if (!basis) {
    validation.warnings.push(
      `${faceLabel} の文字配置基準を作れないため、STL 用置換パッチをスキップしました。`,
    );
    return {
      positions: plainTriangles,
      debug: {
        topFaceTriangleCount: plainTriangles.length / 3,
        topIslandTriangleCount: 0,
        cavitySideTriangleCount: 0,
        cavityBottomTriangleCount: 0,
      },
    };
  }

  const faceContour = ensureWinding(
    face.vertices.map((vertex) => projectPoint(vertex, basis)),
    true,
  );
  const fittedShapes = fitTextShapesToFace(
    font,
    textSettings,
    basis,
    faceContour,
  );
  if (!fittedShapes?.shapes?.length) {
    validation.warnings.push(
      `${faceLabel} の STL 用文字輪郭を作れなかったため、平面パッチへ fallback しました。`,
    );
    return {
      positions: plainTriangles,
      debug: {
        topFaceTriangleCount: plainTriangles.length / 3,
        topIslandTriangleCount: 0,
        cavitySideTriangleCount: 0,
        cavityBottomTriangleCount: 0,
      },
    };
  }

  if (fittedShapes.scaleFactor < 1) {
    validation.warnings.push(
      `${faceLabel} の STL 用文字が面内に収まるよう ${Math.round(fittedShapes.scaleFactor * 100)}% に自動縮小されました。`,
    );
  }

  if (!fittedShapes.fitConfirmed) {
    validation.warnings.push(
      `${faceLabel} の STL 用文字は収まり判定が不安定なため、最小縮尺で処理を継続しました。`,
    );
  }

  const topTriangles = [];
  const topIslandTriangles = [];
  const cavitySideTriangles = [];
  const cavityBottomTriangles = [];
  const embossSideTriangles = [];
  const embossTopTriangles = [];
  const outlineLoops = [];

  for (const shape of fittedShapes.shapes) {
    outlineLoops.push(ensureWinding(shape.contour, false));
  }

  appendTriangles(
    topTriangles,
    triangulateLoop(faceContour, outlineLoops, 0, basis),
  );

  if (textSettings.depth > 0) {
    const cavityDepth = -Math.abs(textSettings.depth);
    for (const shape of fittedShapes.shapes) {
      appendTriangles(
        cavityBottomTriangles,
        triangulateLoop(shape.contour, shape.holes, cavityDepth, basis),
      );
      for (const hole of shape.holes) {
        appendTriangles(
          topIslandTriangles,
          triangulateLoop(ensureWinding(hole, true), [], 0, basis),
        );
      }

      appendLoopWallTriangles(
        cavitySideTriangles,
        ensureWinding(shape.contour, false),
        0,
        cavityDepth,
        basis,
        true,
      );
      for (const hole of shape.holes) {
        appendLoopWallTriangles(
          cavitySideTriangles,
          ensureWinding(hole, true),
          0,
          cavityDepth,
          basis,
          false,
        );
      }
    }
  } else {
    const embossHeight = Math.abs(textSettings.depth);
    for (const shape of fittedShapes.shapes) {
      appendTriangles(
        embossTopTriangles,
        triangulateLoop(shape.contour, shape.holes, embossHeight, basis),
      );
      for (const hole of shape.holes) {
        appendTriangles(
          topIslandTriangles,
          triangulateLoop(ensureWinding(hole, true), [], 0, basis),
        );
      }

      appendLoopWallTriangles(
        embossSideTriangles,
        ensureWinding(shape.contour, false),
        embossHeight,
        0,
        basis,
        false,
      );
      for (const hole of shape.holes) {
        appendLoopWallTriangles(
          embossSideTriangles,
          ensureWinding(hole, true),
          embossHeight,
          0,
          basis,
          true,
        );
      }
    }
  }

  return {
    positions: [
      ...topTriangles,
      ...topIslandTriangles,
      ...cavitySideTriangles,
      ...cavityBottomTriangles,
      ...embossSideTriangles,
      ...embossTopTriangles,
    ],
    debug: {
      topFaceTriangleCount: topTriangles.length / 3,
      topIslandTriangleCount: topIslandTriangles.length / 3,
      cavitySideTriangleCount: cavitySideTriangles.length / 3,
      cavityBottomTriangleCount: cavityBottomTriangles.length / 3,
      embossSideTriangleCount: embossSideTriangles.length / 3,
      embossTopTriangleCount: embossTopTriangles.length / 3,
    },
  };
}
