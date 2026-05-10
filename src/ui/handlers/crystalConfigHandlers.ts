import {
  applyCrystalSystemConstraints,
  createDefaultFacesForSystem,
  normalizeFaceForSystem,
} from "../../constants.js";
import {
  getTwinCrystal,
  getTwinCrystalFaces,
  getTwinCrystals,
  twinRuleTypeForTwinType,
} from "../../state/stateHelpers.js";
import { setTwinAxisOffsetAmount } from "../../domain/penetrationOffsets.js";
import type { TwinStlSplitSettings } from "../../state/stlSplitSettings.js";

/**
 * 結晶設定フォームと結晶タブ操作の event handler をまとめる module。
 *
 * 結晶系、軸長、角度、双晶則、接触面、結晶タブの配線は UI 由来の責務としては
 * まとまっている一方で、parameter 更新や active crystal の切替が複雑なので、
 * entry 側には登録順だけを残して、ここでは DOM 配線を集約する。
 */

interface TwinCrystalConfigHandlersStateLike {
  parameters: {
    crystalSystem: string;
    sizeMm: number;
    axes: Record<string, number>;
    angles: Record<string, number>;
    twin: {
      crystals: {
        id?: string | null;
        accentColor?: string | null;
        faces?: Record<string, unknown>[];
        twinType?: string;
        ruleType?: string;
        plane?: Record<string, number>;
        axis?: Record<string, number>;
        rotationAngleDeg?: number;
        offsets?: {
          kind?: string;
          basis?: string;
          amount?: number;
          unit?: string;
        }[];
        from?: number;
        contact?: {
          baseFaceRef?: string | null;
          derivedFaceRef?: string | null;
          referenceAxisLabel?: string | null;
        } | null;
      }[];
    };
    faces: Record<string, unknown>[];
  };
  stlSplit: TwinStlSplitSettings;
  activeFaceCrystalIndex: number;
  pendingPreviewRefit?: boolean;
}

interface TwinCrystalConfigHandlersElementsLike {
  crystalSystemSelect: HTMLSelectElement;
  sizeInput: HTMLInputElement;
  stlSplitEnabledInput: HTMLInputElement;
  stlSplitPlaneInputs: {
    h: HTMLInputElement;
    k: HTMLInputElement;
    i: HTMLInputElement;
    l: HTMLInputElement;
  };
  axisInputs: Record<string, HTMLInputElement>;
  angleInputs: Record<string, HTMLInputElement>;
  twinTypeSelect: HTMLSelectElement;
  twinRuleInputs: Record<string, HTMLInputElement>;
  rotationAngleInput: HTMLInputElement;
  axisOffsetInput: HTMLInputElement;
  fromCrystalSelect: HTMLSelectElement;
  baseFaceRefSelect: HTMLSelectElement;
  derivedFaceRefSelect: HTMLSelectElement;
  contactReferenceAxisSelect: HTMLSelectElement;
  faceCrystalTabsContainer: HTMLElement;
  tabMenuPopover: HTMLElement;
}

export interface TwinCrystalConfigHandlersContext {
  state: TwinCrystalConfigHandlersStateLike;
  elements: TwinCrystalConfigHandlersElementsLike;
  commitNumericInput: (
    rawValue: string,
    onCommit: (value: number) => void,
  ) => void;
  commitParameters: (
    mutator: (next: TwinCrystalConfigHandlersStateLike["parameters"]) => void,
  ) => void;
  commitStlSplit: (mutator: (next: TwinStlSplitSettings) => void) => void;
  getActiveCrystalIndex: () => number;
  renderFormValues: () => void;
  syncPreview: () => void;
  updateCrystalAccentColor: (crystalIndex: number, accentColor: string) => void;
  appendDerivedCrystal: (
    next: TwinCrystalConfigHandlersStateLike["parameters"],
    sourceIndex: number,
    sourceFaces: Record<string, unknown>[],
  ) => void;
  deleteCrystalAtIndex: (index: number) => void;
  toggleTabMenuPopover: (
    trigger: HTMLButtonElement,
    crystalIndex: number,
  ) => void;
  closeTabMenuPopover: () => void;
  closeHeaderSaveMenus: () => void;
}

