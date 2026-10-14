import {
  type ContentMenuId,
} from "./contract.js";

export const VISIBLE_CONTENT_MENU_IDS = Object.freeze([
  "about",
  "projects",
  "memo1",
  "memo2",
  "memo3",
  "memo4",
  "memo5",
  "memo6",
] as const);

export type VisibleContentMenuId =
  (typeof VISIBLE_CONTENT_MENU_IDS)[number];

export interface ContentResourceReceipt {
  readonly src: string;
  readonly sourceUrl: string;
  readonly localPath: string;
  readonly status: 200;
  readonly sha256: string;
}

const rawContentResourceReceipts = [
  {
    src: "assets/images/peter-oravec.webp",
    sourceUrl: "https://peteroravec.com/assets/images/peter-oravec.webp",
    localPath: "mirror/assets/images/peter-oravec.webp",
    status: 200,
    sha256: "8140c740e53c619f6c2bbf67bc34955dfa4aa5d73e091ecbe020dd03b29c8f36",
  },
  {
    src: "assets/images/portfolio/portfolio-eutxo.webp",
    sourceUrl:
      "https://peteroravec.com/assets/images/portfolio/portfolio-eutxo.webp",
    localPath: "mirror/assets/images/portfolio/portfolio-eutxo.webp",
    status: 200,
    sha256: "96b1325b7ad2b6bb5cbbdd83f0b99cf6942ebb07f94d082325bfb6d4110e7f45",
  },
  {
    src: "assets/images/portfolio/portfolio-angularsk.webp",
    sourceUrl:
      "https://peteroravec.com/assets/images/portfolio/portfolio-angularsk.webp",
    localPath: "mirror/assets/images/portfolio/portfolio-angularsk.webp",
    status: 200,
    sha256: "fd9673327a68613c3a055511c06db5c7bd415e6ff31cedf22b739bc99e39a744",
  },
  {
    src: "assets/images/portfolio/peteroravec-v1.webp",
    sourceUrl:
      "https://peteroravec.com/assets/images/portfolio/peteroravec-v1.webp",
    localPath: "mirror/assets/images/portfolio/peteroravec-v1.webp",
    status: 200,
    sha256: "cdfaf1d557e25f9997ec9801703866774a489fb92c338a627af674d2e42ba36a",
  },
  {
    src: "/assets/images/cards/card1_base.webp",
    sourceUrl: "https://peteroravec.com/assets/images/cards/card1_base.webp",
    localPath: "mirror/assets/images/cards/card1_base.webp",
    status: 200,
    sha256: "c0c6f191d254af1c2a5ab6453d62f1289640d79ef5964c37286a6febe0f09c9a",
  },
  {
    src: "/assets/images/cards/card2_base.webp",
    sourceUrl: "https://peteroravec.com/assets/images/cards/card2_base.webp",
    localPath: "mirror/assets/images/cards/card2_base.webp",
    status: 200,
    sha256: "90adb21a28b2a2f6a4b132a1b9e66c41c141b5f3281af243260d78130ab30353",
  },
  {
    src: "/assets/images/cards/card3_base.webp",
    sourceUrl: "https://peteroravec.com/assets/images/cards/card3_base.webp",
    localPath: "mirror/assets/images/cards/card3_base.webp",
    status: 200,
    sha256: "8c707941024514946d7eb1ef36328b8b25ff102e2a5c07d045d065f71c9bf657",
  },
  {
    src: "/assets/images/cards/card4_base.webp",
    sourceUrl: "https://peteroravec.com/assets/images/cards/card4_base.webp",
    localPath: "mirror/assets/images/cards/card4_base.webp",
    status: 200,
    sha256: "d334a184ddbe7adebc1d8c9c15a8cdfe346a54de00da01ab2e0e9709a36ed0c8",
  },
  {
    src: "/assets/images/cards/card5_base.webp",
    sourceUrl: "https://peteroravec.com/assets/images/cards/card5_base.webp",
    localPath: "mirror/assets/images/cards/card5_base.webp",
    status: 200,
    sha256: "4e82c2709561ef3dc37c0852098ec6fba134f411c2cd6e7df315e75184f24293",
  },
  {
    src: "/assets/images/cards/card6_base.webp",
    sourceUrl: "https://peteroravec.com/assets/images/cards/card6_base.webp",
    localPath: "mirror/assets/images/cards/card6_base.webp",
    status: 200,
    sha256: "c825e9cf2fe9eece0250853f94c3ed3ead33bbafb40a7666fda65bac372cf38e",
  },
] as const satisfies readonly ContentResourceReceipt[];

export const CONTENT_RESOURCE_RECEIPTS: readonly ContentResourceReceipt[] =
  Object.freeze(
    rawContentResourceReceipts.map((receipt) => Object.freeze({ ...receipt })),
  );

const RESOURCE_BY_SRC = new Map(
  CONTENT_RESOURCE_RECEIPTS.map((receipt) => [receipt.src, receipt] as const),
);

export function getContentResourceReceipt(
  src: string,
): ContentResourceReceipt | undefined {
  return RESOURCE_BY_SRC.get(src);
}

export function isVisibleContentMenuId(
  menuId: ContentMenuId,
): menuId is VisibleContentMenuId {
  return (VISIBLE_CONTENT_MENU_IDS as readonly string[]).includes(menuId);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value;
}
export interface Memo6DiscoveryGuide {
  readonly menuId: "memo6";
  readonly markerId: "memo6";
  readonly start: { readonly x: 1088; readonly y: 304 };
  readonly target: { readonly x: 496; readonly y: 176 };
  readonly candidateRoute: readonly [
    { readonly direction: "left"; readonly tiles: 36 },
    { readonly direction: "up"; readonly tiles: 7 },
  ];
  readonly candidateEnd: { readonly x: 512; readonly y: 192 };
  readonly interactionDistancePx: 30;
  readonly policy: {
    readonly autoTeleport: false;
    readonly autoOpenModal: false;
    readonly markVisited: false;
  };
}

export const MEMO6_DISCOVERY_GUIDE: Memo6DiscoveryGuide = deepFreeze({
  menuId: "memo6",
  markerId: "memo6",
  start: { x: 1088, y: 304 },
  target: { x: 496, y: 176 },
  candidateRoute: [
    { direction: "left", tiles: 36 },
    { direction: "up", tiles: 7 },
  ],
  candidateEnd: { x: 512, y: 192 },
  interactionDistancePx: 30,
  policy: {
    autoTeleport: false,
    autoOpenModal: false,
    markVisited: false,
  },
});

export const CONTENT_REGISTRY_RESOURCE_RECEIPTS = CONTENT_RESOURCE_RECEIPTS;
