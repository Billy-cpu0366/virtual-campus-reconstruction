/** master.json 之外的世界场景数值；WorldSpec 的唯一类型出处仍在 src/world。 */
export interface WorldConfigs {
  readonly entryCameraStart: { readonly x: number; readonly y: number };
  readonly entryCorridorSamples: number;
  readonly bridgeCheckFrames: number;
  readonly clearLayersPerFrame: number;
  readonly cameraTestTour: {
    readonly duration: number;
    readonly stayDuration: number;
    readonly returnDuration: number;
  };
  readonly tileQuery: { readonly layer: string };
}
