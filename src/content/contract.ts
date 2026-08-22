// Shared content contracts owned by Main. Runtime behavior belongs elsewhere.

export type ContentMenuId =
  | "about"
  | "cv"
  | "projects"
  | "contact"
  | "tech"
  | "memo1"
  | "memo2"
  | "memo3"
  | "memo4"
  | "memo5"
  | "memo6";

export const CONTENT_MENU_IDS: readonly ContentMenuId[] = Object.freeze([
  "about",
  "cv",
  "projects",
  "contact",
  "tech",
  "memo1",
  "memo2",
  "memo3",
  "memo4",
  "memo5",
  "memo6",
]);

export type ZoneResidencePhase = "enter" | "leave";

export interface ZoneResidenceEvent {
  readonly markerId: string;
  readonly menuId: ContentMenuId;
  readonly residenceId: string;
  readonly phase: ZoneResidencePhase;
}

export interface InteractionVisitReceipt {
  readonly markerId: string;
  readonly residenceId: string;
  readonly menuId: ContentMenuId;
}

export interface GameUiContentImage {
  readonly src: string;
  readonly alt: string;
  readonly fallbackText: string;
}

export interface GameUiContentLink {
  readonly label: string;
  readonly href: string;
}

export interface GameUiContentSection {
  readonly heading?: string;
  readonly paragraphs?: readonly string[];
  readonly image?: GameUiContentImage;
  readonly links?: readonly GameUiContentLink[];
  readonly tags?: readonly string[];
}

export interface GameUiContentPayload {
  readonly menuId: ContentMenuId;
  readonly title: string;
  readonly body: readonly string[];
  readonly sections?: readonly GameUiContentSection[];
  // These optional fields allow the resolver payload to remain opaque while
  // keeping the residence identity owned by the show request.
  readonly residenceId?: string;
  readonly presentation?: GameUiPresentation;
}

export type ContentPayload = GameUiContentPayload;

export type GameUiBackdrop = "none" | "global";

export interface GameUiPresentation {
  readonly backdrop: GameUiBackdrop;
}

export interface GameUiShowRequest {
  readonly menuId: ContentMenuId;
  readonly residenceId: string;
  readonly payload: GameUiContentPayload;
  readonly presentation: GameUiPresentation;
}

export type ShowRequest = GameUiShowRequest;

export interface GameUiHideRequest {
  readonly menuId: ContentMenuId;
  readonly residenceId: string;
  readonly reason: "user-close" | "leave" | "replace" | "shutdown";
}

export type HideRequest = GameUiHideRequest;

export type UserCloseSource = "close-button" | "backdrop";

export interface UserCloseEvent {
  readonly menuId: ContentMenuId;
  readonly residenceId: string;
  readonly source: UserCloseSource;
}

export type ShowResult =
  | { readonly status: "shown" }
  | { readonly status: "already-visible" }
  | { readonly status: "missing-target" }
  | { readonly status: "invalid-payload" }
  | { readonly status: "destroyed" };

export type HideResult =
  | { readonly status: "hidden" }
  | { readonly status: "already-hidden" }
  | { readonly status: "target-mismatch" }
  | { readonly status: "destroyed" };

export interface GameUiPort {
  show(request: GameUiShowRequest): ShowResult;
  hide(request: GameUiHideRequest): HideResult;
  destroy(): void;
  subscribeUserClose(handler: (event: UserCloseEvent) => void): () => void;
}

export type ContentResolveResult =
  | { readonly status: "resolved"; readonly payload: GameUiContentPayload }
  | { readonly status: "missing" }
  | { readonly status: "invalid" };

export interface ContentResolverPort {
  resolve(menuId: ContentMenuId): ContentResolveResult;
}

export type GameplayControlLeaseReason =
  | "modal-open"
  | "camera-tour"
  | "entry-transition";

declare const gameplayControlLeaseTokenBrand: unique symbol;

export type GameplayControlLeaseToken = {
  readonly [gameplayControlLeaseTokenBrand]: "GameplayControlLeaseToken";
};

export interface GameplayControlLeasePort {
  acquire(reason: GameplayControlLeaseReason): GameplayControlLeaseAcquireResult;
  release(token: GameplayControlLeaseToken): GameplayControlLeaseReleaseResult;
  shutdown(): GameplayControlLeaseShutdownResult;
}

export type GameplayControlLeaseAcquireResult =
  | { readonly ok: true; readonly token: GameplayControlLeaseToken }
  | {
      readonly ok: false;
      readonly reason: "shutdown" | "disable-failed";
    };

export type GameplayControlLeaseReleaseResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "unknown-token"
        | "stale-token"
        | "enable-failed"
        | "shutdown";
    };

export type GameplayControlLeaseShutdownResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "disable-failed" };

export interface GameplayControlLeaseEffects {
  readonly disableControls: () => void | boolean;
  readonly enableControls: () => void | boolean;
}
