import { readdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testOutDir = path.join(rootDir, ".test-dist");
const isWindows = process.platform === "win32";

await rm(testOutDir, { recursive: true, force: true });

const sourceFiles = await listTypeScriptFiles(path.join(rootDir, "src", "lib"));
const testFiles = sourceFiles.filter((file) => file.endsWith(".test.ts"));

try {
  await run(isWindows ? "tsc.cmd" : "tsc", [
    "--target",
    "ES2022",
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--types",
    "node",
    "--lib",
    "ES2022,DOM",
    "--skipLibCheck",
    "--esModuleInterop",
    "--strict",
    "--noEmit",
    "false",
    "--rootDir",
    "src",
    "--outDir",
    ".test-dist",
    ...sourceFiles.map((file) => path.relative(rootDir, file)),
  ]);

  await run("node", [
    "--test",
    ...testFiles.map((file) =>
      path.join(
        ".test-dist",
        path.relative(path.join(rootDir, "src"), file).replace(/\.ts$/, ".js"),
      ),
    ),
  ]);
} finally {
  await rm(testOutDir, { recursive: true, force: true });
}

async function listTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listTypeScriptFiles(fullPath);
      }

      return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
    }),
  );

  return files.flat();
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      shell: isWindows,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
