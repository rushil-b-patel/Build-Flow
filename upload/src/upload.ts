import { S3 } from 'aws-sdk';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const accessKeyId = process.env.ACCESS_KEY_ID;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
const bucketName = process.env.BUCKET_NAME || "vercel";
const endPoint = process.env.END_POINT;

const s3 = new S3({
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
    endpoint: endPoint
})

export const uploadFiles = async (fileName: string, localFilePath: string) => {
    const fileContent = fs.readFileSync(localFilePath);
    await s3.upload({
        Bucket: bucketName,
        Key: fileName,
        Body: fileContent,
    }).promise();
}
