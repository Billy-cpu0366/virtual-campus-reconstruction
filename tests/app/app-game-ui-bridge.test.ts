import { describe, expect, it } from "vitest";

import { AppGameUiBridge } from "../../game/AppGameUiBridge.js";
import type {
  GameUiHideRequest,
  GameUiPort,
  GameUiShowRequest,
  HideResult,
  ShowResult,
  UserCloseEvent,
} from "../../src/content/contract.js";

class FakeUi implements GameUiPort {
  showResult: ShowResult = { status: "shown" };
  hideResult: HideResult = { status: "hidden" };
  destroyCalls = 0;

  show(_request: GameUiShowRequest): ShowResult {
    return this.showResult;
  }

  hide(_request: GameUiHideRequest): HideResult {
    return this.hideResult;
  }

  subscribeUserClose(_handler: (event: UserCloseEvent) => void): () => void {
    return () => undefined;
  }

  destroy(): void {
    this.destroyCalls += 1;
  }
}

const showRequest: GameUiShowRequest = {
  menuId: "about",
  residenceId: "residence-1",
  payload: { menuId: "about", title: "About", body: ["Body"] },
  presentation: { backdrop: "none" },
};

const hideRequest: GameUiHideRequest = {
  menuId: "about",
  residenceId: "residence-1",
  reason: "leave",
};

describe("AppGameUiBridge", () => {
  it("同步成功呈现与隐藏，但替换和重复调用不重复发状态", () => {
    const ui = new FakeUi();
    const states: boolean[] = [];
    const bridge = new AppGameUiBridge(ui, (visible) => states.push(visible));

    expect(bridge.show(showRequest)).toEqual({ status: "shown" });
    ui.showResult = { status: "already-visible" };
    bridge.show(showRequest);
    expect(states).toEqual([true]);

    expect(bridge.hide(hideRequest)).toEqual({ status: "hidden" });
    ui.hideResult = { status: "already-hidden" };
    bridge.hide(hideRequest);
    expect(states).toEqual([true, false]);
  });

  it("失败不伪造状态，destroy先销UI再收敛可见状态且幂等", () => {
    const ui = new FakeUi();
    const states: boolean[] = [];
    const bridge = new AppGameUiBridge(ui, (visible) => states.push(visible));

    ui.showResult = { status: "invalid-payload" };
    bridge.show(showRequest);
    ui.hideResult = { status: "target-mismatch" };
    bridge.hide(hideRequest);
    expect(states).toEqual([]);

    ui.showResult = { status: "shown" };
    bridge.show(showRequest);
    bridge.destroy();
    bridge.destroy();
    expect(states).toEqual([true, false]);
    expect(ui.destroyCalls).toBe(1);
  });
});
