import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import {libConfig} from "../config";

export function verifyGatewayRequest(serviceId: string) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.headers?.gatewaytoken) {
            throw new Error('Invalid request: verifyGatewayRequest() method: Request not coming from api gateway');
        }
        const token: string = req.headers.gatewaytoken as string;
        if (!token) {
            throw new Error('Invalid request: verifyGatewayRequest() method: Request not coming from api gateway');
        }

        const payload: { id: string; iat: number } = jwt.verify(token, libConfig.GATEWAY_TOKEN) as { id: string; iat: number };
        if (serviceId !== payload.id) {
            throw new Error('Invalid request: verifyGatewayRequest() method: Request payload is invalid');
        }
        next();
    };
}
