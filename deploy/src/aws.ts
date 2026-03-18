import { promises as fs } from "fs";
import path from "path";
import { listFilesRecursively } from "@backend-core/fs";
import {
    getObjectBytes,
    listObjectKeys,
    putObjectFromFile,
} from "@backend-core/s3";

export async function downloadS3Folder(prefix: string, destinationDir: string) {
    const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const keys = await listObjectKeys(normalizedPrefix);

    await Promise.all(
        keys.map(async (key) => {
            const relativePath = key.slice(normalizedPrefix.length);
            if (!relativePath) {
                return;
            }

            const bytes = await getObjectBytes(key);
            if (!bytes) {
                return;
            }

            const outputPath = path.join(destinationDir, relativePath);
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, bytes);
        }),
    );
}

export async function copyFinalDist(id: string, workspaceDir: string) {
    const distDir = path.join(workspaceDir, "dist");
    const files = await listFilesRecursively(distDir);

    await Promise.all(
        files.map((filePath) => {
            const relativePath = path
                .relative(distDir, filePath)
                .replace(/\\/g, "/");
            return putObjectFromFile(
                path.posix.join("dist", id, relativePath),
                filePath,
            );
        }),
    );
}
