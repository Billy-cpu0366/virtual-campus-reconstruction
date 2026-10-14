import { CONTENT_MENU_IDS } from "../../../../../src/content/contract.js";
import type { Spec } from "../../../公共/validate.js";

const contentSection: Spec = {
  kind: "object",
  fields: {
    heading: { kind: "string", optional: true },
    paragraphs: { kind: "array", of: { kind: "string" }, optional: true },
    image: { kind: "object", fields: {
      src: { kind: "string" },
      alt: { kind: "string" },
      fallbackText: { kind: "string" },
    }, optional: true },
    links: { kind: "array", of: { kind: "object", fields: {
      label: { kind: "string" },
      href: { kind: "string" },
    } }, optional: true },
    tags: { kind: "array", of: { kind: "string" }, optional: true },
  },
};

const contentEntry: Spec = {
  kind: "object",
  fields: {
    title: { kind: "string" },
    body: { kind: "array", of: { kind: "string" } },
    sections: { kind: "array", of: contentSection, optional: true },
  },
};

const contentFields = Object.fromEntries(
  CONTENT_MENU_IDS.map((menuId) => [menuId, contentEntry]),
);

export const INTERACT_SHAPES = {
  "03-内容线/SYS-INTERACT/数据/interact-config.json": {
    kind: "object",
    fields: {
      visibleMenuIds: { kind: "array", of: {
        kind: "string",
        oneOf: CONTENT_MENU_IDS,
      } },
      content: { kind: "object", fields: contentFields },
      behavior: { kind: "object", fields: {
        pauseGame: { kind: "boolean" },
        hideOnLeave: { kind: "boolean" },
        suppressAfterUserClose: { kind: "boolean" },
      } },
      modal: { kind: "object", fields: {
        desktopMaxHeightRatio: { kind: "number", unit: "ratio" },
        mobileMaxHeightRatio: { kind: "number", unit: "ratio" },
      } },
    },
  },
} as const satisfies Record<string, Spec>;

export type InteractConfigKey = keyof typeof INTERACT_SHAPES;
