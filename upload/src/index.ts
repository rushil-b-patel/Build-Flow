import express from 'express';
import cors from 'cors';
import simpleGit from 'simple-git';
import path from 'path';
import { createClient } from 'redis';
import { generate, getAllFiles } from './utils'
import { uploadFiles } from './upload';

const app = express();
const publisher = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});
publisher.connect();

const subscriber = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});
subscriber.connect();

app.use(cors());
app.use(express.json());

app.post('/deploy', async (req, res) => {
    try{
        const repoUrl = req.body.repoUrl;
        const id = generate();
        const dirName = path.join(__dirname, `output/${id}`)

        await simpleGit().clone(repoUrl, dirName);

        const files = getAllFiles(dirName)
        files.forEach((file) =>{
            const relativePath = file.slice(__dirname.length + 1);
            uploadFiles(relativePath, file)
        })

        await new Promise((resolve) => setTimeout(resolve, 5000))
        publisher.lPush('build-queue', id);
        publisher.hSet('status', id, 'uploaded');

        res.json({
            id:id,
            files: files
        });
    }catch(err){
        res.status(500).json({message: (err as Error).message})
    }
})

app.get("/status", async (req, res) => {
    const id = req.query.id;
    const response = await subscriber.hGet("status", id as string);
    res.json({
        status: response
    })
})

app.listen(3000, ()=>{
    console.log('upload server is live')
});
