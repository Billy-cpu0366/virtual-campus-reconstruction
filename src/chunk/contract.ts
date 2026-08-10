export class ChunkMasterContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChunkMasterContractError";
  }
}

export interface ChunkMaster {
  readonly chunkWidth: number;
  readonly chunkHeight: number;
  readonly nbChunksHorizontal: number;
  readonly nbChunksVertical: number;
  readonly originalWidth: number;
  readonly originalHeight: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly tilesets: readonly unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(
  value: Record<string, unknown>,
  field: string,
): number {
  const candidate = value[field];
  if (!Number.isInteger(candidate) || (candidate as number) <= 0) {
    throw new ChunkMasterContractError(
      `${field} must be a positive integer`,
    );
  }
  return candidate as number;
}

function tileSize(tilesets: readonly unknown[]): {
  tileWidth: number;
  tileHeight: number;
} {
  let result: { tileWidth: number; tileHeight: number } | undefined;

  for (const tileset of tilesets) {
    if (!isRecord(tileset)) {
      throw new ChunkMasterContractError("each tileset must be an object");
    }

    const hasWidth = tileset.tilewidth !== undefined;
    const hasHeight = tileset.tileheight !== undefined;
    if (!hasWidth && !hasHeight) {
      continue;
    }
    if (!hasWidth || !hasHeight) {
      throw new ChunkMasterContractError(
        "inline tilesets must define both tilewidth and tileheight",
      );
    }

    const current = {
      tileWidth: positiveInteger(tileset, "tilewidth"),
      tileHeight: positiveInteger(tileset, "tileheight"),
    };
    if (
      result !== undefined &&
      (result.tileWidth !== current.tileWidth ||
        result.tileHeight !== current.tileHeight)
    ) {
      throw new ChunkMasterContractError(
        "inline tilesets must use one tile size",
      );
    }
    result = current;
  }

  if (result === undefined) {
    throw new ChunkMasterContractError(
      "at least one inline tileset must define tile size",
    );
  }
  return result;
}

export function parseChunkMaster(value: unknown): ChunkMaster {
  if (!isRecord(value)) {
    throw new ChunkMasterContractError("master must be an object");
  }

  const chunkWidth = positiveInteger(value, "chunkWidth");
  const chunkHeight = positiveInteger(value, "chunkHeight");
  const nbChunksHorizontal = positiveInteger(
    value,
    "nbChunksHorizontal",
  );
  const nbChunksVertical = positiveInteger(value, "nbChunksVertical");
  const originalWidth = positiveInteger(value, "originalWidth");
  const originalHeight = positiveInteger(value, "originalHeight");

  if (!Array.isArray(value.tilesets)) {
    throw new ChunkMasterContractError("tilesets must be an array");
  }
  const tilesets = [...value.tilesets];
  const { tileWidth, tileHeight } = tileSize(tilesets);

  if (originalWidth !== chunkWidth * nbChunksHorizontal) {
    throw new ChunkMasterContractError(
      "originalWidth must equal chunkWidth * nbChunksHorizontal",
    );
  }
  if (originalHeight !== chunkHeight * nbChunksVertical) {
    throw new ChunkMasterContractError(
      "originalHeight must equal chunkHeight * nbChunksVertical",
    );
  }

  return Object.freeze({
    chunkWidth,
    chunkHeight,
    nbChunksHorizontal,
    nbChunksVertical,
    originalWidth,
    originalHeight,
    tileWidth,
    tileHeight,
    tilesets: Object.freeze(tilesets),
  });
}
