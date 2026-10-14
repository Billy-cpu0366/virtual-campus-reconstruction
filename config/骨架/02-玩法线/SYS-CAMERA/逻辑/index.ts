import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import { CAMERA_SHAPES, type CameraConfigKey } from "./shapes.js";
import type { CameraConfigs } from "./types.js";

export type { CameraConfigs } from "./types.js";
export const CAMERA_CONFIG_KEYS = Object.keys(CAMERA_SHAPES) as readonly CameraConfigKey[];

export async function loadCameraConfigs(source: ConfigSource): Promise<CameraConfigs> {
  const key: CameraConfigKey = "02-玩法线/SYS-CAMERA/数据/camera-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<CameraConfigs>(key, CAMERA_SHAPES[key], file.data);
  if (config.settings.zoom <= 0 || config.settings.lerpX < 0 || config.settings.lerpY < 0 ||
      config.returnDuration < 0 || config.sequence.length === 0 ||
      config.pointEase.length === 0 || config.returnEase.length === 0) {
    throw new RangeError(`${key} 的镜头缩放、跟随、航拍点位和时长必须有效`);
  }
  return config;
}
