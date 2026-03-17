import path from "path";
import { downloadPrefixToDirectory, uploadDirectory } from "@shared/storage";

export async function downloadS3Folder(prefix: string) {
    await downloadPrefixToDirectory(prefix, path.join(__dirname, prefix));
}

export async function copyFinalDist(id: string) {
    const folderPath = path.join(__dirname, "output", id, "dist");
    await uploadDirectory(`dist/${id}`, folderPath);
}
