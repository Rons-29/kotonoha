import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const html = resolve(root, "tests/ui/kotonoha-mobile.html");
const minNode = [22, 19, 0];
const [major, minor, patch] = process.versions.node.split(".").map(Number);

if (major < minNode[0] || (major === minNode[0] && (minor < minNode[1] || (minor === minNode[1] && patch < minNode[2])))) {
  console.error(
    `@artifactshare/cli preview requires Node.js ${minNode.join(".")} or later (current: ${process.versions.node}).`,
  );
  process.exit(1);
}

const forwarded = process.argv.slice(2);
const args = [
  "exec",
  "--yes",
  "--package=@artifactshare/cli",
  "--",
  "artifactshare",
  "preview",
  html,
  ...forwarded,
];

const child = spawn("npm", args, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
