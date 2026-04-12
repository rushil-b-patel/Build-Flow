import { promises as fs } from "fs";
import {
    DeleteObjectsCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";

let s3Client: S3Client | null = null;

function getBucketName() {
    return process.env.BUCKET_NAME || "bucket";
}

export function getS3Client() {
    if (!s3Client) {
        s3Client = new S3Client({
            region: process.env.AWS_REGION || "auto",
            endpoint: process.env.END_POINT,
            credentials:
                process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY
                    ? {
                          accessKeyId: process.env.ACCESS_KEY_ID,
                          secretAccessKey: process.env.SECRET_ACCESS_KEY,
                      }
                    : undefined,
        });
    }
    return s3Client;
}

export async function objectExists(key: string): Promise<boolean> {
    try {
        await getS3Client().send(
            new HeadObjectCommand({
                Bucket: getBucketName(),
                Key: key,
            }),
        );
        return true;
    } catch {
        return false;
    }
}

export async function putObjectFromBuffer(key: string, body: Buffer) {
    await getS3Client().send(
        new PutObjectCommand({
            Bucket: getBucketName(),
            Key: key,
            Body: body,
        }),
    );
}

export async function putObjectFromFile(key: string, localFilePath: string) {
    const body = await fs.readFile(localFilePath);
    await getS3Client().send(
        new PutObjectCommand({
            Bucket: getBucketName(),
            Key: key,
            Body: body,
        }),
    );
}

export async function getObjectBytes(key: string): Promise<Buffer | null> {
    const response = await getS3Client().send(
        new GetObjectCommand({
            Bucket: getBucketName(),
            Key: key,
        }),
    );
    if (!response.Body) {
        return null;
    }
    return Buffer.from(await response.Body.transformToByteArray());
}

export async function deleteObjectsByPrefix(prefix: string): Promise<number> {
    const keys = await listObjectKeys(prefix);
    if (keys.length === 0) return 0;

    const bucket = getBucketName();
    const client = getS3Client();
    // DeleteObjects accepts at most 1000 keys per call
    for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000);
        await client.send(
            new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: {
                    Objects: batch.map((Key) => ({ Key })),
                    Quiet: true,
                },
            }),
        );
    }
    return keys.length;
}

export async function listObjectKeys(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
        const response = await getS3Client().send(
            new ListObjectsV2Command({
                Bucket: getBucketName(),
                Prefix: prefix,
                ContinuationToken: continuationToken,
            }),
        );
        keys.push(
            ...(response.Contents ?? []).flatMap((item) =>
                item.Key ? [item.Key] : [],
            ),
        );
        continuationToken = response.IsTruncated
            ? response.NextContinuationToken
            : undefined;
    } while (continuationToken);
    return keys;
}
