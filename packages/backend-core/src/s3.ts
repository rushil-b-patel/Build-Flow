import { promises as fs } from "fs";
import {
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
