// config.ts
import * as vscode from 'vscode';
import * as monaco from 'monaco-editor';

import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override';
import getTextmateServiceOverride from '@codingame/monaco-vscode-textmate-service-override';

import '@codingame/monaco-vscode-python-default-extension';

import { LogLevel } from 'vscode/services';
import { MonacoLanguageClient } from 'monaco-languageclient';
import { createUrl } from 'monaco-languageclient/tools';
import { WrapperConfig } from 'monaco-editor-wrapper';
import { configureMonacoWorkers } from './utils.js';

// Import the reconnecting WebSocket
import { getOrCreatePyrightWebSocket } from './pyrightWebSocket';

export const createUserConfig = (
  workspaceRoot: string,
  code: string,
  codeUri: string
): WrapperConfig => {

  const url = createUrl({
    secured: false,
    host: 'smartelec.eu.org',
    port: 2088,
    path: 'pyright',
    extraParams: {
      authorization: 'UserAuth'
    }
  });

  // Get the *raw* WebSocket
  const rawWebSocket = getOrCreatePyrightWebSocket(url);

  return {
    $type: 'extended',
    logLevel: LogLevel.Debug,
    languageClientConfigs: {
      python: {
        name: 'Python Language Server Example',

        connection: {
          // Let the wrapper create & manage message transports internally
          options: {
            $type: 'WebSocketDirect',
            // Pass the *raw* WebSocket so the wrapper can check readyState
            webSocket: rawWebSocket,
            startOptions: {
              onCall: (languageClient?: MonacoLanguageClient) => {
                // If you want to register commands, etc.
                setTimeout(() => {
                  [
                    'pyright.restartserver',
                    'pyright.organizeimports'
                  ].forEach((cmdName) => {
                    vscode.commands.registerCommand(cmdName, (...args: unknown[]) => {
                      languageClient?.sendRequest('workspace/executeCommand', {
                        command: cmdName,
                        arguments: args
                      });
                    });
                  });
                }, 250);
              },
              reportStatus: true
            }
          }
        },

        clientOptions: {
          documentSelector: ['python'],
          workspaceFolder: {
            index: 0,
            name: 'workspace',
            uri: vscode.Uri.parse(workspaceRoot)
          }
        }
      }
    },

    vscodeApiConfig: {
      serviceOverrides: {
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
          uri: codeUri
        }
      },
      useDiffEditor: false,
      monacoWorkerFactory: configureMonacoWorkers
    }
  };
};
