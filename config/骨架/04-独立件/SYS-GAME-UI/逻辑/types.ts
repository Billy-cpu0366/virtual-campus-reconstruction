export interface GameUiConfigs {
  readonly breakpoint: Readonly<{ mobile: number }>;
  readonly focusRing: string;
  readonly rootPadding: Readonly<{ desktop: string; mobile: string }>;
}
