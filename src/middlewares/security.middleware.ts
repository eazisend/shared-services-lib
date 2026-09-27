import {Express} from "express";
import hpp from "hpp";
import helmet from "helmet";
import cors from "cors";
import {libConfig} from "../config";

export function registerSecurityMiddleware(app: Express, args?: { origin?: string } ) {
    const { origin } = args ? args :  {};
    app.set("trust proxy", true);
    app.use(hpp());
    app.use(helmet());
    app.use(cors({
        origin: origin ?? libConfig.API_GATEWAY_URL,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }))
}

