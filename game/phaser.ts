// 用原站同款 Phaser 3.90.0（public/vendor/phaser.min.js 全局加载）。
// 不依赖 npm phaser（默认 4.0 大版本，与原站 3.90 不匹配，且有破坏性变更）。
const Phaser = (globalThis as any).Phaser;

export default Phaser;
