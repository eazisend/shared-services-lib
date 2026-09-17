import {Express, json, urlencoded} from "express";
import compression from "compression";

export function enforceStandardMiddleware(app: Express) {
    app.use(compression()); // make size of data smaller
    app.use(json( { limit: '200mb' })); // maximum allowed body size. express throws PayloadTooLargeError if payload size exceeds
    app.use(urlencoded({ extended: true, limit: '200mb' }));
}