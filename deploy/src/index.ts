import { commandOptions } from 'redis';
import { copyFinalDist, downloadS3Folder } from './aws';
import { buildProject } from './build';
import { log, setStatus } from './log';
import { ensureRedisConnection, redis } from './redis';

async function main(){
    await ensureRedisConnection();
    while(1){
        const response = await redis.brPop(
            commandOptions({isolated: true}),
            'build-queue',
            0
        );

        if (!response?.element) {
            continue;
        }

        const id = response.element;
        try{
            await log(id, "Build picked up by worker");
            await downloadS3Folder(`output/${id}`)
            await buildProject(id);
            await copyFinalDist(id);
            await setStatus(id, "deployed");
            await log(id, "Deployment completed successfully");
        } catch(err){
            const message = (err as Error).message;
            await setStatus(id, "error", message);
            await log(id, `Deployment failed: ${message}`);
        }
    }
}

main();
