import { spawn } from "child_process";
import { updateDeploymentState } from "@backend-core/deployments";
import { appendDeploymentLog } from "@backend-core/logs";

function runCommand(id: string, cwd: string, command: string, args: string[]) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, { cwd });

        child.stdout.on("data", (data) => {
            void appendDeploymentLog(id, data.toString());
        });

        child.stderr.on("data", (data) => {
            void appendDeploymentLog(id, data.toString());
        });

        child.on("error", (err) => {
            reject(err);
        });

        child.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`${command} ${args.join(" ")} failed`));
                return;
            }
            resolve();
        });
    });
}

export async function buildProject(id: string, workspaceDir: string) {
    await updateDeploymentState(id, "building");
    await appendDeploymentLog(id, "Starting build process");
    await appendDeploymentLog(id, "$ npm install");
    await runCommand(id, workspaceDir, "npm", ["install"]);
    await appendDeploymentLog(id, "$ npm run build");
    await runCommand(id, workspaceDir, "npm", ["run", "build"]);
    await appendDeploymentLog(id, "Build completed successfully");
}
