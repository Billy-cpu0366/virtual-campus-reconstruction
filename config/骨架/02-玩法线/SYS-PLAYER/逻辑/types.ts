import type { Direction } from "../../../../../src/input/index.js";
import type { IdleAnimation } from "../../../../../src/player/contract.js";

export interface PlayerTexture {
  readonly key: string;
  readonly url: string;
}

export interface PlayerConfigs {
  readonly spawn: Readonly<{ x: number; y: number }>;
  readonly texture: string;
  readonly textureUrl: string;
  readonly displaySize: number;
  readonly specialDisplaySize: number;
  readonly spritesheet: Readonly<{
    frameSize: Readonly<{ width: number; height: number }>;
    frames: number;
  }>;
  readonly animation: Readonly<{
    walkFramesPerDirection: number;
    frameRate: number;
    walkFrameStart: Readonly<Record<Direction, number>>;
  }>;
  readonly defaultFacing: Direction;
  readonly idle: Readonly<{
    timeForIdleAction: number;
    timeForSitting: number;
    animations: readonly IdleAnimation[];
    textures: readonly (PlayerTexture & Readonly<{ action: IdleAnimation | "sitting" }>)[];
    animationKeys: Readonly<{
      eating: string;
      scratching: string;
      "tying-shoe": string;
      sittingDown: string;
      standingUp: string;
    }>;
    assetFrames: Readonly<{
      frameWidth: number;
      frameHeight: number;
      startFrame: number;
      endFrame: number;
    }>;
  }>;
  readonly idleFrame: number;
  readonly beach: Readonly<{
    texture: string;
    textureUrl: string;
    idleFrame: number;
  }>;
  readonly clothing: Readonly<{
    offTexture: string;
    offTextureUrl: string;
    undressAnimationKey: string;
    dressAnimationKey: string;
    frameSize: Readonly<{ width: number; height: number }>;
    assetFrames: Readonly<{ startFrame: number; endFrame: number }>;
    frameRange: Readonly<{ start: number; end: number }>;
    frameRate: number;
    offDisplaySize: number;
    cooldownMs: number;
  }>;
  readonly beachTriggerGid: number;
}
