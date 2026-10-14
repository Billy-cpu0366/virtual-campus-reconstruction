/**
 * §17 网络协议层里「值已存在、且本轮红线内可接线」的字段。
 *
 * 其余 24 项的处置（冻结 / 缺口不补 / 重复归属 / 行为标记）写在
 * transport-config.json 的 meta.notes 和总表 §17，不在此重复。
 *
 * 这个类型只活在呈现层——`game/fetchJson.ts` 的超时参数在 `src/` 没有
 * 对应物，按「呈现层例外」定在这里，且只有这一份。
 */
export interface TransportConfigs {
  readonly timeouts: {
    readonly json: number;
  };
}
