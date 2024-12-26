// Editor.tsx
import React, { FC, useState, useEffect, useRef, useMemo } from 'react';
import * as vscode from 'vscode';
import { MonacoEditorReactComp } from '@typefox/monaco-editor-react';
import { MonacoEditorLanguageClientWrapper, TextChanges } from 'monaco-editor-wrapper';
import * as monaco from 'monaco-editor';

import { createUserConfig } from './config.js';

interface EditorProps {
  initialCode: string;
  filePath: string; // e.g. "/workspace/test.py"
}

const Editor: FC<EditorProps> = ({ initialCode, filePath }) => {
  const codeRef = useRef(initialCode);
  const [wrapper, setWrapper] = useState<MonacoEditorLanguageClientWrapper | null>(null);

  const wrapperConfig = useMemo(() => {
    return createUserConfig('/workspace', codeRef.current, filePath);
  }, [filePath]);

  const onTextChanged = (changes: TextChanges) => {
    codeRef.current = changes.modified ?? '';
  };

  const onLoad = (loadedWrapper: MonacoEditorLanguageClientWrapper) => {
    console.log('Editor / onLoad / wrapper status:', loadedWrapper.reportStatus());
    setWrapper(loadedWrapper);

    // Example: add Ctrl+S
    const editor = loadedWrapper.getEditor();
    if (editor) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        console.log('Saving content:', editor.getValue());
      });
    }
  };

  useEffect(() => {
    if (!wrapper) return;
    console.log('Editor is ready. Current code:', codeRef.current);
  }, [wrapper]);

  return (
    <div style={{ border: '1px solid #ccc', height: '600px', width: '100%' }}>
      <MonacoEditorReactComp
        wrapperConfig={wrapperConfig}
        onTextChanged={onTextChanged}
        onLoad={onLoad}
        style={{ height: '100%', width: '100%' }}
        onError={(e) => console.error('MonacoEditorReactComp / Error', e)}
      />
    </div>
  );
};

export default Editor;
