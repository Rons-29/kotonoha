import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const watch = args.includes("--watch");

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.join(projectRoot, "main.js");
const defaultPluginDir = path.join(projectRoot, "plugin-dist");
const pluginDir = path.resolve(process.env.OBSIDIAN_PLUGIN_DIR || defaultPluginDir);

const copyAssets = () => {
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.copyFileSync(path.join(projectRoot, "manifest.json"), path.join(pluginDir, "manifest.json"));
  fs.copyFileSync(path.join(projectRoot, "styles.css"), path.join(pluginDir, "styles.css"));
  fs.copyFileSync(outputFile, path.join(pluginDir, "main.js"));
};

const ctx = await esbuild.context({
  entryPoints: [path.join(projectRoot, "src/main.ts")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2020",
  outfile: outputFile,
  external: ["obsidian"],
  sourcemap: watch ? "inline" : false,
  logLevel: "info"
});

if (watch) {
  await ctx.watch();
  await ctx.rebuild();
  copyAssets();
  console.log(`Watching plugin source. Sync target: ${pluginDir}`);
} else {
  await ctx.rebuild();
  copyAssets();
  await ctx.dispose();
  console.log(`Build complete. Synced to: ${pluginDir}`);
}
