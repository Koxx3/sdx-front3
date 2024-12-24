/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2024 TypeFox and others.
 * Licensed under the MIT License. See LICENSE in the package root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { RegisteredFileSystemProvider, registerFileSystemOverlay, RegisteredMemoryFile } from '@codingame/monaco-vscode-files-service-override';
import React, { StrictMode, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { MonacoEditorReactComp } from '@typefox/monaco-editor-react';
import { MonacoEditorLanguageClientWrapper, TextChanges } from 'monaco-editor-wrapper';
import { createUserConfig } from './config.js';

const badPyCode = `print('Hello World');\nt5sdf12$sf`;

export const runPythonReact = async () => {
    const badPyUri = vscode.Uri.file('/workspace/bad.py');
    const fileSystemProvider = new RegisteredFileSystemProvider(false);
    fileSystemProvider.registerFile(new RegisteredMemoryFile(badPyUri, badPyCode));
    registerFileSystemOverlay(1, fileSystemProvider);

    const onTextChanged = (textChanges: TextChanges) => {
        console.log(`Dirty? ${textChanges.isDirty}\ntext: ${textChanges.modified}\ntextOriginal: ${textChanges.original}`);
    };

    const wrapperConfig = createUserConfig('/workspace', badPyCode, '/workspace/bad.py');

    // Initialize React root
    const rootElement = document.getElementById('react-root');
    if (!rootElement) {
        console.error("Root element with id 'react-root' not found.");
        return;
    }
    const root = ReactDOM.createRoot(rootElement);

    // Define the App component
    const App = () => {
        useEffect(() => {
            // Any side effects or initialization can be placed here
            console.log("Monaco Editor has been mounted.");
        }, []);

        return (
            <div style={{ height: '100vh', width: '100%', padding: '5px' }}>
                <MonacoEditorReactComp
                    wrapperConfig={wrapperConfig}
                    style={{ height: '100%', width: '100%' }}
                    onTextChanged={onTextChanged}
                    onLoad={(wrapper: MonacoEditorLanguageClientWrapper) => {
                        console.log(`Loaded ${wrapper.reportStatus().join('\n').toString()}`);
                    }}
                    onError={(e) => {
                        console.error(e);
                    }}
                />
            </div>
        );
    };

    // Render the App component inside StrictMode
    root.render(
        <StrictMode>
            <App />
        </StrictMode>
    );
};
