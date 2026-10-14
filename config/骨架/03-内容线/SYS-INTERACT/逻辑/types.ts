import type {
  ContentMenuId,
  GameUiContentPayload,
} from "../../../../../src/content/contract.js";

export interface InteractConfigs {
  readonly visibleMenuIds: readonly ContentMenuId[];
  readonly content: Readonly<Record<ContentMenuId, GameUiContentPayload>>;
  readonly behavior: {
    readonly pauseGame: boolean;
    readonly hideOnLeave: boolean;
    readonly suppressAfterUserClose: boolean;
  };
  readonly modal: {
    readonly desktopMaxHeightRatio: number;
    readonly mobileMaxHeightRatio: number;
  };
}
