class Config {
    public readonly API_GATEWAY_URL: string;
    public readonly ELASTIC_SEARCH_NODE_URL: string;
    public readonly PORT: string;

    constructor() {
        if (!process.env.API_GATEWAY_URL) {
            throw new Error("Missing API_GATEWAY_URL in environment variables");
        } if (!process.env.ELASTIC_SEARCH_NODE_URL) {
            throw new Error("Missing ELASTIC_SEARCH_NODE_URL in environment variables");
        }
        if (!process.env.PORT) {
            throw new Error("Missing PORT in environment variables");
        }
        this.API_GATEWAY_URL = process.env.API_GATEWAY_URL;
        this.ELASTIC_SEARCH_NODE_URL = process.env.ELASTIC_SEARCH_NODE_URL;
        this.PORT = process.env.PORT;
    }
}

export const libConfig: Config = new Config();