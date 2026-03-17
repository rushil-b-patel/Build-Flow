import fs from "fs";
import path from "path";

export function listFilesRecursively(folderPath: string): string[] {
  let files: string[] = [];

  for (const entry of fs.readdirSync(folderPath)) {
    const fullPath = path.join(folderPath, entry);

    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(listFilesRecursively(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

export function ensureDirectory(folderPath: string) {
  fs.mkdirSync(folderPath, { recursive: true });
}

export function toPosixPath(filePath: string) {
  return filePath.split(path.sep).join("/");
}
