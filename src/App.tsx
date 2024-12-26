// src/App.tsx

import React from 'react';
import Editor from './Editor.tsx';

export default function App() {
  return (
    <div>
      <h1>My App with multiple editors</h1>
      <Editor 
        initialCode={`print("Hello from Editor 1")\nvar1 = 42`} 
        filePath="/workspace/editor1.py"
      />
      <Editor 
        initialCode={`print("Hello from Editor 2")\nvar2 = 123`} 
        filePath="/workspace/editor2.py"
      />
    </div>
  );
}
