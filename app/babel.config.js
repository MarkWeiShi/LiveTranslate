module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 插件必须在 plugins 数组最后（Moti 依赖 Reanimated）。
    plugins: ['react-native-reanimated/plugin'],
  };
};
