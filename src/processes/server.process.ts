import {Express} from "express";
import {libConfig} from "../config";

export function listenToServer(app: Express) {
    try {
        app.listen(libConfig.PORT, () => {
            // log.info(`Gateway STARTED! -- Server listening on port ${port}`);
        })
    }catch (error) {
        // log.error('Error starting the server:', error);
        process.exit(1);
    }
}