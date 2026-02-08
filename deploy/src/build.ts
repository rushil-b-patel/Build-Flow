import { spawn } from "child_process";
import path from "path";
import { log, setStatus } from "./log";

function runCommand(id: string, cwd: string, command: string, args: string[]) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, { cwd });

        child.stdout.on("data", (data) => {
            log(id, data.toString());
        });

        child.stderr.on("data", (data) => {
            log(id, data.toString());
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

export async function buildProject(id: string) {
    const cwd = path.join(__dirname, `output/${id}`);
    await setStatus(id, "building");
    await log(id, "Starting build process");
    await log(id, "$ npm install");
    await runCommand(id, cwd, "npm", ["install"]);
    await log(id, "$ npm run build");
    await runCommand(id, cwd, "npm", ["run", "build"]);
    await log(id, "Build completed successfully");
}
