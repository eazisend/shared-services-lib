import dotenv from 'dotenv';

// Load the consuming service's .env before constructing shared clients.
dotenv.config({ quiet: true });

class Config {
    public readonly API_GATEWAY_URL: string;
    public readonly GATEWAY_TOKEN: string;
    public readonly ELASTIC_SEARCH_NODE_URL: string;
    public readonly PORT: string;

    constructor() {
        this.API_GATEWAY_URL = process.env.API_GATEWAY_URL || '';
        this.GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';
        this.ELASTIC_SEARCH_NODE_URL = process.env.ELASTIC_SEARCH_NODE_URL || '';
        this.PORT = process.env.PORT || '';
    }
}

export const libConfig: Config = new Config();
