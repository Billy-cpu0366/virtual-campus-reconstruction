import { describe, expect, it } from "vitest";
import { createDiskConfigSource } from "../../config/工具/config-source-from-disk.js";
import { loadInteractConfigs } from "../../config/骨架/03-内容线/SYS-INTERACT/逻辑/index.js";

describe("SYS-INTERACT 配置接线", () => {
  it("11 个菜单内容、可见菜单、交互行为和弹窗高度来自配置", async () => {
    const interact = await loadInteractConfigs(createDiskConfigSource());
    expect(Object.keys(interact.content)).toHaveLength(11);
    expect(interact.visibleMenuIds).toEqual([
      "about", "projects", "memo1", "memo2", "memo3", "memo4", "memo5", "memo6",
    ]);
    expect(interact.content.about.title).toBe("About me");
    expect(interact.content.about.sections?.[0]?.image?.src)
      .toBe("assets/images/peter-oravec.webp");
    expect(interact.content.cv.body).toEqual([
      "GAMO", "SCR", "Kremsa Digital", "Bethereum", "VUB Bank",
    ]);
    expect(interact.behavior).toEqual({
      pauseGame: true,
      hideOnLeave: true,
      suppressAfterUserClose: true,
    });
    expect(interact.modal).toEqual({
      desktopMaxHeightRatio: 0.9,
      mobileMaxHeightRatio: 0.7,
    });
  });

  it("set1 的 About 标题可直接换皮", async () => {
    const interact = await loadInteractConfigs(createDiskConfigSource("config/set1"));
    expect(interact.content.about.title).toBe("About me · set1");
  });
});
