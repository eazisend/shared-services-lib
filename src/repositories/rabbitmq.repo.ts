import amqp, { Channel, ChannelModel } from 'amqplib';
import {libConfig} from "../config";

class RabbitmqRepo {

    private queueChannel: Channel | undefined;
    private pendingConnection: Promise<Channel | undefined> | undefined;

    /**
     * Returns the shared channel, creating a connection when necessary.
     *
     * @example
     * ```ts
     * const channel = await rabbitmqRepo.getQueueConnection();
     * ```
     */
    public async getQueueConnection(): Promise<Channel | undefined> {
        if (this.queueChannel) {
            return this.queueChannel;
        }
        if (this.pendingConnection) {
            return this.pendingConnection;
        }
        this.pendingConnection = this.createQueueConnection();
        try {
            return await this.pendingConnection;
        } finally {
            this.pendingConnection = undefined;
        }
    }

    private async createQueueConnection(): Promise<Channel | undefined> {
        let connection: ChannelModel | undefined;
        try {
            connection = await amqp.connect(libConfig.RABBITMQ_URL);
            const channel: Channel = await connection.createChannel();
            const clearChannel = () => {
                if (this.queueChannel === channel) {
                    this.queueChannel = undefined;
                }
            };
            channel.on('error', (error) => {
                clearChannel();
                console.error('RabbitmqRepo channel error:', error);
            });
            channel.once('close', clearChannel);
            connection.on('error', (error) => {
                clearChannel();
                console.error('RabbitmqRepo connection error:', error);
            });
            connection.once('close', clearChannel);
            console.log('RabbitmqRepo connected to queue successfully...');
            this.closeConnection(channel, connection);
            this.queueChannel = channel;
            return channel;
        } catch (error) {
            if (connection) {
                await connection.close().catch((closeError) => {
                    console.error('RabbitmqRepo error closing failed connection:', closeError);
                });
            }
            console.error('RabbitmqRepo error creating connection:', error);
            return undefined;
        }
    }


    /**
     * Closes the channel and connection when the application shuts down.
     */
    private closeConnection(channel: Channel, connection: ChannelModel): void {
        let isClosing = false;

        const close = async (signal: NodeJS.Signals): Promise<void> => {
            if (isClosing) {
                return;
            }

            isClosing = true;

            try {
                try {
                    await channel.close();
                } finally {
                    await connection.close();
                }
                console.log(`RabbitmqRepo queue connection closed after ${signal}`);
            } catch (error) {
                console.error('RabbitmqRepo error closing connection:', error);
            }
        };

        process.once('SIGINT', close);
        process.once('SIGTERM', close);
        connection.once('close', () => {
            process.removeListener('SIGINT', close);
            process.removeListener('SIGTERM', close);
        });
    }

    /**
     * Establishes the shared RabbitMQ connection during application startup.
     *
     * @example
     * ```ts
     * await rabbitmqRepo.establishQueueConnection();
     * ```
     */
    public async establishQueueConnection(): Promise<void> {
        const channel = await this.getQueueConnection();
        if (!channel) {
            throw new Error("No channel found.");
        }
    }

    private async connectQueueToExchange(channel: Channel, exchange: string, queueName: string, routingKey: string, exchangeType: 'direct' | 'fanout') {
        await channel.assertExchange(exchange, exchangeType);
        const q = await channel.assertQueue(queueName, {durable: true, autoDelete: false});
        await channel.bindQueue(q.queue, exchange, routingKey);
        return  q;
    }

    /**
     * Publishes a typed payload as JSON using the supplied exchange and routing key.
     *
     * @example
     * ```ts
     * await rabbitmqRepo.publishMessageToQueue<EmailPayload>({
     *     exchange: 'notifications',
     *     routingKey: 'email',
     *     message: { receiverEmail, username, verifyLink, resetLink },
     *     logMessage: 'Email notification published',
     * });
     * ```
     */
    public async publishMessageToQueue<T>(args: { exchange: string; routingKey: string; message: T, logMessage?: string; exchangeType?: 'direct' | 'fanout' }): Promise<void> {

        const serializedMessage = JSON.stringify(args.message);
        if (serializedMessage === undefined) {
            throw new Error("Message must be JSON serializable.");
        }
        const channel = await this.getQueueConnection()
        const { exchange, routingKey, logMessage, exchangeType } = args;
        if (!channel) {
            throw new Error("No channel found.");
        }

        await channel.assertExchange(exchange, exchangeType || 'direct');
        channel.publish(exchange, routingKey, Buffer.from(serializedMessage));

        if (logMessage) {
            console.log(logMessage)
        }

    }


    /**
     * Consumes JSON messages and acknowledges them after the callback succeeds.
     * Prefetch defaults to 10 when omitted.
     *
     * @example
     * ```ts
     * await rabbitmqRepo.consumeMessagesFromQueue<EmailPayload>({
     *     exchange: 'notifications',
     *     queueName: 'email-queue',
     *     routingKey: 'email',
     *     prefetch: 5,
     *     callback: async ({ receiverEmail, username, verifyLink, resetLink }) => {
     *         // Process the email.
     *     },
     * });
     * ```
     */
    public async consumeMessagesFromQueue<T = unknown>(args: {
        exchange: string;
        queueName: string;
        routingKey: string;
        callback: (payload: T) => void | Promise<void>;
        channel?: Channel;
        exchangeType?: 'direct' | 'fanout';
        prefetch?: number;
    }): Promise<void> {
        const { exchange, queueName, routingKey, callback } = args;
        const prefetch = args.prefetch ?? 10;
        if (!Number.isInteger(prefetch) || prefetch < 1 || prefetch > 65535) {
            throw new Error("Prefetch must be an integer between 1 and 65535.");
        }
        const channel = args.channel ?? await this.getQueueConnection();

        if (!channel) {
            throw new Error("No channel found.");
        }
        const q = await this.connectQueueToExchange(channel, exchange, queueName, routingKey, args.exchangeType ?? 'direct');
        await channel.prefetch(prefetch, false);

        await channel.consume(q.queue, async (message) => {
            if (!message){
                return;
            }
            try {
                let payload: T;
                try {
                    payload = JSON.parse(message.content.toString());
                } catch (error) {
                    console.error('RabbitmqRepo invalid JSON message:', error);
                    channel.nack(message, false, false);
                    return;
                }
                try {
                    await callback(payload);
                } catch (error) {
                    console.error('RabbitmqRepo message callback failed:', error);
                    channel.nack(message, false, true);
                    return;
                }
                channel.ack(message);
            } catch (error) {
                console.error('RabbitmqRepo error settling message:', error);
            }
        })

    }

}

export const rabbitmqRepo = new RabbitmqRepo();
