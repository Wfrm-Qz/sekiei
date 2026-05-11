export const TWIN_AXIS_OFFSET_KIND = "axis";
export const TWIN_AXIS_OFFSET_BASIS = "twin-axis";
export const TWIN_AXIS_OFFSET_UNIT = "axis-plane-intercept";

interface TwinAxisOffsetLike {
  kind?: string;
  basis?: string;
  amount?: number;
  unit?: string;
}

interface TwinCrystalWithOffsets {
  offsets?: TwinAxisOffsetLike[];
}

export function isTwinAxisOffset(
  offset: unknown,
): offset is TwinAxisOffsetLike {
  return (
    Boolean(offset) &&
    typeof offset === "object" &&
    !Array.isArray(offset) &&
    (offset as TwinAxisOffsetLike).kind === TWIN_AXIS_OFFSET_KIND &&
    (offset as TwinAxisOffsetLike).basis === TWIN_AXIS_OFFSET_BASIS &&
    (offset as TwinAxisOffsetLike).unit === TWIN_AXIS_OFFSET_UNIT
  );
}

export function getTwinAxisOffsetAmount(
  crystal: TwinCrystalWithOffsets | null | undefined,
) {
  if (!Array.isArray(crystal?.offsets)) {
    return 0;
  }
  return crystal.offsets.reduce((sum, offset) => {
    if (!isTwinAxisOffset(offset)) {
      return sum;
    }
    const amount = Number(offset.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
}

export function setTwinAxisOffsetAmount(
  crystal: TwinCrystalWithOffsets,
  amount: number,
) {
  const nextOffsets = Array.isArray(crystal.offsets)
    ? crystal.offsets.filter((offset) => !isTwinAxisOffset(offset))
    : [];

  if (Number.isFinite(amount) && Math.abs(amount) > 1e-12) {
    nextOffsets.push({
      kind: TWIN_AXIS_OFFSET_KIND,
      basis: TWIN_AXIS_OFFSET_BASIS,
      amount,
      unit: TWIN_AXIS_OFFSET_UNIT,
    });
  }

  crystal.offsets = nextOffsets;
}
