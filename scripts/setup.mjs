#!/usr/bin/env node
// Builds or downloads Khopesh's native tools into resources/bin/<platform>.
//
//   npm run setup               tools for this computer
//   npm run setup -- --windows  also prepare Windows tools (to package for Windows from a Mac)
//
// Needs git and CMake. macOS also needs Xcode command line tools; Windows needs
// Visual Studio Build Tools (or MinGW). Cross-building Windows tools from macOS
// needs MinGW: `brew install mingw-w64`.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cache = join(root, ".cache");
const bin = join(root, "resources", "bin");

// Pinned so every build uses the same, reviewed sources.
const SEPARATOR = {
  repo: "https://github.com/chenmozhijin/BSRoformer.cpp.git",
  commit: "a7b9625f0f4146cacf3c46080d1139833cd4d4c2",
};
const GGML = {
  repo: "https://github.com/ggml-org/ggml.git",
  commit: "456172ec733a135778adcd32d00e576a58232e45", // v0.24.0
};
// Prebuilt by the BSRoformer.cpp project (release v0.1.0), checked against their published SHA-256.
const WINDOWS_SEPARATORS = {
  base: "https://github.com/chenmozhijin/BSRoformer.cpp/releases/download/v0.1.0",
  cuda: { file: "BSRoformer-windows-cuda-12.9.1.zip", sha256: "7b8b93bc180e16f15124e4b739b0a9e9d038669e21fdf975f63823c02127bd70" },
  vulkan: { file: "BSRoformer-windows-vulkan.zip", sha256: "a47653911eb17f68e65bce15aed6c4f1bd277a5fbd48293c4e54f0b005b869a7" },
  cpu: { file: "BSRoformer-windows-x64-msvc.zip", sha256: "e002811d56605bce6a51c275cf8f9ba447a3707771289ea6fbcca7f4d3e9ba1f" },
};

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";
const wantWindows = isWindows || process.argv.includes("--windows");

const step = (message) => console.log(`\n▸ ${message}`);
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: "inherit" });

const checkout = (repo, commit, dir) => {
  if (existsSync(join(dir, ".git"))) {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();
    if (head === commit) return;
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  run("git", ["init", "-q"], dir);
  run("git", ["fetch", "-q", "--depth", "1", repo, commit], dir);
  run("git", ["checkout", "-q", "FETCH_HEAD"], dir);
};

const cmakeBuild = (source, build, flags) => {
  run("cmake", ["-S", source, "-B", build, "-DCMAKE_BUILD_TYPE=Release", ...flags]);
  run("cmake", ["--build", build, "--config", "Release", "--parallel"]);
};

// MSVC puts outputs in Release/, other generators in the build root.
const findBuilt = (build, name) =>
  [join(build, "Release", name), join(build, name)].find((p) => existsSync(p)) ??
  (() => { throw new Error(`Build output not found: ${name}`); })();

const buildAudioPrep = (target) => {
  const source = join(root, "native", "audio-prep");
  const build = join(source, "build", target);
  const flags = [];
  if (target === "macos") flags.push("-DCMAKE_OSX_DEPLOYMENT_TARGET=13.0");
  if (target === "windows" && !isWindows) {
    flags.push(
      "-DCMAKE_SYSTEM_NAME=Windows",
      "-DCMAKE_C_COMPILER=x86_64-w64-mingw32-gcc",
      "-DCMAKE_CXX_COMPILER=x86_64-w64-mingw32-g++",
    );
  }
  step(`Building audio-prep (${target})`);
  cmakeBuild(source, build, flags);
  const name = target === "windows" ? "audio-prep.exe" : "audio-prep";
  mkdirSync(join(bin, target), { recursive: true });
  copyFileSync(findBuilt(build, name), join(bin, target, name));
};

// Built from source on macOS: the upstream release predates ggml's Metal "tensor"
// support, which makes separation much faster on recent Macs.
const buildMacSeparator = () => {
  const sepDir = join(cache, "BSRoformer.cpp");
  const ggmlDir = join(cache, "ggml");
  step("Fetching separator sources (BSRoformer.cpp + ggml v0.24.0)");
  checkout(SEPARATOR.repo, SEPARATOR.commit, sepDir);
  checkout(GGML.repo, GGML.commit, ggmlDir);

  step("Building separator (Metal)");
  const build = join(cache, "build-separator-macos");
  cmakeBuild(sepDir, build, [
    `-DGGML_DIR=${ggmlDir}`,
    "-DCMAKE_DISABLE_FIND_PACKAGE_ggml=ON",
    "-DBUILD_SHARED_LIBS=ON",
    "-DBSR_BUILD_CLI=ON",
    "-DBSR_BUILD_TESTS=OFF",
    "-DGGML_CUDA=OFF",
    "-DGGML_METAL=ON",
    "-DGGML_METAL_EMBED_LIBRARY=ON",
    "-DGGML_BLAS=ON",
    "-DGGML_BLAS_VENDOR=Apple",
    // Portable across Apple Silicon generations, and runs on macOS 13+.
    "-DGGML_NATIVE=OFF",
    "-DCMAKE_OSX_DEPLOYMENT_TARGET=13.0",
    // Libraries ship next to the executable.
    "-DCMAKE_BUILD_WITH_INSTALL_RPATH=ON",
    "-DCMAKE_INSTALL_RPATH=@executable_path",
  ]);

  const dest = join(bin, "macos");
  mkdirSync(dest, { recursive: true });
  copyFileSync(join(build, "bs_roformer-cli"), join(dest, "bs_roformer-cli"));
  // Everything links against @rpath/libggml*.0.dylib, so ship real files under exactly
  // those names (no symlinks for packaging to mangle).
  const libs = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/^libggml(-[a-z]+)?\.0\.dylib$/.test(entry.name) && !libs.has(entry.name)) {
        libs.add(entry.name);
        copyFileSync(path, join(dest, entry.name)); // copyFileSync follows symlinks
      }
    }
  };
  walk(build);
  console.log(`  copied bs_roformer-cli + ${[...libs].join(", ")}`);
};

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

const fetchWindowsSeparators = async () => {
  for (const backend of ["cuda", "vulkan", "cpu"]) {
    const { file, sha256: expected } = WINDOWS_SEPARATORS[backend];
    const dest = join(bin, "windows", backend);
    if (existsSync(join(dest, "bs_roformer-cli.exe"))) continue;

    step(`Downloading Windows separator (${backend})`);
    const zip = join(cache, file);
    if (!existsSync(zip) || statSync(zip).size === 0) {
      mkdirSync(cache, { recursive: true });
      const response = await fetch(`${WINDOWS_SEPARATORS.base}/${file}`);
      if (!response.ok) throw new Error(`Download failed: ${file} (HTTP ${response.status})`);
      writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
    }
    const actual = sha256(readFileSync(zip));
    if (actual !== expected) {
      rmSync(zip);
      throw new Error(`Checksum mismatch for ${file}. Expected ${expected}, got ${actual}.`);
    }
    mkdirSync(dest, { recursive: true });
    run("tar", ["-xf", zip, "-C", dest]);
  }
};

try {
  if (isMac) {
    buildAudioPrep("macos");
    buildMacSeparator();
  }
  if (wantWindows) {
    buildAudioPrep("windows");
    await fetchWindowsSeparators();
  }
  if (!isMac && !wantWindows) {
    console.error("Khopesh currently supports macOS (Apple Silicon) and Windows.");
    process.exit(1);
  }
  step(`Done. Native tools are in ${bin}`);
} catch (err) {
  console.error(`\n✖ ${err.message}`);
  process.exit(1);
}
