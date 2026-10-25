/** @type {import('babel').Config} */
module.exports = {
  presets: ["expo"],
  // react-native-worklets/plugin (Reanimated, used by the drawer) must stay last
  plugins: ["nativewind/babel", "react-native-worklets/plugin"],
}
