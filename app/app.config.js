// 扩展 app.json：仅当 EXPO_PUBLIC_BASE_URL 存在时注入子路径 baseUrl（GitHub Pages 项目页用）。
// 本地 / gate 不设该 env → baseUrl 不生效（根路径），行为与原 app.json 一致。
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments || {}),
    ...(process.env.EXPO_PUBLIC_BASE_URL
      ? { baseUrl: process.env.EXPO_PUBLIC_BASE_URL }
      : {}),
  },
});
