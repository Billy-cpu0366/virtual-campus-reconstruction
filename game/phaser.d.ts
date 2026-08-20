// Minimal compile-time surface for the pinned global Phaser 3 runtime.
// Runtime implementation is loaded by index.html from public/vendor/phaser.min.js.
declare namespace Phaser {
  const AUTO: number;

  namespace Types {
    namespace Core {
      interface GameConfig {
        [key: string]: unknown;
        type: number;
        parent: string;
        scene: unknown;
      }
    }

    namespace Input {
      namespace Keyboard {
        interface CursorKeys {
          up: Phaser.Input.Keyboard.Key;
          down: Phaser.Input.Keyboard.Key;
          left: Phaser.Input.Keyboard.Key;
          right: Phaser.Input.Keyboard.Key;
        }
      }
    }
  }

  namespace Input {
    namespace Keyboard {
      class Key {
        isDown: boolean;
      }
    }
  }

  namespace Physics {
    namespace Arcade {
      interface BlockedFlags {
        up: boolean;
        down: boolean;
        left: boolean;
        right: boolean;
      }

      class Body {
        blocked: BlockedFlags;
        setSize(width: number, height: number): this;
        setOffset(x: number, y: number): this;
        setDrag(x: number, y: number): this;
        setMaxVelocity(x: number, y: number): this;
      }

      class Collider {
        destroy(): void;
      }

      class Sprite {
        x: number;
        y: number;
        body: Body;
        anims: any;
        setDisplaySize(width: number, height: number): this;
        setCollideWorldBounds(value: boolean): this;
        setVelocity(x: number, y: number): this;
        setFrame(frame: number): this;
        setDepth(value: number): this;
      }
    }
  }

  class Scene {
    protected constructor(key?: string);
    load: any;
    make: any;
    physics: any;
    anims: any;
    input: any;
    cameras: any;
    events: any;
    game: any;
  }
}
