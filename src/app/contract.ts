export type AppStatus =
  | "BOOT"
  | "LOADING"
  | "READY"
  | "ENTERING_GAME"
  | "PLAYING"
  | "MODAL_OPEN"
  | "ERROR"
  | "RETRYING"
  | "SHUTDOWN";

export type AppErrorKind =
  | "boot"
  | "required-asset"
  | "entry"
  | "cleanup"
  | "protocol";

export interface AppError {
  readonly kind: AppErrorKind;
  readonly message: string;
}

export interface AppSnapshot {
  readonly status: AppStatus;
  readonly generation: number;
  readonly progress: number;
  readonly error?: AppError;
}

export interface AppLoadCallbacks {
  readonly onProgress: (ratio: number) => void;
  readonly onReady: () => void;
  readonly onError: (error: unknown) => void;
}

export interface AppLoadHandle {
  cancel(): void;
}

export interface AppRuntimeEffects {
  startLoading(
    generation: number,
    callbacks: AppLoadCallbacks,
  ): AppLoadHandle | void;
  cleanup(generation: number): void | Promise<void>;
  enterGame(
    generation: number,
    onEntered: () => void,
    onError: (error: unknown) => void,
  ): void;
}

export interface AppRuntimeOptions {
  readonly effects: AppRuntimeEffects;
  readonly onChange?: (snapshot: AppSnapshot) => void;
}
