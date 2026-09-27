/**
 * 配置文件在服务器上放在哪儿。
 *
 * 单独一个文件、只放这一件事，因为它**会随部署环境变**：开发时是项目里的
 * `config/default/`，将来后台管理系统接管之后，可能是 `https://后台域名/api/config/`。
 * 换部署时只改这一处，别的代码一行不动。
 *
 * 和 `ConfigSource` 的分工：那一层管「怎么取」，这一层管「去哪儿取」。
 * 两者的变化节奏不一样——取法可能一直是 fetch，地址却每个校园一个。
 *
 * **一个校园一套**：`config/` 底下除了中文名的 `骨架/`、`文档/`、`工具/`，
 * 每个英文名目录都是一整份配置（`default/` 是默认那套）。换校园 = 新加一个目录，
 * 再在网址上指明读哪个。怎么加见 `config/README.md`。
 *
 * 这个文件**不许 import 任何东西**：`vite.config.ts` 也要用这里的规矩挑目录，
 * 而那个文件在打包器启动前就要跑起来，依赖越少越稳。
 */

/** 所有配置集的上一级。后面拼上集名和 `/` 才是取文件的根地址。 */
export const CONFIG_SETS_ROOT = "/config/";

/** 网址上指明读哪一套的参数名：`?config=set1`。 */
export const CONFIG_SET_PARAM = "config";

/** 网址上没指明、或者指明得不合法时，读这一套。 */
export const DEFAULT_CONFIG_SET = "default";

/**
 * 集名的合法写法：**只用小写英文字母、数字、`-`、`_`**。
 *
 * 为什么卡这么死：集名要**拼进网址**再拿去取文件，放任 `../` 之类就能越出
 * `config/` 读到别处。
 *
 * 顺带白捡一条好处：`骨架`、`文档`、`工具` 是中文名，天然过不了这道关——
 * 不必再单独维护一张「哪些目录不算配置集」的名单。名单是要人记得更新的，
 * 字符规则不用。
 *
 * **只许小写**：改成大写之后，Windows 上照样能读到（文件名不区分大小写），
 * 传到 Linux 服务器上就找不到了。索性一律小写，两边行为一样。
 */
const CONFIG_SET_PATTERN = /^[a-z0-9_-]{1,64}$/;

/** 这个名字够不够格当一个配置集。开发和打包时挑目录都用它，别另写一份。 */
export const isConfigSetName = (name: string): boolean =>
  CONFIG_SET_PATTERN.test(name);

/**
 * 从网址的查询串里挑出要读哪一套。
 *
 * 认不出来就退回 `DEFAULT_CONFIG_SET`，并且**在控制台喊一声**。
 *
 * 为什么非喊不可：拼错成 `?config=set_1` 的人，看到的是「游戏照常跑起来了」。
 * 不喊，他就会以为自己指定的那套生效了，其实读的是默认那套——**看着正常、
 * 其实错了**，这种最难查。喊一声，打开控制台就知道。
 */
export const resolveConfigSet = (search: string): string => {
  const requested = new URLSearchParams(search).get(CONFIG_SET_PARAM);
  if (requested === null) return DEFAULT_CONFIG_SET;
  const normalized = requested.trim().toLowerCase();
  if (isConfigSetName(normalized)) return normalized;
  console.warn(
    `网址上的 ${CONFIG_SET_PARAM}=${requested} 不是合法的配置集名` +
      `（只许小写英文字母、数字、- 和 _），改用 ${DEFAULT_CONFIG_SET}。`,
  );
  return DEFAULT_CONFIG_SET;
};

/**
 * 集名 → 取配置的根地址，**末尾带斜杠**。key 直接拼在它后面。
 *
 * 例：`/config/default/` + `05-旁支/SYS-NPC/数据/sprayer-tuning.json`。
 *
 * 这里**不再判断集名合不合法**——那是 `resolveConfigSet()` 的活。同一个判断
 * 写两处，以后只会改一处，然后两边说法不一致。
 */
export const configBaseUrlFor = (set: string): string =>
  `${CONFIG_SETS_ROOT}${set}/`;
