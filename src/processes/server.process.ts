import {Express} from "express";
import {libConfig} from "../config";
import {loggerRepo} from "../repositories/logger.repo";
import {LogLevelTypes} from "../types/log.level.types";

const logger = loggerRepo.getInstance(import.meta.url);

export function runServer(app: Express) {
    try {
        app.listen(libConfig.PORT, () => {
            logger.log(LogLevelTypes.INFO, `Gateway STARTED! -- Server listening on port ${libConfig.PORT}`);
        })
    }catch (error) {
        logger.log(LogLevelTypes.INFO, 'Error starting the server:', error);
        process.exit(1);
    }
}