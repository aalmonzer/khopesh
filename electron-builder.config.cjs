// Packaging: `npm run package:mac` and `npm run package:win` (see README).
//
// Windows ships as two downloads so most people skip the 146 MB CUDA library:
//   default                  Vulkan (AMD, Intel, NVIDIA) + CPU fallback
//   KHOPESH_VARIANT=nvidia   adds the CUDA build for NVIDIA cards
//
// Mac signing uses the Developer ID certificate in your keychain if there is one.
// Notarization runs when APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID are set.

const nvidia = process.env.KHOPESH_VARIANT === "nvidia";

module.exports = {
  appId: "com.khopesh.app",
  productName: "Khopesh",
  copyright: "Khopesh contributors",
  directories: { output: "release", buildResources: "build" },
  files: ["out/**/*", "package.json"],
  asar: true,

  mac: {
    target: [{ target: "zip", arch: ["arm64"] }],
    artifactName: "${productName}-${version}-mac-arm64.${ext}",
    category: "public.app-category.music",
    minimumSystemVersion: "13.0",
    hardenedRuntime: true,
    notarize: Boolean(process.env.APPLE_TEAM_ID),
    extraResources: [{ from: "resources/bin/macos", to: "bin/macos" }],
  },

  win: {
    target: [{ target: "zip", arch: ["x64"] }],
    artifactName: nvidia ? "${productName}-${version}-win-x64-nvidia.${ext}" : "${productName}-${version}-win-x64.${ext}",
    extraResources: [
      { from: "resources/bin/windows", to: "bin/windows", filter: nvidia ? ["**/*"] : ["**/*", "!cuda/**"] },
    ],
  },
};
