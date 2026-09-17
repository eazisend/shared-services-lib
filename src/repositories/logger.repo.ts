import winston, {Logger, LogEntry} from 'winston';
import {ElasticsearchTransformer, ElasticsearchTransport, LogData, TransformedData} from 'winston-elasticsearch';
import {libConfig} from "../config";
import {LogLevelTypes} from "../types/log.level.types";

class LoggerRepo {

    private logger?: Logger;

    private esTransformer = (logData: LogData): TransformedData => {
        return ElasticsearchTransformer(logData);
    }

    public getInstance = (identifier: string, level: LogLevelTypes = LogLevelTypes.DEBUG): LoggerRepo => {
        const elasticsearchNode = libConfig.ELASTIC_SEARCH_NODE_URL;
        const options = {
            console: {
                level,
                handleExceptions: true,
                json: false,
                colorize: true
            },
            elasticsearch: {
                level,
                transformer: this.esTransformer,
                clientOpts: {
                    node: elasticsearchNode,
                    log: level,
                    maxRetries: 2,
                    requestTimeout: 10000,
                    sniffOnStart: false
                }
            }
        };
        const esTransport: ElasticsearchTransport = new ElasticsearchTransport(options.elasticsearch);
        this.logger = winston.createLogger({
            exitOnError: false,
            defaultMeta: {service: identifier},
            transports: [new winston.transports.Console(options.console), esTransport]
        });

        return this;
    }

    public log(entry: LogEntry): void;
    public log(level: string, message: string, ...meta: unknown[]): void;
    public log(level: string, message: unknown): void;
    public log(levelOrEntry: string | LogEntry, message?: unknown, ...meta: unknown[]): void {
        if(!this.logger) {
            throw new Error("No Instance Created For logger")
        }
        if (typeof levelOrEntry === 'string') {
            if (typeof message === 'string') {
                this.logger.log(levelOrEntry, message, ...meta);
            } else {
                this.logger.log(levelOrEntry, message);
            }
        } else {
            this.logger.log(levelOrEntry);
        }
    }
}

export const loggerRepo = new LoggerRepo();
