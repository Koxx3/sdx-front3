// src/Editor.tsx

import React, {
    FC,
    useState,
    useEffect,
    useRef,
    useMemo
} from 'react';
import * as vscode from 'vscode';

import * as monaco from 'monaco-editor';
import {
    RegisteredFileSystemProvider,
    registerFileSystemOverlay,
    RegisteredMemoryFile,
} from '@codingame/monaco-vscode-files-service-override';

import { MonacoEditorReactComp } from '@typefox/monaco-editor-react';
import {
    MonacoEditorLanguageClientWrapper,
    TextChanges,
} from 'monaco-editor-wrapper';

import '@codingame/monaco-vscode-python-default-extension';
import { createUserConfig } from './config.js'; // or './config.ts' if it is actually TS

// Props interface
interface EditorProps {
    initialCode: string;
    filePath: string;
}

// FC = Functional Component
const Editor: FC<EditorProps> = ({ initialCode, filePath }) => {
    // Using a ref for the current code so changes won't force a re-render
    const codeRef = useRef<string>(initialCode);

    // Track the loaded Monaco Editor wrapper in state
    const [wrapper, setWrapper] = useState<MonacoEditorLanguageClientWrapper | null>(null);

    // Memoize the config so it doesn’t recreate on every keystroke
    const wrapperConfig = useMemo(() => {
        return createUserConfig('/workspace', codeRef.current, filePath);
    }, [filePath]);

    // Called every time the user types
    const onTextChanged = (textChanges: TextChanges) => {
        codeRef.current = textChanges.modified ?? '';
    };

    // Register the file system provider once (when filePath / initialCode change)
    useEffect(() => {
        const fileUri = vscode.Uri.file(filePath);

        const fileSystemProvider = new RegisteredFileSystemProvider(false);
        fileSystemProvider.registerFile(new RegisteredMemoryFile(fileUri, initialCode));
        registerFileSystemOverlay(1, fileSystemProvider);

    }, [initialCode, filePath]);

    // Called once the underlying Monaco + LSP is fully loaded
    const onLoad = (loadedWrapper: MonacoEditorLanguageClientWrapper) => {
        console.log('Editor / onLoad / wrapper status:', loadedWrapper.reportStatus());
        setWrapper(loadedWrapper);

        // Example: after 10s, set the editor’s content to "toto"
        setTimeout(() => {
            console.log('Editor / Setting content to "toto"');
            loadedWrapper.getEditor()?.setValue('toto');
        }, 10000);

        // Example: add a Ctrl+S command to the editor
        const editor = loadedWrapper.getEditor();
        if (editor) {
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                console.log('Saving...', editor.getValue());
            });
        }
    };

    // Example side effect that runs after the wrapper is available
    useEffect(() => {
        if (!wrapper) return;
        console.log('Editor / wrapper is ready:', wrapper);
        
    }, [wrapper]);

    return (
        <div style={{ border: '1px solid grey', margin: '8px 0', height: '500px', width: '100%' }}>
            <MonacoEditorReactComp
                wrapperConfig={wrapperConfig}
                style={{ height: '100%', width: '100%' }}
                onTextChanged={onTextChanged}
                onLoad={onLoad}
                onError={(e: unknown) => {
                    console.error('MonacoEditorReactComp / Error', e);
                }}
            />
        </div>
    );
};

export default Editor;
