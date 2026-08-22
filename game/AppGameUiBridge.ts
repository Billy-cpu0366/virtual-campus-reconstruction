import type {
  GameUiHideRequest,
  GameUiPort,
  GameUiShowRequest,
  HideResult,
  ShowResult,
  UserCloseEvent,
} from "../src/content/contract.js";

/** Main-owned bridge that reports modal visibility without owning UI state. */
export class AppGameUiBridge implements GameUiPort {
  private visible = false;
  private destroyed = false;

  constructor(
    private readonly ui: GameUiPort,
    private readonly onVisibility: (visible: boolean) => void,
  ) {}

  show(request: GameUiShowRequest): ShowResult {
    const result = this.ui.show(request);
    if (
      result.status === "shown" ||
      result.status === "already-visible"
    ) {
      this.setVisible(true);
    }
    return result;
  }

  hide(request: GameUiHideRequest): HideResult {
    const result = this.ui.hide(request);
    if (
      result.status === "hidden" ||
      result.status === "already-hidden"
    ) {
      this.setVisible(false);
    }
    return result;
  }

  subscribeUserClose(handler: (event: UserCloseEvent) => void): () => void {
    if (this.destroyed) return () => undefined;
    return this.ui.subscribeUserClose(handler);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      this.ui.destroy();
    } finally {
      this.setVisible(false);
    }
  }

  private setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    try {
      this.onVisibility(visible);
    } catch {
      // App observation cannot change the UI result or break cleanup.
    }
  }
}
