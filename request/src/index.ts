import express, { Request, Response } from "express";
import mime from 'mime-types';
import { loadEnv } from "@shared/env";
import { getObjectBuffer } from "@shared/storage";

loadEnv();

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.get("/*", async (req: Request, res: Response) => {
    const host = req.hostname;
    const id = host.split(".")[0];
    // resolve root to index.html
    const filePath = req.path === "/" ? "/index.html" : req.path;

    try {
        const contents = await getObjectBuffer(`dist/${id}${filePath}`);

        const type = mime.lookup(filePath) || 'application/octet-stream';
        res.set("Content-Type", type);
        res.send(contents);
    } catch (err: any) {
        if (err.code === 'NoSuchKey') {
            res.status(404).send('Not found');
        } else {
            res.status(500).send('Server error');
        }
    }
})

app.listen(PORT, () => {
    console.log("request server is live")
})
