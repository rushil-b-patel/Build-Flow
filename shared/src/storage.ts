import fs from "fs";
import path from "path";
import { mapWithConcurrency } from "./async";
import { ensureDirectory, listFilesRecursively, toPosixPath } from "./files";
import { loadEnv, requireEnv } from "./env";

const { S3 } = require("aws-sdk");

loadEnv();

const bucketName = process.env.BUCKET_NAME || "bucket";
const storage = new S3({
  accessKeyId: requireEnv("ACCESS_KEY_ID"),
  secretAccessKey: requireEnv("SECRET_ACCESS_KEY"),
  endpoint: requireEnv("END_POINT"),
});

function normalizePrefix(prefix: string) {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

function toBuffer(body: any) {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  throw new Error("Unsupported object body type");
}

export async function uploadFile(key: string, localFilePath: string) {
  const fileContent = await fs.promises.readFile(localFilePath);

  await storage
    .upload({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
    })
    .promise();
}

export async function uploadDirectory(
  prefix: string,
  folderPath: string,
  options: { concurrency?: number } = {}
) {
  const files = listFilesRecursively(folderPath);
  const normalizedPrefix = normalizePrefix(prefix);
  const concurrency = options.concurrency ?? 8;

  await mapWithConcurrency(files, concurrency, async (file) => {
    const relativePath = toPosixPath(path.relative(folderPath, file));
    await uploadFile(`${normalizedPrefix}${relativePath}`, file);
  });

  return files;
}

export async function getObjectBuffer(key: string) {
  const response = await storage
    .getObject({
      Bucket: bucketName,
      Key: key,
    })
    .promise();

  return toBuffer(response.Body);
}

async function listObjectKeys(prefix: string) {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await storage
      .listObjectsV2({
        Bucket: bucketName,
        Prefix: normalizePrefix(prefix),
        ContinuationToken: continuationToken,
      })
      .promise();

    for (const item of response.Contents || []) {
      if (item.Key) {
        keys.push(item.Key);
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}

export async function downloadPrefixToDirectory(
  prefix: string,
  outputRoot: string,
  options: { concurrency?: number } = {}
) {
  const normalizedPrefix = normalizePrefix(prefix);
  const keys = await listObjectKeys(prefix);
  const concurrency = options.concurrency ?? 8;

  await mapWithConcurrency(keys, concurrency, async (key) => {
    const relativeKey = key.slice(normalizedPrefix.length);
    const outputPath = path.join(outputRoot, relativeKey);

    ensureDirectory(path.dirname(outputPath));

    await new Promise<void>((resolve, reject) => {
      const outputFile = fs.createWriteStream(outputPath);

      outputFile.on("finish", resolve);
      outputFile.on("error", reject);

      storage
        .getObject({
          Bucket: bucketName,
          Key: key,
        })
        .createReadStream()
        .on("error", reject)
        .pipe(outputFile);
    });
  });
}
