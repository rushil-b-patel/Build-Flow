import "dotenv/config";
import express from "express";
import mime from "mime-types";
import { getObjectBytes } from "@backend-core/s3";
import { ensureRedisConnection } from "@backend-core/redis-connection";
import { getDeploymentIdBySlug } from "@backend-core/slugs";

const app = express();

async function resolveSiteId(subdomain: string): Promise<string> {
    const mapped = await getDeploymentIdBySlug(subdomain);
    return mapped ?? subdomain;
}

app.get("/*", async (req, res) => {
    const host = req.hostname;
    const subdomain = host.split(".")[0];
    const filePath = req.path === "/" ? "/index.html" : req.path;

    try {
        const id = await resolveSiteId(subdomain);
        const contents = await getObjectBytes(`dist/${id}${filePath}`);
        if (!contents) {
            res.status(404).send("Not found");
            return;
        }
        const type = mime.lookup(filePath) || "application/octet-stream";
        res.set("Content-Type", type);
        res.send(contents);
    } catch (error) {
        const name = (error as { name?: string }).name;
        if (name === "NoSuchKey" || name === "NotFound") {
            res.status(404).send("Not found");
            return;
        }
        res.status(500).send("Server error");
    }
});

async function start() {
    await ensureRedisConnection();
    app.listen(3001, () => {
        console.log("request server is live");
    });
}

start().catch((error) => {
    console.error("Failed to start request server", error);
    process.exit(1);
});
