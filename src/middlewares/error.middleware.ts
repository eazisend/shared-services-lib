import {Application, Request, Response, NextFunction} from "express";
import {LogLevelTypes} from "../types/log.level.types";
import {loggerRepo} from "../repositories/logger.repo";
import {StatusCodes} from "http-status-codes";

const logger = loggerRepo.getInstance(import.meta.url);

export function registerErrorMiddleware(app: Application) {
    return (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
        logger.log(LogLevelTypes.ERROR, 'GatewayService custom error', {
            name: err.name,
            message: err.message,
        });
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: err.message });
    }
}