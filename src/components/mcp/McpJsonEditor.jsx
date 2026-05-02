"use client";

import Editor from "@monaco-editor/react";

export default function McpJsonEditor({ value, onChange, className }) {
  return (
    <Editor
      className={className}
      height="100%"
      defaultLanguage="json"
      theme="vs-dark"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  );
}
