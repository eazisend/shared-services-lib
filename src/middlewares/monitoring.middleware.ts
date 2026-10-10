import type {Express, Request, RequestHandler} from "express";
import {collectDefaultMetrics, Counter, Gauge, Histogram, Registry} from "prom-client";

export interface MetricsOptions {
    serviceName: string;
}

interface MetricsState {
    serviceName: string;
    registry: Registry;
}

// App identity, rather than a global registry, isolates applications in a process.
const applications = new WeakMap<Express, MetricsState>();
const methods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT", "TRACE"]);

function routeLabel(request: Request): string {
    // Never label with path, originalUrl or baseUrl: all can contain user input.
    const path: unknown = request.route?.path;
    if (typeof path === "string") return path;
    if (Array.isArray(path) && path.every(value => typeof value === "string")) {
        return path.join("|");
    }
    return path instanceof RegExp ? "__regexp__" : "__unmatched__";
}

/**
 * Register before authentication and application routes so GET /metrics bypasses auth.
 * Restrict /metrics to internal access at the Kubernetes networking/Ingress level.
 * Returns an app-local registry for custom metrics (use registers: [registry]).
 * Router labels use leaf templates, omitting potentially dynamic mount prefixes.
 */
export function setupMetrics(app: Express, options: MetricsOptions): Registry {
    if (typeof options?.serviceName !== "string" || !options.serviceName.trim()) {
        throw new Error("Metrics serviceName must be a non-empty string");
    }
    const existing = applications.get(app);
    if (existing) {
        if (existing.serviceName !== options.serviceName) {
            throw new Error("Metrics already initialized with a different serviceName");
        }
        return existing.registry;
    }

    const registry = new Registry();
    registry.setDefaultLabels({service: options.serviceName});
    collectDefaultMetrics({register: registry});

    const labelNames = ["method", "route", "status_code"] as const;
    const requests = new Counter({
        name: "http_requests_total", help: "Completed HTTP requests",
        labelNames, registers: [registry],
    });
    const duration = new Histogram({
        name: "http_request_duration_seconds", help: "HTTP request duration in seconds",
        labelNames, registers: [registry],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });
    const errors = new Counter({
        name: "http_request_errors_total", help: "Completed HTTP requests with 4xx or 5xx status",
        labelNames, registers: [registry],
    });
    const active = new Gauge({
        name: "http_active_requests", help: "HTTP requests currently in progress",
        registers: [registry],
    });
    active.set(0);

    const middleware: RequestHandler = (request, response, next) => {
        // Match Express's default case-insensitive, optional-trailing-slash route behavior.
        if (/^\/metrics\/?$/i.test(request.path)) return next();
        const started = process.hrtime.bigint();
        active.inc();
        let completed = false;
        const complete = () => {
            if (completed) return;
            completed = true;
            response.removeListener("finish", complete);
            response.removeListener("close", complete);
            active.dec();
            const labels = {
                method: methods.has(request.method) ? request.method : "OTHER",
                route: routeLabel(request),
                // A disconnected response has no completed HTTP status.
                status_code: response.writableFinished ? String(response.statusCode) : "aborted",
            };
            requests.inc(labels);
            duration.observe(labels, Number(process.hrtime.bigint() - started) / 1e9);
            if (response.writableFinished && response.statusCode >= 400 && response.statusCode < 600) {
                errors.inc(labels);
            }
        };
        response.once("finish", complete);
        response.once("close", complete);
        next();
    };

    app.use(middleware);
    app.get("/metrics", async (_request, response, next) => {
        try {
            const metrics = await registry.metrics();
            response.setHeader("Content-Type", registry.contentType);
            response.setHeader("Cache-Control", "no-store");
            response.end(metrics);
        } catch (error) {
            next(error);
        }
    });
    applications.set(app, {serviceName: options.serviceName, registry});
    return registry;
}
