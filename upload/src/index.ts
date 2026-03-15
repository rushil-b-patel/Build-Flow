import express from 'express';
import cors from 'cors';
import simpleGit from 'simple-git';
import path from 'path';
import { createClient } from 'redis';
import { generate, getAllFiles } from './utils'
import { uploadFiles } from './upload';
import { initDB, insertDeployment, updateDeploymentStatus, getDeployments } from './db';
import {
    exchangeCodeForToken,
    getGitHubUser,
    authMiddleware,
    optionalAuthMiddleware,
    getOptionalUser,
    GITHUB_CLIENT_ID,
} from './auth';

const app = express();
const redis = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});
redis.connect();

app.use(cors());
app.use(express.json());

// GitHub OAuth

app.get('/auth/github', (_req, res) => {
    const redirect = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=read:user`;
    res.json({ url: redirect });
});

app.get('/auth/github/callback', async (req, res) => {
    const code = req.query.code as string | undefined;
    if (!code) {
        res.status(400).json({ message: 'code is required' });
        return;
    }
    try {
        const token = await exchangeCodeForToken(code);
        const user = await getGitHubUser(token);
        console.log(user);
        res.json({ token, user });
    } catch (err) {
        res.status(401).json({ message: (err as Error).message });
    }
});

app.get('/auth/me', authMiddleware, (req, res) => {
    res.json({ user: (req as any).githubUser });
});

// Deploy

app.post('/deploy', optionalAuthMiddleware, async (req, res) => {
    const id = generate();
    const repoUrl = req.body.repoUrl as string | undefined;
    const dirName = path.join(__dirname, `output/${id}`)
    const githubUser = getOptionalUser(req);

    if (!repoUrl) {
        res.status(400).json({ message: "repoUrl is required" });
        return;
    }

    try{
        await redis.hSet(`status:${id}`, { state: "cloning" });
        await redis.rPush(`logs:${id}`, "Cloning repository");

        // Persist to PostgreSQL
        try {
            await insertDeployment(id, repoUrl, githubUser?.login);
        } catch (dbErr) {
            console.error("DB insert failed (non-fatal):", dbErr);
        }

        await simpleGit().clone(repoUrl, dirName);

        await redis.hSet(`status:${id}`, { state: "uploading" });
        await redis.rPush(`logs:${id}`, "Repository cloned. Uploading files to object storage");

        try {
            await updateDeploymentStatus(id, "uploading");
        } catch (dbErr) {
            console.error("DB update failed (non-fatal):", dbErr);
        }

        const files = getAllFiles(dirName)
        await Promise.all(files.map((file) => {
            const relativePath = file.slice(__dirname.length + 1);
            return uploadFiles(relativePath, file);
        }));
        await redis.rPush(`logs:${id}`, "Upload complete. Added to build queue");
        await redis.hSet(`status:${id}`, { state: "queued" });
        await redis.lPush('build-queue', id);

        try {
            await updateDeploymentStatus(id, "queued");
        } catch (dbErr) {
            console.error("DB update failed (non-fatal):", dbErr);
        }

        res.json({
            id: id,
            files: files
        });
    }catch(err){
        await redis.hSet(`status:${id}`, {
            state: "error",
            error: (err as Error).message
        });
        await redis.rPush(`logs:${id}`, `Error: ${(err as Error).message}`);

        try {
            await updateDeploymentStatus(id, "error", (err as Error).message);
        } catch (dbErr) {
            console.error("DB update failed (non-fatal):", dbErr);
        }

        res.status(500).json({message: (err as Error).message})
    }
})

// Logs & Status

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

    // Sync status into PostgreSQL
    if (status.state) {
        try {
            await updateDeploymentStatus(id, status.state, status.error);
        } catch (dbErr) {
            console.error("DB status sync failed (non-fatal):", dbErr);
        }
    }

    res.json({
        status
    })
})

// Deployments History

app.get("/deployments", authMiddleware, async (req, res) => {
    try {
        const user = (req as any).githubUser;
        const deployments = await getDeployments(user?.login);
        res.json({ deployments });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

// Start

initDB()
  .then(() => {
    app.listen(3000, () => {
      console.log('upload server is live');
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    app.listen(3000, () => {
      console.log('upload server is live (without database)');
    });
  });
