// src/config.ts

import * as vscode from 'vscode';
import * as monaco from 'monaco-editor';

import getKeybindingsServiceOverride from '@codingame/monaco-vscode-keybindings-service-override';
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override';
import getTextmateServiceOverride from '@codingame/monaco-vscode-textmate-service-override';

import '@codingame/monaco-vscode-python-default-extension';

import { LogLevel } from 'vscode/services';
import { MonacoLanguageClient } from 'monaco-languageclient';
import { createUrl } from 'monaco-languageclient/tools';
import { WrapperConfig } from 'monaco-editor-wrapper';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';
import { configureMonacoWorkers } from './utils.js';

export const createUserConfig = (workspaceRoot: string, code: string, codeUri: string): WrapperConfig => {
    // smartelec.eu.org:2087
    const url = createUrl({
        secured: false,
        host: 'smartelec.eu.org',
        port: 2088,
        path: 'pyright',
        extraParams: {
            authorization: 'UserAuth'
        }
    });
    const webSocket = new WebSocket(url);
    const iWebSocket = toSocket(webSocket);
    const reader = new WebSocketMessageReader(iWebSocket);
    const writer = new WebSocketMessageWriter(iWebSocket);

    return {
        $type: 'extended',
        // htmlContainer: document.getElementById('monaco-editor-root')!,
        logLevel: LogLevel.Debug,
        languageClientConfigs: {
            python: {
                name: 'Python Language Server Example',
                connection: {
                    options: {
                        $type: 'WebSocketDirect',
                        webSocket: webSocket,
                        startOptions: {
                            onCall: (languageClient?: MonacoLanguageClient) => {
                                setTimeout(() => {
                                    ['pyright.restartserver', 'pyright.organizeimports'].forEach((cmdName) => {
                                        vscode.commands.registerCommand(cmdName, (...args: unknown[]) => {
                                            languageClient?.sendRequest('workspace/executeCommand', { command: cmdName, arguments: args });
                                        });
                                    });
                                }, 250);
                            },
                            reportStatus: true,
                        }
                    },
                    messageTransports: { reader, writer }
                },
                clientOptions: {
                    documentSelector: ['python'],
                    workspaceFolder: {
                        index: 0,
                        name: 'workspace',
                        uri: vscode.Uri.parse(workspaceRoot)
                    },
                    initializationOptions: {
                        // files,
                        // "pylsp": {
                        //     "plugins": {
                        //         "pycodestyle": { "enabled": true },
                        //     }
                        // }
                        // "pylsp": {
                        //     "plugins": {
                        //         "flake8": { "enabled": false },
                        //         "pyflakes": { "enabled": false },
                        //         "pycodestyle": { "enabled": false },
                        //         "mypy": {
                        //             "enabled": true,
                        //             "live_mode": true,
                        //             "strict": true,
                        //             // "dmypy": false,  // Set to true if you want to use daemonized mypy for performance
                        //             // "config": "/workspace/mypy.ini"  // Path to a mypy configuration file, if required
                        //         },
                        //         "pylint": { "enabled": true, "executable": "pylint" },
                        //         // "pylint": {
                        //         //     "enabled": true,
                        //         //     "args": [
                        //         //         // "--init-hook=exec('import sys; sys.path.append(\\'/workspace\\')')"
                        //         //     ] // Ensures /workspace is in PYTHONPATH
                        //         // },
                        //         "jedi_completion": { "enabled": false },  // Ensure jed
                        //         "rope_autoimport": { "enabled": false },  // Re-enable
                        //         "rope_completion": { "enabled": false },   // Re-enable
                        //         "mccabe": { "enabled": false }             // Re-enable
                        //     }
                        //     // "pylsp": {
                        //     //     "plugins": {
                        //     //         "mypy": { "enabled": false },  // Optional for type checking
                        //     //         "pyflakes": { "enabled": false },
                        //     //         "pycodestyle": { "enabled": false },
                        //     //         "pylint": { "enabled": false },
                        //     //         // "pylint": {
                        //     //         //     "enabled": true,
                        //     //         //     "args": [
                        //     //         //         // "--init-hook=exec('import sys; sys.path.append(\\'/workspace\\')')"
                        //     //         //     ] // Ensures /workspace is in PYTHONPATH
                        //     //         // },
                        //     //         "jedi_completion": { "enabled": false },  // Ensure jed
                        //     //         "rope_autoimport": { "enabled": false },  // Re-enable
                        //     //         "rope_completion": { "enabled": false },   // Re-enable
                        //     //         "mccabe": { "enabled": false }             // Re-enable
                        //     //     }
                        // }
                    }
                }
            }
        },
        vscodeApiConfig: {
            serviceOverrides: {
                // ...getKeybindingsServiceOverride(),
                ...getThemeServiceOverride(),
                ...getTextmateServiceOverride()
            },
            userConfiguration: {
                json: JSON.stringify({
                    'workbench.colorTheme': 'Default Dark Modern',
                    'editor.guides.bracketPairsHorizontal': 'active',
                    'editor.wordBasedSuggestions': 'off',
                    'editor.experimental.asyncTokenization': true
                })
            }
        },
        editorAppConfig: {
            codeResources: {
                modified: {
                    text: code,
                    uri: codeUri,
                }
            },
            useDiffEditor: false,
            monacoWorkerFactory: configureMonacoWorkers,
            // htmlContainer: document.getElementById('application'),
        }
    };

};
