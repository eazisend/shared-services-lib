import {Client} from "@elastic/elasticsearch";
import {ClusterHealthResponse} from "@elastic/elasticsearch/api/types";
import {libConfig} from "../config";
import {LogLevelTypes} from "../types/log.level.types";

/** Configured Elasticsearch cluster */
class ElasticsearchRepo {

    private elasticSearchClient: Client;

    /** Creates an Elasticsearch client using the configured cluster URL. */
    constructor() {
        this.elasticSearchClient = new Client({
            node: libConfig.ELASTIC_SEARCH_NODE_URL,
        })
    }

    /**  Elasticsearch connection is established. */
    public async establishElasticSearchConnection(args: { serviceName: string }) {
        let isConnected = false;
        // Keep retrying until the cluster responds successfully.
        while (!isConnected) {
            try {
                // Use cluster health as the connection readiness check.
                const health: ClusterHealthResponse = await this.elasticSearchClient.cluster.health({});
                console.log(LogLevelTypes.DEBUG, `${args.serviceName} Elasticsearch health status - ${health.status}`);
                isConnected = true;
            } catch (error) {
                console.log(LogLevelTypes.ERROR,'Connection to Elasticsearch failed. Retrying...');
                console.log(LogLevelTypes.ERROR, `${args.serviceName} checkConnection() method:`, error);
            }
        }
    }
}

// Export a shared Elasticsearch connection manager for the auth service.
export const elasticSearchRepo = new ElasticsearchRepo();
