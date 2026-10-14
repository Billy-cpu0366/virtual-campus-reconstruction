export interface AppConfigs {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly physicsFps: number;
  readonly physicsFixedStep: boolean;
  readonly physicsGravity: Readonly<{ x: number; y: number }>;
  readonly pixelArt: boolean;
  readonly roundPixels: boolean;
  readonly backgroundColor: string;
  readonly showErrorDetail: boolean;
  readonly entryTrainArrivalMs: number;
}