/** 結晶設定フォームと結晶タブ操作の登録関数群を返す。 */
export function createTwinCrystalConfigHandlers(
  context: TwinCrystalConfigHandlersContext,
) {
  /** 結晶系、軸長、角度、双晶則、接触面 selector の handler を登録する。 */
  function registerCrystalConfigHandlers() {
    context.elements.crystalSystemSelect.addEventListener("change", () => {
      context.commitParameters((next) => {
        next.crystalSystem = context.elements.crystalSystemSelect.value;
        next.faces =
          next.faces.length > 0
            ? next.faces.map((face) =>
                normalizeFaceForSystem(face, next.crystalSystem),
              )
            : createDefaultFacesForSystem(next.crystalSystem);
        next.twin.crystals = next.twin.crystals.map((crystal, index) => ({
          ...crystal,
          faces: (crystal.faces?.length > 0
            ? crystal.faces
            : index === 0
              ? next.faces
              : (next.twin.crystals[0]?.faces ?? next.faces)
          ).map((face) => normalizeFaceForSystem(face, next.crystalSystem)),
        }));
        const constrained = applyCrystalSystemConstraints(next);
        next.axes = constrained.axes;
        next.angles = constrained.angles;
      });
    });

    context.elements.sizeInput.addEventListener("change", () => {
      context.commitNumericInput(context.elements.sizeInput.value, (value) => {
        context.commitParameters((next) => {
          next.sizeMm = value;
        });
      });
    });

    context.elements.stlSplitEnabledInput.addEventListener("change", () => {
      context.commitStlSplit((next) => {
        next.enabled = context.elements.stlSplitEnabledInput.checked;
      });
    });

    for (const indexName of ["h", "k", "i", "l"] as const) {
      context.elements.stlSplitPlaneInputs[indexName].addEventListener(
        "change",
        () => {
          context.commitNumericInput(
            context.elements.stlSplitPlaneInputs[indexName].value,
            (value) => {
              context.commitStlSplit((splitNext) => {
                splitNext.plane[indexName] = value;
              });
            },
          );
        },
      );
    }

    for (const axisName of ["a", "b", "c"]) {
      context.elements.axisInputs[axisName].addEventListener("change", () => {
        context.commitNumericInput(
          context.elements.axisInputs[axisName].value,
          (value) => {
            context.commitParameters((next) => {
              next.axes[axisName] = value;
              const constrained = applyCrystalSystemConstraints(next);
              next.axes = constrained.axes;
              next.angles = constrained.angles;
            });
          },
        );
      });
    }

    for (const angleName of ["alpha", "beta", "gamma"]) {
      context.elements.angleInputs[angleName].addEventListener("change", () => {
        context.commitNumericInput(
          context.elements.angleInputs[angleName].value,
          (value) => {
            context.commitParameters((next) => {
              next.angles[angleName] = value;
              const constrained = applyCrystalSystemConstraints(next);
              next.axes = constrained.axes;
              next.angles = constrained.angles;
            });
          },
        );
      });
    }

    context.elements.twinTypeSelect.addEventListener("change", () => {
      context.commitParameters((next) => {
        const activeCrystal = getTwinCrystal(
          next,
          context.getActiveCrystalIndex(),
        );
        if (!activeCrystal || context.getActiveCrystalIndex() === 0) {
          return;
        }
        activeCrystal.twinType = context.elements.twinTypeSelect.value;
        activeCrystal.ruleType = twinRuleTypeForTwinType(
          activeCrystal.twinType,
        );
      });
    });

    for (const indexName of ["h", "k", "l"]) {
      context.elements.twinRuleInputs[indexName].addEventListener(
        "change",
        () => {
          context.commitNumericInput(
            context.elements.twinRuleInputs[indexName].value,
            (value) => {
              context.commitParameters((next) => {
                const activeCrystal = getTwinCrystal(
                  next,
                  context.getActiveCrystalIndex(),
                );
                if (!activeCrystal || context.getActiveCrystalIndex() === 0) {
                  return;
                }
                const target =
                  twinRuleTypeForTwinType(activeCrystal.twinType) === "axis"
                    ? activeCrystal.axis
                    : activeCrystal.plane;
                target[indexName] = value;
              });
            },
          );
        },
      );
    }

    context.elements.rotationAngleInput.addEventListener("change", () => {
      context.commitNumericInput(
        context.elements.rotationAngleInput.value,
        (value) => {
          context.commitParameters((next) => {
            const activeCrystal = getTwinCrystal(
              next,
              context.getActiveCrystalIndex(),
            );
            if (!activeCrystal || context.getActiveCrystalIndex() === 0) {
              return;
            }
            activeCrystal.rotationAngleDeg = value;
          });
        },
      );
    });

    context.elements.axisOffsetInput.addEventListener("change", () => {
      context.commitNumericInput(
        context.elements.axisOffsetInput.value,
        (value) => {
          context.commitParameters((next) => {
            const activeCrystal = getTwinCrystal(
              next,
              context.getActiveCrystalIndex(),
            );
            if (
              !activeCrystal ||
              context.getActiveCrystalIndex() === 0 ||
              activeCrystal.twinType !== "penetration"
            ) {
              return;
            }
            setTwinAxisOffsetAmount(activeCrystal, value);
          });
          context.state.pendingPreviewRefit = true;
        },
      );
    });

    context.elements.fromCrystalSelect.addEventListener("change", () => {
      context.commitParameters((next) => {
        const activeIndex = context.getActiveCrystalIndex();
        const activeCrystal = getTwinCrystal(next, activeIndex);
        if (!activeCrystal || activeIndex === 0) {
          return;
        }
        activeCrystal.from = Math.max(
          0,
          Math.min(
            Number(context.elements.fromCrystalSelect.value) || 0,
            activeIndex - 1,
          ),
        );
      });
    });

    context.elements.baseFaceRefSelect.addEventListener("change", () => {
      context.commitParameters((next) => {
        const activeCrystal = getTwinCrystal(
          next,
          context.getActiveCrystalIndex(),
        );
        if (!activeCrystal || context.getActiveCrystalIndex() === 0) {
          return;
        }
        activeCrystal.contact = {
          ...(activeCrystal.contact ?? {}),
          baseFaceRef: context.elements.baseFaceRefSelect.value || null,
        };
      });
    });

    context.elements.derivedFaceRefSelect.addEventListener("change", () => {
      context.commitParameters((next) => {
        const activeCrystal = getTwinCrystal(
          next,
          context.getActiveCrystalIndex(),
        );
        if (!activeCrystal || context.getActiveCrystalIndex() === 0) {
          return;
        }
        activeCrystal.contact = {
          ...(activeCrystal.contact ?? {}),
          derivedFaceRef: context.elements.derivedFaceRefSelect.value || null,
        };
      });
    });

    context.elements.contactReferenceAxisSelect.addEventListener(
      "change",
      () => {
        context.commitParameters((next) => {
          const activeCrystal = getTwinCrystal(
            next,
            context.getActiveCrystalIndex(),
          );
          if (!activeCrystal || context.getActiveCrystalIndex() === 0) {
            return;
          }
          activeCrystal.contact = {
            ...(activeCrystal.contact ?? {}),
            referenceAxisLabel:
              context.elements.contactReferenceAxisSelect.value || null,
          };
        });
      },
    );
  }

  /** 結晶タブの切替、複製、削除、タブメニュー開閉を登録する。 */
  function registerCrystalTabHandlers() {
    context.elements.faceCrystalTabsContainer.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        if (
          target instanceof HTMLButtonElement &&
          target.classList.contains("crystal-tab-menu-trigger")
        ) {
          const crystalIndex = Number(target.dataset.crystalMenuIndex);
          if (!Number.isInteger(crystalIndex)) {
            return;
          }
          context.toggleTabMenuPopover(target, crystalIndex);
          return;
        }
        if (!(target instanceof HTMLButtonElement)) {
          return;
        }
        if (target.id === "app-add-crystal-tab") {
          context.commitParameters((next) => {
            const crystals = Array.isArray(next.twin.crystals)
              ? next.twin.crystals
              : [];
            const activeIndex = context.getActiveCrystalIndex();
            const sourceIndex = Math.max(
              0,
              Math.min(activeIndex, crystals.length - 1),
            );
            const sourceFaces = structuredClone(
              getTwinCrystalFaces(next, sourceIndex),
            );
            context.appendDerivedCrystal(next, sourceIndex, sourceFaces);
          });
          context.state.activeFaceCrystalIndex = Math.max(
            0,
            getTwinCrystals(context.state.parameters).length - 1,
          );
          context.renderFormValues();
          context.syncPreview();
          return;
        }

        const crystalIndex = Number(target.dataset.crystalIndex);
        if (!Number.isInteger(crystalIndex)) {
          return;
        }
        context.state.activeFaceCrystalIndex = crystalIndex;
        context.renderFormValues();
      },
    );

    context.elements.tabMenuPopover.addEventListener("click", (event) => {
      const target = event.target;
      if (
        !(target instanceof HTMLButtonElement) ||
        !target.classList.contains("crystal-tab-menu-action")
      ) {
        return;
      }
      const crystalIndex = Number(target.dataset.crystalIndex);
      const action = target.dataset.tabAction;
      if (!Number.isInteger(crystalIndex) || !action) {
        return;
      }
      if (action === "delete") {
        context.closeTabMenuPopover();
        context.deleteCrystalAtIndex(crystalIndex);
        return;
      }
      if (action === "duplicate") {
        context.closeTabMenuPopover();
        context.commitParameters((next) => {
          const sourceFaces = structuredClone(
            getTwinCrystalFaces(next, crystalIndex),
          );
          context.appendDerivedCrystal(next, crystalIndex, sourceFaces);
        });
        context.state.activeFaceCrystalIndex = Math.max(
          0,
          getTwinCrystals(context.state.parameters).length - 1,
        );
        context.renderFormValues();
        context.syncPreview();
      }
    });

    context.elements.tabMenuPopover.addEventListener("input", (event) => {
      const target = event.target;
      if (
        !(target instanceof HTMLInputElement) ||
        target.type !== "color" ||
        !target.dataset.crystalColorIndex
      ) {
        return;
      }
      const crystalIndex = Number(target.dataset.crystalColorIndex);
      if (!Number.isInteger(crystalIndex) || crystalIndex < 0) {
        return;
      }
      context.updateCrystalAccentColor(crystalIndex, target.value);
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        context.elements.tabMenuPopover.contains(target) ||
        context.elements.faceCrystalTabsContainer.contains(target)
      ) {
        return;
      }
      context.closeTabMenuPopover();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        context.closeTabMenuPopover();
        context.closeHeaderSaveMenus();
      }
    });
  }

  return {
    registerCrystalConfigHandlers,
    registerCrystalTabHandlers,
  };
}
