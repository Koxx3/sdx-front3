/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2024 TypeFox and others.
 * Licensed under the MIT License. See LICENSE in the package root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as monaco from 'monaco-editor';
import { RegisteredFileSystemProvider, registerFileSystemOverlay, RegisteredMemoryFile } from '@codingame/monaco-vscode-files-service-override';
import React, { StrictMode, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { MonacoEditorReactComp } from '@typefox/monaco-editor-react';
import { MonacoEditorLanguageClientWrapper, TextChanges } from 'monaco-editor-wrapper';
import { createUserConfig } from './config.js';

const badPyCode = `print('Hello World');\nt5sdf12$sf`;

export const runPythonReact = async () => {


    // Initialize React root
    const rootElement = document.getElementById('react-root');
    if (!rootElement) {
        console.error("runPythonReact / Root element with id 'react-root' not found.");
        return;
    }
    const root = ReactDOM.createRoot(rootElement);

    // Define the App component
    const App = () => {

        const [wrapperState, setWrapperState] = useState<MonacoEditorLanguageClientWrapper | null>(null);
        const [nowContent, setContent] = useState<string>(badPyCode);

        const wrapperConfig = createUserConfig('/workspace', nowContent, '/workspace/bad.py');

        const badPyUri = vscode.Uri.file('/workspace/bad.py');
        const fileSystemProvider = new RegisteredFileSystemProvider(false);
        fileSystemProvider.registerFile(new RegisteredMemoryFile(badPyUri, badPyCode));
        registerFileSystemOverlay(1, fileSystemProvider);

        const onTextChanged = (textChanges: TextChanges) => {
            console.log(`Dirty? ${textChanges.isDirty}\ntext: ${textChanges.modified}\ntextOriginal: ${textChanges.original}`);
        };

        const onLoad = (wrapper: MonacoEditorLanguageClientWrapper) => {
            console.log(`MonacoEditorReactComp / Loaded ${wrapper.reportStatus().join('\n').toString()}`);

            setWrapperState(wrapper);

            setTimeout(() => {
                console.log("App / load text.");
                // setContent("toto")
                wrapper?.getEditor()?.setValue("toto");
            }, 10000);

            const editor = wrapper.getEditor();
            if (!editor) return;

            // monaco.KeyMod.CtrlCmd equals "Control" on Windows, "Command" on macOS
            editor?.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                console.log('Saving...');
            });

        }

        useEffect(() => {
            if (!wrapperState) {
                console.log('App / wrapper is still null');
                return;
            }
            console.log('App / wrapper is now available', wrapperState);
        }, [wrapperState]);

        return (
            <div style={{ height: '100vh', width: '100%', padding: '5px' }}>
                <MonacoEditorReactComp
                    wrapperConfig={wrapperConfig}
                    style={{ height: '100%', width: '100%' }}
                    onTextChanged={onTextChanged}
                    onLoad={onLoad}
                    onError={(e: any) => {
                        console.error("MonacoEditorReactComp / Error", e);
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
