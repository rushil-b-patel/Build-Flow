import express from 'express';
import cors from 'cors';
import simpleGit from 'simple-git';
import path from 'path';
import { createClient } from 'redis';
import { generate, getAllFiles } from './utils'
import { uploadFiles } from './upload';

const app = express();
const redis = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});
redis.connect();

app.use(cors());
app.use(express.json());

app.post('/deploy', async (req, res) => {
    const id = generate();
    const repoUrl = req.body.repoUrl as string | undefined;
    const dirName = path.join(__dirname, `output/${id}`)

    if (!repoUrl) {
        res.status(400).json({ message: "repoUrl is required" });
        return;
    }

    try{
        await redis.hSet(`status:${id}`, { state: "cloning" });
        await redis.rPush(`logs:${id}`, "Cloning repository");
        await simpleGit().clone(repoUrl, dirName);

        await redis.hSet(`status:${id}`, { state: "uploading" });
        await redis.rPush(`logs:${id}`, "Repository cloned. Uploading files to object storage");
        const files = getAllFiles(dirName)
        await Promise.all(files.map((file) => {
            const relativePath = file.slice(__dirname.length + 1);
            return uploadFiles(relativePath, file);
        }));
        await redis.rPush(`logs:${id}`, "Upload complete. Added to build queue");
        await redis.hSet(`status:${id}`, { state: "queued" });
        await redis.lPush('build-queue', id);

        res.json({
            id:id,
            files: files
        });
    }catch(err){
        await redis.hSet(`status:${id}`, {
            state: "error",
            error: (err as Error).message
        });
        await redis.rPush(`logs:${id}`, `Error: ${(err as Error).message}`);
        res.status(500).json({message: (err as Error).message})
    }
})

app.get("/logs", async (req, res) => {
  const id = req.query.id as string;
  if (!id) {
    res.status(400).json({ message: "id is required" });
    return;
  }
  const logs = await redis.lRange(`logs:${id}`, 0, -1);
  res.json({ logs });
});

app.get("/status", async (req, res) => {
    const id = req.query.id as string;
    if (!id) {
        res.status(400).json({ message: "id is required" });
        return;
    }
    const status = await redis.hGetAll(`status:${id}`);
    res.json({
        status
    })
})

app.listen(3000, ()=>{
    console.log('upload server is live')
});
