/**
 * バージョン同期スクリプト
 * pnpm version 実行時に package.json のバージョンを他のファイルに同期する
 *
 * 使用方法: npx tsx scripts/version.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// package.json からバージョンを取得
const packageJsonPath = resolve(rootDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const version = packageJson.version;

console.log(`Syncing version: ${version}`);

// tauri.conf.json を更新
const tauriConfPath = resolve(rootDir, "src-tauri/tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf-8"));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log(`  ✓ src-tauri/tauri.conf.json`);

// Cargo.toml を更新
const cargoTomlPath = resolve(rootDir, "src-tauri/Cargo.toml");
let cargoToml = readFileSync(cargoTomlPath, "utf-8");
cargoToml = cargoToml.replace(/^version = ".*"/m, `version = "${version}"`);
writeFileSync(cargoTomlPath, cargoToml);
console.log(`  ✓ src-tauri/Cargo.toml`);

console.log("Version sync complete!");
