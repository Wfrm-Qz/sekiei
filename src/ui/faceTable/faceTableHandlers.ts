import { createMissingEquivalentFaces } from "../../constants.js";

import { FACE_TEXT_DEFAULTS } from "../../constants.js";
import { normalizeFaceAccentColor } from "../../state/colorHelpers.js";

/**
 * 面一覧テーブル配線をまとめる module。
 *
 * `main.ts` から外しやすいように、DOM event 登録と face 更新ロジックを
 * context 経由で受け取る形にしている。
 *
 * 主に扱う日本語文言:
 * - 面を全削除しますか。
 */

interface TwinFaceTableFaceLike {
  id: string;
  h: number;
  k: number;
  i?: number;
  l: number;
  coefficient: number;
  enabled?: boolean;
  accentColor?: string | null;
  draftEmptyFields?: string[];
  draftGroupKey?: string;
  text?: {
    content?: string;
    fontId?: string;
    fontSize?: number;
    depth?: number;
    offsetU?: number;
    offsetV?: number;
    rotationDeg?: number;
  };
}

interface TwinFaceTableContactLike {
  baseFaceRef?: string | null;
  derivedFaceRef?: string | null;
}

interface TwinFaceTableCrystalLike {
  from?: number;
  contact?: TwinFaceTableContactLike;
}

type EditableFaceIndexField = "h" | "k" | "l";

interface TwinFaceTableMutableParametersLike {
  crystalSystem: string;
  twin: {
    crystals: TwinFaceTableCrystalLike[];
  };
}

interface TwinFaceTableStateLike {
  parameters: TwinFaceTableMutableParametersLike;
  collapsedFaceGroups: Record<string, boolean>;
  faceTextEditorsExpanded: Record<string, boolean>;
  faceSort: {
    field: string;
    direction: string;
  } | null;
}

interface TwinFaceTableElementsLike {
  facesTableHeadRow: HTMLElement;
  facesTableBody: HTMLElement;
  faceMobileToolbar?: HTMLElement | null;
  faceMobileList?: HTMLElement | null;
}

export interface TwinFaceTableHandlersContext {
  state: TwinFaceTableStateLike;
  elements: TwinFaceTableElementsLike;
  emptyDraftFaceFields: string[];
  commitParameters: (
    mutator: (next: TwinFaceTableMutableParametersLike) => void,
  ) => void;
  commitNumericInput: (
    rawValue: string,
    onCommit: (value: number) => void,
  ) => void;
  getEditableCrystalIndex: () => number;
  getEditableFaces: () => TwinFaceTableFaceLike[];
  getTwinCrystalFaces: (
    next: TwinFaceTableMutableParametersLike,
    index: number,
  ) => TwinFaceTableFaceLike[];
  setTwinCrystalFaces: (
    next: TwinFaceTableMutableParametersLike,
    index: number,
    faces: TwinFaceTableFaceLike[],
  ) => void;
  createEmptyDraftFace: (crystalSystem: string) => TwinFaceTableFaceLike;
  normalizeFaceForSystem: (
    face: TwinFaceTableFaceLike,
    crystalSystem: string,
  ) => TwinFaceTableFaceLike;
  getEquivalentFaceGroupKey: (
    face: TwinFaceTableFaceLike,
    crystalSystem: string,
  ) => string;
  getDraftEmptyFields: (face: TwinFaceTableFaceLike | undefined) => string[];
  getNextCoefficientValue: (currentValue: number, direction: number) => number;
  getFaceGroupStateKey: (groupKey: string) => string;
  renderFaceTableHeader: () => void;
  renderFaceRows: () => void;
  confirm: (message: string) => boolean;
  t: (key: string) => string;
}

