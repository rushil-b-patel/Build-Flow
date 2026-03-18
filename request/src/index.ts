import "dotenv/config";
import express from "express";
import mime from "mime-types";
import { getObjectBytes } from "@backend-core/s3";

const app = express();

app.get("/*", async (req, res) => {
    const host = req.hostname;
    const id = host.split(".")[0];
    const filePath = req.path === "/" ? "/index.html" : req.path;

    try {
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

app.listen(3001, () => {
    console.log("request server is live");
});
