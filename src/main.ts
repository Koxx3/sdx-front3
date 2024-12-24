// src/main.ts

import * as vscode from 'vscode';

import '@codingame/monaco-vscode-python-default-extension';
import "@codingame/monaco-vscode-theme-defaults-default-extension";

import './style.css';
import * as monaco from 'monaco-editor';
import { initialize } from 'vscode/services';

// Import necessary overrides
import "vscode/localExtensionHost";
import { initWebSocketAndStartClient } from './lsp-client';
import getLanguagesServiceOverride from "@codingame/monaco-vscode-languages-service-override";
import getThemeServiceOverride from "@codingame/monaco-vscode-theme-service-override";
import getTextMateServiceOverride from "@codingame/monaco-vscode-textmate-service-override";
import getKeybindingsServiceOverride from '@codingame/monaco-vscode-keybindings-service-override';
import getConfigurationServiceOverride, { updateUserConfiguration } from '@codingame/monaco-vscode-configuration-service-override';

import { RegisteredFileSystemProvider, registerFileSystemOverlay, RegisteredMemoryFile } from '@codingame/monaco-vscode-files-service-override';
import { ExtensionHostKind, registerExtension } from 'vscode/extensions';
import { Uri } from 'vscode';
import { createConfiguredEditor, createModelReference } from 'vscode/monaco';
import { MonacoLanguageClient } from 'monaco-languageclient';

const languageId = 'python';

let languageClient: MonacoLanguageClient | null = null;

const FILE_PATH = '/workspace/demo/project/project1/main2.py';

// Define the content of main.py and lib1.py with type annotations and docstrings

// Define the content of main.py and lib1.py with type annotations and docstrings
const MAIN_PY = `#######################################################################
# USE IN ALL SCRIPTS - Ensure print statements are flushed immediately
from demo.project.libs.lib2 import add_numbers
import functools
print = functools.partial(print, flush=True)
#######################################################################

def multiply3(a: int, b: int) -> int:
    """
    Multiplies two integers and returns the result.

    Parameters:
        a (int): The first integer to multiply.
        b (int): The second integer to multiply.

    Returns:
        int: The product of a and b.
    """
    return a * b


def main():
    print("--- start ---")
    print("Executing main.py")
    result = add_numbers(1)  # Intentional error: missing second argument
    multiply3()             # Intentional error: missing arguments
    print(f"The result is: {result}")
    print("--- end ---")

def say(what):
    print(what)


if __name__ == "__main__":
    main()
    say()  # no error?

  xfsd
     
`;

const LIB2_PY = `# libs/lib2.py

def add_numbers(a: int, b: int) -> int:
    """
    Adds two integers and returns the result.

    Parameters:
        a (int): The first integer to add.
        b (int): The second integer to add.

    Returns:
        int: The sum of a and b.
    """
    return a + b
`

let files: { [id: string]: string } = {
    '/workspace/demo/project/project1/main2.py': MAIN_PY,
    '/workspace/demo/project/libs/lib2.py': LIB2_PY,
};

// Worker loaders
export type WorkerLoader = () => Worker;
const workerLoaders: Partial<Record<string, WorkerLoader>> = {
    TextEditorWorker: () => new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), { type: 'module' }),
    TextMateWorker: () => new Worker(new URL('@codingame/monaco-vscode-textmate-service-override/worker', import.meta.url), { type: 'module' })
};

window.MonacoEnvironment = {
    getWorker: function (_moduleId, label) {
        console.log('getWorker', _moduleId, label);
        const workerFactory = workerLoaders[label];
        if (workerFactory != null) {
            return workerFactory();
        }
        throw new Error(`Worker ${label} not found`);
    }
};

const startPythonClient = async () => {
    console.log('Starting initServices ...');

    // Initialize vscode-api with all necessary overrides
    await initialize({
        ...getTextMateServiceOverride(),
        ...getThemeServiceOverride(),
        ...getLanguagesServiceOverride(),
        ...getConfigurationServiceOverride(),
        // ...getKeybindingsServiceOverride() // Ensure keybindings are included
    });

    updateUserConfiguration(`{
        "editor.fontSize": 14,
        "workbench.colorTheme": "Default Dark Modern"
    }`);

    // Extension configuration derived from pylsp's configuration
    const extension = {
        name: 'python-client',
        publisher: 'monaco-languageclient-project',
        version: '1.0.0',
        engines: {
            vscode: '^1.78.0'
        },
        contributes: {
            languages: [{
                id: languageId,
                aliases: ['Python'],
                extensions: ['.py']
            }],
            commands: [
                {
                    command: 'pylsp.restartserver',
                    title: 'pylsp: Restart Server',
                    category: 'pylsp'
                },
                {
                    command: 'pylsp.organizeimports',
                    title: 'pylsp: Organize Imports',
                    category: 'pylsp'
                }
            ],
            keybindings: [{
                key: 'ctrl+k',
                command: 'pylsp.restartserver',
                when: 'editorTextFocus'
            }]
        }
    };
    registerExtension(extension, ExtensionHostKind.LocalProcess);

    // Register file system overlay with files
    const fileSystemProvider = new RegisteredFileSystemProvider(false);
    for (const [filePath, content] of Object.entries(files)) {
        fileSystemProvider.registerFile(new RegisteredMemoryFile(Uri.file(filePath), content));
    }
    registerFileSystemOverlay(1, fileSystemProvider);

    // Create Model Reference and Configure Editor
    // const modelRef = await createModelReference(monaco.Uri.file(FILE_PATH));
    // modelRef.object.setLanguageId(languageId);

    // createConfiguredEditor(document.getElementById('editor')!, {
    //     model: modelRef.object.textEditorModel,
    //     automaticLayout: true
    // });

    // Register Commands
    const registerCommand = async (cmdName: string, handler: (...args: unknown[]) => void) => {
        const commands = await vscode.commands.getCommands(true);
        if (!commands.includes(cmdName)) {
            vscode.commands.registerCommand(cmdName, handler);
        }
    };

    //await registerCommand('pylsp.restartserver', (...args: unknown[]) => {
    //    if (languageClient) {
    //        languageClient.sendRequest('workspace/executeCommand', { command: 'pylsp.restartserver', arguments: args });
    //    }
    //});

    //await registerCommand('pylsp.organizeimports', (...args: unknown[]) => {
    //    if (languageClient) {
    //        languageClient.sendRequest('workspace/executeCommand', { command: 'pylsp.organizeimports', arguments: args });
    //    }
    //});

    // Start WebSocket LSP client
    const LS_WS_URL = 'ws://localhost:5007/'; // Ensure this URL is correct
    console.info(`Connecting to pylsp WebSocket at ${LS_WS_URL}`);
    initWebSocketAndStartClient(LS_WS_URL, 5000, files);

    monaco.editor.create(document.getElementById('editor')!, {
        value: MAIN_PY,
        language: 'python'
    });
};

// Start the Python client automatically when the script loads
startPythonClient();