/** 面一覧テーブルの head/body handler 群を返す。 */
export function createTwinFaceTableHandlers(
  context: TwinFaceTableHandlersContext,
) {
  function isEditableFaceIndexField(
    fieldName: string | undefined,
  ): fieldName is EditableFaceIndexField {
    return fieldName === "h" || fieldName === "k" || fieldName === "l";
  }

  function addFace() {
    context.commitParameters((next) => {
      const crystalIndex = context.getEditableCrystalIndex();
      const editableCrystalFaces = context.getTwinCrystalFaces(
        next,
        crystalIndex,
      );
      const nextFaces = [
        ...editableCrystalFaces,
        context.createEmptyDraftFace(next.crystalSystem),
      ];
      context.setTwinCrystalFaces(next, crystalIndex, nextFaces);
    });
  }

  function clearFaces() {
    if (!context.confirm(context.t("faces.clearConfirm"))) {
      return;
    }

    context.commitParameters((next) => {
      const crystalIndex = context.getEditableCrystalIndex();
      context.setTwinCrystalFaces(next, crystalIndex, []);
      next.twin.crystals = next.twin.crystals.map((crystal, index) => {
        if (index === crystalIndex) {
          return {
            ...crystal,
            contact: {
              ...(crystal.contact ?? {}),
              derivedFaceRef: null,
            },
          };
        }
        const parentIndex = Math.max(
          0,
          Math.min(Number(crystal.from ?? 0), index - 1),
        );
        if (parentIndex !== crystalIndex) {
          return crystal;
        }
        return {
          ...crystal,
          contact: {
            ...(crystal.contact ?? {}),
            baseFaceRef: null,
          },
        };
      });
    });
  }

  function updateFaceTextFieldFromTarget(
    target: HTMLInputElement | HTMLSelectElement,
  ) {
    const row = target.closest("[data-face-id]") as HTMLElement | null;
    const faceId = row?.dataset.faceId;
    const textFieldName = target.dataset.faceTextField;
    if (!faceId || !textFieldName) {
      return false;
    }

    const updateFaceTextField = (resolvedValue: number | string) => {
      context.commitParameters((next) => {
        const crystalIndex = context.getEditableCrystalIndex();
        const updatedFaces = context
          .getTwinCrystalFaces(next, crystalIndex)
          .map((face) =>
            face.id === faceId
              ? {
                  ...face,
                  text: {
                    ...FACE_TEXT_DEFAULTS,
                    ...(face.text ?? {}),
                    [textFieldName]: resolvedValue,
                  },
                }
              : face,
          );
        context.setTwinCrystalFaces(next, crystalIndex, updatedFaces);
      });
    };

    if (textFieldName === "content" || textFieldName === "fontId") {
      updateFaceTextField(target.value);
      return true;
    }

    if (target.value.trim() === "") {
      updateFaceTextField(FACE_TEXT_DEFAULTS[textFieldName]);
      return true;
    }

    context.commitNumericInput(target.value, (value) => {
      updateFaceTextField(value);
    });
    return true;
  }

  /** テーブルヘッダーの add / clear / sort を登録する。 */
  function registerFaceTableHeaderHandlers() {
    context.elements.facesTableHeadRow.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      if (target.id === "app-add-face-button") {
        addFace();
        return;
      }
      if (target.id === "app-clear-faces-button") {
        clearFaces();
        return;
      }
      const sortField = target.dataset.sortField;
      const sortDirection = target.dataset.sortDirection;
      if (!sortField || !sortDirection) {
        return;
      }
      context.state.faceSort = {
        field: sortField,
        direction: sortDirection,
      };
      context.renderFaceTableHeader();
      context.renderFaceRows();
    });

    context.elements.faceMobileToolbar?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      if (target.dataset.mobileFaceAction === "add") {
        addFace();
        return;
      }
      if (target.dataset.mobileFaceAction === "clear") {
        clearFaces();
      }
    });
  }

  /** テーブル body の input/change を登録する。 */
  function registerFaceTableInputHandlers() {
    const registerInputHandlersFor = (container: HTMLElement) => {
      container.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        updateFaceTextFieldFromTarget(target);
      });

      container.addEventListener("change", (event) => {
        const target = event.target;
        if (
          !(
            target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement
          )
        ) {
          return;
        }

        const row = target.closest("[data-face-id]") as HTMLElement | null;
        const faceIndex = Number(row?.dataset.faceIndex);
        const faceId = row?.dataset.faceId;
        const groupKey = row?.dataset.groupKey;
        const groupCollapsed = row?.dataset.groupCollapsed === "true";
        const fieldName = target.dataset.faceField;
        if (!Number.isInteger(faceIndex) || !fieldName || !faceId) {
          return;
        }
        const sourceFace = context
          .getEditableFaces()
          .find((face) => face.id === faceId);
        const draftEmptyFields = context.getDraftEmptyFields(sourceFace);
        if (
          target.dataset.faceTextField &&
          updateFaceTextFieldFromTarget(target)
        ) {
          return;
        }

        if (fieldName === "enabled" && target instanceof HTMLInputElement) {
          const nextEnabled = target.checked;
          context.commitParameters((next) => {
            const crystalIndex = context.getEditableCrystalIndex();
            const updatedFaces = context
              .getTwinCrystalFaces(next, crystalIndex)
              .map((face) =>
                (
                  groupCollapsed
                    ? context.getEquivalentFaceGroupKey(
                        face,
                        next.crystalSystem,
                      ) === groupKey
                    : face.id === faceId
                )
                  ? { ...face, enabled: nextEnabled }
                  : face,
              );
            context.setTwinCrystalFaces(next, crystalIndex, updatedFaces);
          });
          return;
        }

        if (fieldName === "accentColor" && target instanceof HTMLInputElement) {
          const nextAccentColor = normalizeFaceAccentColor(target.value);
          if (!nextAccentColor) {
            return;
          }
          context.commitParameters((next) => {
            const crystalIndex = context.getEditableCrystalIndex();
            const updatedFaces = context
              .getTwinCrystalFaces(next, crystalIndex)
              .map((face) =>
                (
                  groupCollapsed
                    ? context.getEquivalentFaceGroupKey(
                        face,
                        next.crystalSystem,
                      ) === groupKey
                    : face.id === faceId
                )
                  ? { ...face, accentColor: nextAccentColor }
                  : face,
              );
            context.setTwinCrystalFaces(next, crystalIndex, updatedFaces);
          });
          return;
        }

        if (
          target.value.trim() === "" &&
          (draftEmptyFields.length > 0 ||
            typeof sourceFace?.draftGroupKey === "string") &&
          context.emptyDraftFaceFields.includes(fieldName)
        ) {
          context.commitParameters((next) => {
            const crystalIndex = context.getEditableCrystalIndex();
            const updatedFaces = context
              .getTwinCrystalFaces(next, crystalIndex)
              .map((face) =>
                face.id === faceId
                  ? context.normalizeFaceForSystem(
                      {
                        ...face,
                        [fieldName]: 0,
                        enabled: false,
                        draftEmptyFields: Array.from(
                          new Set([
                            ...context.getDraftEmptyFields(face),
                            fieldName,
                          ]),
                        ),
                      },
                      next.crystalSystem,
                    )
                  : face,
              );
            context.setTwinCrystalFaces(next, crystalIndex, updatedFaces);
          });
          return;
        }

        context.commitNumericInput(target.value, (value) => {
          context.commitParameters((next) => {
            const crystalIndex = context.getEditableCrystalIndex();
            const updatedFaces = context
              .getTwinCrystalFaces(next, crystalIndex)
              .map((face) => {
                const remainingDraftFields = context
                  .getDraftEmptyFields(face)
                  .filter((name) => name !== fieldName);
                return (
                  groupCollapsed
                    ? context.getEquivalentFaceGroupKey(
                        face,
                        next.crystalSystem,
                      ) === groupKey
                    : face.id === faceId
                )
                  ? context.normalizeFaceForSystem(
                      {
                        ...face,
                        [fieldName]: value,
                        enabled: remainingDraftFields.length === 0,
                        ...(remainingDraftFields.length > 0
                          ? {
                              draftEmptyFields: remainingDraftFields,
                              draftGroupKey: face.draftGroupKey,
                            }
                          : {
                              draftEmptyFields: undefined,
                              draftGroupKey: undefined,
                            }),
                      },
                      next.crystalSystem,
                    )
                  : face;
              });
            context.setTwinCrystalFaces(next, crystalIndex, updatedFaces);
          });
        });
      });
    };

    registerInputHandlersFor(context.elements.facesTableBody);
    if (context.elements.faceMobileList) {
      registerInputHandlersFor(context.elements.faceMobileList);
    }
  }

  /** テーブル body の button click を登録する。 */
  function registerFaceTableClickHandlers() {
    const registerClickHandlersFor = (container: HTMLElement) => {
      container.addEventListener("mousedown", (event) => {
        const target = event.target;
        if (
          target instanceof HTMLButtonElement &&
          (target.classList.contains("coefficient-spin-button") ||
            target.classList.contains("face-index-spin-button"))
        ) {
          event.preventDefault();
        }
      });

      container.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) {
          return;
        }

        const row = target.closest("[data-face-id]") as HTMLElement | null;
        const faceIndex = Number(row?.dataset.faceIndex);
        const faceId = row?.dataset.faceId;
        const groupKey = row?.dataset.groupKey;
        const groupCollapsed = row?.dataset.groupCollapsed === "true";
        if (!Number.isInteger(faceIndex) || !faceId) {
          return;
        }

        if (target.classList.contains("remove-face-button")) {
          context.commitParameters((next) => {
            const crystalIndex = context.getEditableCrystalIndex();
            const editableCrystalFaces = context.getTwinCrystalFaces(
              next,
              crystalIndex,
            );
            const removedFaceIds = new Set(
              editableCrystalFaces
                .filter((face) =>
                  groupCollapsed
                    ? context.getEquivalentFaceGroupKey(
                        face,
                        next.crystalSystem,
                      ) === groupKey
                    : face.id === faceId,
                )
                .map((face) => face.id),
            );
            const remainingFaces = editableCrystalFaces.filter((face) =>
              groupCollapsed
                ? context.getEquivalentFaceGroupKey(
                    face,
                    next.crystalSystem,
                  ) !== groupKey
                : face.id !== faceId,
            );
            context.setTwinCrystalFaces(next, crystalIndex, remainingFaces);
            next.twin.crystals = next.twin.crystals.map((crystal, index) => {
              if (index === crystalIndex) {
                return {
                  ...crystal,
                  contact: {
                    ...(crystal.contact ?? {}),
                    derivedFaceRef: removedFaceIds.has(
                      crystal.contact?.derivedFaceRef ?? null,
                    )
                      ? (remainingFaces[0]?.id ?? null)
                      : (crystal.contact?.derivedFaceRef ?? null),
                  },
                };
              }
              const parentIndex = Math.max(
                0,
                Math.min(Number(crystal.from ?? 0), index - 1),
              );
              if (parentIndex !== crystalIndex) {
                return crystal;
              }
              const parentFaces = context.getTwinCrystalFaces(
                next,
                parentIndex,
              );
              return {
                ...crystal,
                contact: {
                  ...(crystal.contact ?? {}),
                  baseFaceRef: removedFaceIds.has(
                    crystal.contact?.baseFaceRef ?? null,
                  )
                    ? (parentFaces[0]?.id ?? null)
                    : (crystal.contact?.baseFaceRef ?? null),
                },
              };
            });
          });
          return;
        }

        if (target.classList.contains("equivalent-face-button")) {
          context.commitParameters((next) => {
            const crystalIndex = context.getEditableCrystalIndex();
            const editableCrystalFaces = context.getTwinCrystalFaces(
              next,
              crystalIndex,
            );
            const sourceFace = editableCrystalFaces.find(
              (face) => face.id === faceId,
            );
            if (!sourceFace) {
              return;
            }
            const missingEquivalentFaces = createMissingEquivalentFaces(
              editableCrystalFaces,
              sourceFace,
              next.crystalSystem,
            );
            context.setTwinCrystalFaces(next, crystalIndex, [
              ...editableCrystalFaces,
              ...missingEquivalentFaces,
            ]);
          });
          return;
        }

        if (target.classList.contains("coefficient-spin-button")) {
          const coefficientInput = row.querySelector(
            'input[data-face-field="coefficient"]',
          );
          const currentValue = Number(
            coefficientInput instanceof HTMLInputElement
              ? coefficientInput.value
              : NaN,
          );
          const editableFaces = context.getEditableFaces();
          const sourceFace = editableFaces.find((face) => face.id === faceId);
          const fallbackValue = groupCollapsed
            ? editableFaces.find(
                (face) =>
                  context.getEquivalentFaceGroupKey(
                    face,
                    context.state.parameters.crystalSystem,
                  ) === groupKey,
              )?.coefficient
            : sourceFace?.coefficient;
          const baseValue = Number.isFinite(currentValue)
            ? currentValue
            : Number(fallbackValue ?? 1);
          const direction = target.dataset.spinDirection === "down" ? -1 : 1;
          const nextValue = context.getNextCoefficientValue(
            baseValue,
            direction,
          );
          if (coefficientInput instanceof HTMLInputElement) {
            coefficientInput.value = String(nextValue);
          }
          context.commitParameters((next) => {
            const crystalIndex = context.getEditableCrystalIndex();
            const updatedFaces = context
              .getTwinCrystalFaces(next, crystalIndex)
              .map((face) => {
                const remainingDraftFields = context
                  .getDraftEmptyFields(face)
                  .filter((name) => name !== "coefficient");
                return (
                  groupCollapsed
                    ? context.getEquivalentFaceGroupKey(
                        face,
                        next.crystalSystem,
                      ) === groupKey
                    : face.id === faceId
                )
                  ? context.normalizeFaceForSystem(
                      {
                        ...face,
                        coefficient: nextValue,
                        enabled: remainingDraftFields.length === 0,
                        ...(remainingDraftFields.length > 0
                          ? {
                              draftEmptyFields: remainingDraftFields,
                              draftGroupKey: face.draftGroupKey,
                            }
                          : {
                              draftEmptyFields: undefined,
                              draftGroupKey: undefined,
                            }),
                      },
                      next.crystalSystem,
                    )
                  : face;
              });
            context.setTwinCrystalFaces(next, crystalIndex, updatedFaces);
          });
          return;
        }

        if (target.classList.contains("face-index-spin-button")) {
          const fieldName = target.dataset.faceIndexField;
          if (!isEditableFaceIndexField(fieldName)) {
            return;
          }
          const indexInput = row.querySelector(
            `input[data-face-field="${fieldName}"]`,
          );
          if (
            !(indexInput instanceof HTMLInputElement) ||
            indexInput.disabled ||
            indexInput.readOnly
          ) {
            return;
          }
          const currentValue = Number(indexInput.value);
          const editableFaces = context.getEditableFaces();
          const sourceFace = editableFaces.find((face) => face.id === faceId);
          const fallbackValue = groupCollapsed
            ? editableFaces.find(
                (face) =>
                  context.getEquivalentFaceGroupKey(
                    face,
                    context.state.parameters.crystalSystem,
                  ) === groupKey,
              )?.[fieldName]
            : sourceFace?.[fieldName];
          const baseValue = Number.isFinite(currentValue)
            ? currentValue
            : Number(fallbackValue ?? 0);
          const direction = target.dataset.spinDirection === "down" ? -1 : 1;
          indexInput.value = String(baseValue + direction);
          indexInput.dispatchEvent(new Event("change", { bubbles: true }));
          return;
        }

        if (target.classList.contains("face-group-toggle")) {
          const toggleKey = target.dataset.groupKey;
          if (!toggleKey) {
            return;
          }
          const stateKey = context.getFaceGroupStateKey(toggleKey);
          const currentCollapsed = row?.dataset.groupCollapsed === "true";
          context.state.collapsedFaceGroups = {
            ...context.state.collapsedFaceGroups,
            [stateKey]: !currentCollapsed,
          };
          context.renderFaceRows();
          return;
        }

        if (target.classList.contains("toggle-face-text-button")) {
          context.state.faceTextEditorsExpanded = {
            ...context.state.faceTextEditorsExpanded,
            [faceId]: !context.state.faceTextEditorsExpanded[faceId],
          };
          context.renderFaceRows();
        }
      });
    };

    registerClickHandlersFor(context.elements.facesTableBody);
    if (context.elements.faceMobileList) {
      registerClickHandlersFor(context.elements.faceMobileList);
    }
  }

  return {
    registerFaceTableHeaderHandlers,
    registerFaceTableInputHandlers,
    registerFaceTableClickHandlers,
  };
}
