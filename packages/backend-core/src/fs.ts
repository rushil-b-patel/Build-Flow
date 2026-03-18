import { promises as fs } from "fs";
import path from "path";

export async function listFilesRecursively(
    folderPath: string,
): Promise<string[]> {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = path.join(folderPath, entry.name);
            if (entry.isDirectory()) {
                return listFilesRecursively(fullPath);
            }
            return [fullPath];
        }),
    );

    return nested.flat();
}
