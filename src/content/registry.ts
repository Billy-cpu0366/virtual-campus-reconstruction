import {
  type ContentMenuId,
  type GameUiContentPayload,
  type GameUiContentSection,
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

const aboutSections: readonly GameUiContentSection[] = [
  {
    heading: "Peter Oravec",
    paragraphs: ["Front-end & MEAN Stack developer"],
    image: {
      src: "assets/images/peter-oravec.webp",
      alt: "Peter Oravec CV photo",
      fallbackText: "Peter Oravec photo unavailable.",
    },
    links: [
      {
        label: "LinkedIn",
        href: "https://www.linkedin.com/in/peteroravec",
      },
    ],
  },
  {
    heading: "Bridging the Gap Between Design and Code",
    paragraphs: [
      "I'm Peter Oravec, a creative web developer with over 19 years of experience, currently based in Bratislava, Slovakia.",
      "My primary focus is on Front-End, JavaScript and Angular, but I also have deep experience as a full-stack developer, especially in the MEAN stack (MongoDB, Express, Angular, Node.js).",
    ],
  },
  {
    paragraphs: [
      "I feel most at home building Single Page Applications (SPAs) in Angular, especially those requiring complex animations and fluid interactivity. However, my strongest asset isn't just my code—it's my ability to act as the vital link between graphics, front-end, and backend.",
      "I understand the visual language of designers and the structural needs of backend engineers, ensuring a flawless final product.",
    ],
  },
];

const projectsSections: readonly GameUiContentSection[] = [
  {
    heading: "Projects",
    paragraphs: [
      "Here is a selection of my personal projects. Besides these experiments, I have a lot of work on other large projects under my belt. You can find my full career path and a more detailed overview in the Resume (CV) section.",
    ],
  },
  {
    heading: "eUTxO.org",
    paragraphs: [
      "Visual Blockchain Explorer for Cardano",
      "I have a general interest in crypto and blockchain technologies and this is one of my most complex side projects. It's a visual tool for Cardano cryptocurrency to help you understand the UTXO model and the content of Cardano blocks.",
    ],
    image: {
      src: "assets/images/portfolio/portfolio-eutxo.webp",
      alt: "eUTxO.org - Visual Blockchain Explorer",
      fallbackText: "eUTxO.org preview unavailable.",
    },
    links: [{ label: "Visit", href: "https://eutxo.org" }],
    tags: [
      "Serverless Node.js",
      "Google Firestore DB",
      "BlockFrost API",
      "PhaserJS",
      "Tailwind CSS",
    ],
  },
  {
    heading: "Angular.sk",
    paragraphs: [
      "Free online course for Angular 2+",
      "Angular.sk is my side project. I created a series of instructional videos for beginners who want to learn working with Angular 2+.",
    ],
    image: {
      src: "assets/images/portfolio/portfolio-angularsk.webp",
      alt: "Angular.sk",
      fallbackText: "Angular.sk preview unavailable.",
    },
    links: [{ label: "Visit", href: "https://angular.sk" }],
  },
  {
    heading: "Peter Oravec portfolio v1",
    paragraphs: [
      "100% human-coded, no AI",
      "The first version of this pixel art portfolio, which I programmed entirely by myself without any help from artificial intelligence. Every line of code, every sprite and every mechanic is purely my work. The current version you are on right now is its successor.",
    ],
    image: {
      src: "assets/images/portfolio/peteroravec-v1.webp",
      alt: "PeterOravec.com portfolio v1",
      fallbackText: "Peter Oravec portfolio v1 preview unavailable.",
    },
    links: [{ label: "Visit", href: "https://old.peteroravec.com" }],
    tags: ["Angular", "PhaserJS", "Tiled"],
  },
];

const memoSections = [
  {
    menuId: "memo1",
    title: "100% Vibe coding",
    alt: "Collectible card - 100% Vibe coding",
    src: "/assets/images/cards/card1_base.webp",
    fallbackText: "Memo 1 card image unavailable.",
    body: [
      "This entire website was created as an experiment with a modern approach to development – so-called vibe coding. My goal was to test the limits of human-AI collaboration when building a complex digital product completely from scratch.",
      "The result? A fascinating synergy that has its clear rules.",
      "AI provided speed, but I had to provide direction, logical consistency and the final integration of all parts into a functional whole.",
      "Context is king: Without deep understanding of the code and the ability to precisely define the task, AI quickly gets tangled up.",
      "Critical thinking: Every line generated by the machine went through rigorous human review and manual fine-tuning of details that escape the machine.",
      "This website is proof that AI can push the boundaries of what's possible, but only in the hands of someone who knows exactly what they're doing. It's a brilliant assistant, but you must remain the captain and architect.",
    ],
  },
  {
    menuId: "memo2",
    title: "Automatic testing",
    alt: "Collectible card - Automated Testing",
    src: "/assets/images/cards/card2_base.webp",
    fallbackText: "Memo 2 card image unavailable.",
    body: [
      "Nobody likes bugs. I personally have experience with automatic testing of both backend and frontend.",
      "My favorite tools for End-To-End frontend testing include Midnight, Playwright and Puppeteer. With them, I can create tests that run in a CI environment before every deployment or other browser automation.",
      "When API testing is needed, I use Mocha and Chai libraries. I'm a fan of automation.",
    ],
  },
  {
    menuId: "memo3",
    title: "From Node.js logic to visual art in Canvas",
    alt: "Collectible card - From Node.js to Canvas",
    src: "/assets/images/cards/card3_base.webp",
    fallbackText: "Memo 3 card image unavailable.",
    body: [
      "I've been specializing in the JS ecosystem for a long time, where I feel at home. Whether it's a robust backend in Node.js and Express.js, dynamic frontends in Angular, or creative visual solutions in Canvas, I see JavaScript as a tool with unlimited possibilities.",
      "My main strength is that I'm a mix of designer, front-end developer and backend developer in one. It has always been this way and I'm used to covering all the pain points of development.",
    ],
  },
  {
    menuId: "memo4",
    title: "Technologies I buried",
    alt: "Collectible card - Deprecated Technologies",
    src: "/assets/images/cards/card4_base.webp",
    fallbackText: "Memo 4 card image unavailable.",
    body: [
      "They say what doesn't kill you makes you stronger. Lotus Notes didn't kill me, although it tried very hard. After years of fighting with it, PHP and WordPress, I closed this chapter with relief (and a mild celebration).",
      "Today I use these battle scars to create better, faster and more stable solutions. Exclusively in JavaScript.",
    ],
  },
  {
    menuId: "memo5",
    title: "AI: Competitor or colleague?",
    alt: "Collectible card - AI as Assistant",
    src: "/assets/images/cards/card5_base.webp",
    fallbackText: "Memo 5 card image unavailable.",
    body: [
      "The ability to write syntactically correct code is no longer rare. AI does it faster, for free, and 24/7.",
      "However, programming isn't about writing lines, but knowing which lines not to write. AI is just a powerful generator and I am the filter.",
    ],
  },
  {
    menuId: "memo6",
    title: "I'm not a game developer",
    alt: "Collectible card - I'm not a game developer",
    src: "/assets/images/cards/card6_base.webp",
    fallbackText: "Memo 6 card image unavailable.",
    body: [
      "Don't be fooled by the visuals – I'm not a game developer. My priority is large, long-term projects that require clean architecture and logical solutions.",
      "At the same time, I can be creative and flexible when the situation calls for it.",
    ],
  },
] as const;

function memoPayload(
  entry: (typeof memoSections)[number],
): GameUiContentPayload {
  const section: GameUiContentSection = {
    heading: entry.title,
    paragraphs: entry.body,
    image: {
      src: entry.src,
      alt: entry.alt,
      fallbackText: entry.fallbackText,
    },
  };
  return {
    menuId: entry.menuId,
    title: entry.title,
    body: entry.body,
    sections: [section],
  };
}

const rawRegistry = {
  about: {
    menuId: "about",
    title: "About me",
    body: [
      "Peter Oravec",
      "Front-end & MEAN Stack developer",
      "Bridging the Gap Between Design and Code",
      ...aboutSections.flatMap((section) => section.paragraphs ?? []),
      "LinkedIn: https://www.linkedin.com/in/peteroravec",
    ],
    sections: aboutSections,
  },
  projects: {
    menuId: "projects",
    title: "Projects",
    body: projectsSections.flatMap((section) => [
      ...(section.heading === undefined ? [] : [section.heading]),
      ...(section.paragraphs ?? []),
      ...(section.tags === undefined ? [] : [section.tags.join(", ")]),
      ...(section.links?.map((link) => `${link.label}: ${link.href}`) ?? []),
    ]),
    sections: projectsSections,
  },
  memo1: memoPayload(memoSections[0]),
  memo2: memoPayload(memoSections[1]),
  memo3: memoPayload(memoSections[2]),
  memo4: memoPayload(memoSections[3]),
  memo5: memoPayload(memoSections[4]),
  memo6: memoPayload(memoSections[5]),
} satisfies Record<VisibleContentMenuId, GameUiContentPayload>;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value;
}

export const CONTENT_REGISTRY: Readonly<
  Record<VisibleContentMenuId, GameUiContentPayload>
> = deepFreeze(rawRegistry);

export const VISIBLE_CONTENT_REGISTRY = CONTENT_REGISTRY;

export function isVisibleContentMenuId(
  menuId: ContentMenuId,
): menuId is VisibleContentMenuId {
  return (VISIBLE_CONTENT_MENU_IDS as readonly string[]).includes(menuId);
}

export function getVisibleContentPayload(
  menuId: ContentMenuId,
): GameUiContentPayload | undefined {
  return isVisibleContentMenuId(menuId)
    ? CONTENT_REGISTRY[menuId]
    : undefined;
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
