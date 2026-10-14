import type { ConfigSource } from "../../../公共/config-source.js";
import { normalizeConfigFile } from "../../../公共/normalize-config-file.js";
import { validate } from "../../../公共/validate.js";
import { INPUT_SHAPES, type InputConfigKey } from "./shapes.js";
import type { InputConfigs } from "./types.js";

export type { InputConfigs } from "./types.js";
export const INPUT_CONFIG_KEYS = Object.keys(INPUT_SHAPES) as readonly InputConfigKey[];

export async function loadInputConfigs(source: ConfigSource): Promise<InputConfigs> {
  const key: InputConfigKey = "02-玩法线/SYS-INPUT/数据/input-config.json";
  const raw = await source.read(key);
  const file = normalizeConfigFile(key, { meta: raw.meta, data: raw.data });
  const config = validate<InputConfigs>(key, INPUT_SHAPES[key], file.data);
  const directions = config.directions;
  if (directions.length !== 8 || new Set(directions).size !== 8 ||
      Object.keys(config.vectors).length !== directions.length ||
      directions.some((direction) => config.vectors[direction] === undefined) ||
      config.speed.walk <= 0 || config.speed.diagonal <= 0 ||
      config.joystick.mainAxisRatio <= 0 || config.joystick.forceMin < 0 ||
      config.joystick.positionOffset < 0 || config.device.tabletBreakpoint <= 0) {
    throw new RangeError(`${key} 的方向、速度和摇杆参数必须有效`);
  }
  for (const style of Object.values(config.joystick.style)) {
    if (style.color < 0 || style.color > 0xffffff ||
        style.alpha < 0 || style.alpha > 1 ||
        ("width" in style && style.width <= 0)) {
      throw new RangeError(`${key} 的摇杆颜色、透明度和描边宽度必须有效`);
    }
  }
  return config;
}
