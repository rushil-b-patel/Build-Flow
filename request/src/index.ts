import "dotenv/config";
import path from "path";
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

function candidateFiles(filePath: string): string[] {
    if (filePath === "/") {
        return ["/index.html"];
    }
    const hasExtension = path.posix.extname(filePath) !== "";
    if (hasExtension) {
        return [filePath];
    }
    const trimmed = filePath.replace(/\/$/, "");
    return [`${trimmed}.html`, `${trimmed}/index.html`];
}

async function fetchFirstExisting(
    id: string,
    candidates: string[],
): Promise<{ key: string; contents: Buffer } | null> {
    for (const candidate of candidates) {
        const contents = await getObjectBytes(`dist/${id}${candidate}`);
        if (contents) {
            return { key: candidate, contents: contents as Buffer };
        }
    }
    return null;
}

app.get("/*", async (req, res) => {
    const host = req.hostname;
    const subdomain = host.split(".")[0];
    const filePath = req.path;

    try {
        const id = await resolveSiteId(subdomain);

        let result = await fetchFirstExisting(id, candidateFiles(filePath));

        if (!result && path.posix.extname(filePath) === "") {
            result = await fetchFirstExisting(id, ["/index.html"]);
        }

        if (!result) {
            res.status(404).send("Not found");
            return;
        }

        const type = mime.lookup(result.key) || "application/octet-stream";
        res.set("Content-Type", type);
        res.send(result.contents);
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
