// lsp-client.ts
import * as vscode from 'vscode';
import { WebSocketMessageReader, WebSocketMessageWriter, toSocket } from 'vscode-ws-jsonrpc';
import { CloseAction, ErrorAction } from 'vscode-languageclient';
import { MonacoLanguageClient } from 'monaco-languageclient';
import { Uri } from 'vscode';

const languageId = 'python';
let languageClient: MonacoLanguageClient | null = null;

/**
 * Initializes the WebSocket connection and starts the language client with auto-reconnect.
 * @param url The WebSocket URL of the language server.
 * @param retryInterval The interval (in ms) between reconnection attempts.
 * @param files The initial set of files to load.
 */
export const initWebSocketAndStartClient = (
    url: string,
    retryInterval: number = 5000,
    files: { [id: string]: string } // Updated type
) => {
    let reconnectTimeout: number | null = null;
    let isConnected: boolean = false;

    const connect = () => {
        console.info(`Attempting to connect to pylsp WebSocket at ${url}`);
        const webSocket = new WebSocket(url);

        webSocket.onopen = () => {
            console.log('Language Server WebSocket connection opened.');
            isConnected = true;
            const socket = toSocket(webSocket);
            const reader = new WebSocketMessageReader(socket);
            const writer = new WebSocketMessageWriter(socket);
            const client = createLanguageClient(reader, writer, files);

            client.start();
            languageClient = client;

            // Clear any existing reconnection timeouts
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }

            // Handle WebSocket closure
            webSocket.onclose = () => {
                console.warn('Language Server WebSocket connection closed.');
                isConnected = false;
                if (languageClient) {
                    languageClient.stop();
                    languageClient = null;
                }
                scheduleReconnect();
            };
        };

        webSocket.onerror = (event) => {
            console.error('Language Server WebSocket connection error:', event);
            webSocket.close();
            isConnected = false;
            scheduleReconnect();
        };
    };

    const scheduleReconnect = () => {
        if (!reconnectTimeout) {
            console.info(`Reconnecting in ${retryInterval / 1000} seconds...`);
            reconnectTimeout = window.setTimeout(() => {
                reconnectTimeout = null;
                connect();
            }, retryInterval);
        }
    };

    connect();
};

/**
 * Creates a Monaco Language Client.
 * @param reader The WebSocket message reader.
 * @param writer The WebSocket message writer.
 * @param files The initial set of files to load.
 * @returns A configured MonacoLanguageClient instance.
 */
const createLanguageClient = (
    reader: WebSocketMessageReader,
    writer: WebSocketMessageWriter,
    files: { [id: string]: string } // Updated type
): MonacoLanguageClient => {
    console.log('Creating pylsp Language Client...');
    const client = new MonacoLanguageClient({
        name: 'pylsp Language Client',
        clientOptions: {
            documentSelector: [languageId],
            errorHandler: {
                error: () => ({ action: ErrorAction.Continue }),
                closed: () => ({ action: CloseAction.Restart })
            },
            workspaceFolder: {
                index: 0,
                name: '/workspace',
                uri: Uri.file('/workspace')
            },
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/*.py')
            },
            initializationOptions: {
                files,
                // Add any additional initialization options here
            }
        },
        messageTransports: { reader, writer }
    });

    client.onDidChangeState((event) => {
        console.log('Language Client state changed:', event);
    });

    return client;
};
