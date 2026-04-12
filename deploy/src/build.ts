import { spawn } from "child_process";
import { updateDeploymentState } from "@backend-core/deployments";
import { appendDeploymentLog } from "@backend-core/logs";
import { restoreCache, saveCache } from "./cache";

const BUILD_TIMEOUT_MS = Math.max(
    0,
    parseInt(process.env.BUILD_TIMEOUT_MS || "300000", 10) || 300_000,
);

function runCommand(id: string, cwd: string, command: string, args: string[]) {
    return new Promise<void>((resolve, reject) => {
        const ac = new AbortController();
        const child = spawn(command, args, { cwd, signal: ac.signal });

        let settled = false;
        const settle = (fn: () => void) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                fn();
            }
        };

        const timer =
            BUILD_TIMEOUT_MS > 0
                ? setTimeout(() => {
                      void appendDeploymentLog(
                          id,
                          `Build timed out after ${BUILD_TIMEOUT_MS}ms`,
                      );
                      ac.abort();
                      child.kill("SIGKILL");
                      settle(() =>
                          reject(
                              new Error(
                                  `${command} ${args.join(" ")} timed out after ${BUILD_TIMEOUT_MS}ms`,
                              ),
                          ),
                      );
                  }, BUILD_TIMEOUT_MS)
                : undefined;

        child.stdout.on("data", (data) => {
            void appendDeploymentLog(id, data.toString());
        });

        child.stderr.on("data", (data) => {
            void appendDeploymentLog(id, data.toString());
        });

        child.on("error", (err) => {
            if (err.name === "AbortError") return;
            settle(() => reject(err));
        });

        child.on("close", (code) => {
            if (code !== 0) {
                settle(() =>
                    reject(new Error(`${command} ${args.join(" ")} failed`)),
                );
                return;
            }
            settle(() => resolve());
        });
    });
}

export async function buildProject(id: string, workspaceDir: string) {
    await updateDeploymentState(id, "building");
    await appendDeploymentLog(id, "Starting build process");

    const cacheHash = await restoreCache(id, workspaceDir);

    await appendDeploymentLog(id, "$ npm install");
    await runCommand(id, workspaceDir, "npm", ["install"]);

    if (cacheHash) {
        await saveCache(id, workspaceDir, cacheHash);
    }

    await appendDeploymentLog(id, "$ npm run build");
    await runCommand(id, workspaceDir, "npm", ["run", "build"]);
    await appendDeploymentLog(id, "Build completed successfully");
}
