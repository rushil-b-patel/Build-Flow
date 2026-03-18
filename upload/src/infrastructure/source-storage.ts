import path from "path";
import { listFilesRecursively } from "@backend-core/fs";
import { putObjectFromFile } from "@backend-core/s3";

export async function uploadSourceDirectory(
    deploymentId: string,
    sourceDir: string,
) {
    const files = await listFilesRecursively(sourceDir);
    await Promise.all(
        files.map((filePath) => {
            const relativePath = path
                .relative(sourceDir, filePath)
                .replace(/\\/g, "/");
            const objectKey = path.posix.join(
                "output",
                deploymentId,
                relativePath,
            );
            return putObjectFromFile(objectKey, filePath);
        }),
    );
}
