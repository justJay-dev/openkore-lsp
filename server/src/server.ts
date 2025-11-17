import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    Hover,
    MarkupContent,
    Diagnostic,
    DiagnosticSeverity,
    LocationLink,
    DocumentSymbolParams,
    SymbolInformation,
    SymbolKind,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

import { configKeys, configDescriptions } from "./configGrammar";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
            },
            hoverProvider: true,
            diagnosticProvider: {
                interFileDependencies: false,
                workspaceDiagnostics: false,
            },
            definitionProvider: true,
            documentSymbolProvider: true,
        },
    };

    return result;
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        const document = documents.get(_textDocumentPosition.textDocument.uri);
        if (!document) {
            return [];
        }

        const text = document.getText();
        const currentLine = document.getText({
            start: { line: _textDocumentPosition.position.line, character: 0 },
            end: {
                line: _textDocumentPosition.position.line,
                character: _textDocumentPosition.position.character,
            },
        });

        // very basic implementation for now
        // check if we are inside a block
        let inBlock = false;
        let blockName = "";
        const lines = text.split("\n");
        let blockStartLine = -1;

        for (let i = 0; i < _textDocumentPosition.position.line; i++) {
            if (lines[i].includes("{")) {
                inBlock = true;
                blockName = lines[i].split(/\s+/)[0];
                blockStartLine = i;
            }
            if (lines[i].includes("}")) {
                if (i > blockStartLine) {
                    inBlock = false;
                    blockName = "";
                }
            }
        }

        if (inBlock) {
            const blockConfig =
                configKeys[blockName as keyof typeof configKeys];
            if (typeof blockConfig === "object" && blockConfig !== null) {
                return Object.keys(blockConfig).map((key) => ({
                    label: key,
                    kind: CompletionItemKind.Property,
                    data: { key, insideBlock: blockName },
                }));
            }
        }

        // Not in a block or block not found, return top-level keys
        return Object.keys(configKeys).map((key) => {
            const value = configKeys[key as keyof typeof configKeys];
            return {
                label: key,
                kind:
                    typeof value === "object"
                        ? CompletionItemKind.Module
                        : CompletionItemKind.Property,
                data: key,
            };
        });
    }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    const key = item.data.key || item.data;
    const insideBlock = item.data.insideBlock;

    if (insideBlock) {
        const blockConfig = configKeys[insideBlock as keyof typeof configKeys];
        if (typeof blockConfig === "object" && blockConfig !== null) {
            const value = (blockConfig as Record<string, string>)[key];
            item.detail = `(property) ${key}: ${value}`;
            const description = configDescriptions[key] || "";
            item.documentation = description
                ? `${description}\n\nDefault: ${value}`
                : `Default: ${value}`;
        }
    } else {
        const value = configKeys[key as keyof typeof configKeys];
        if (typeof value === "object" && value !== null) {
            item.detail = `(block) ${key}`;
            const description = configDescriptions[key] || "";
            item.documentation = description || "Configuration block";
        } else {
            item.detail = `(property) ${key}: ${value}`;
            const description = configDescriptions[key] || "";
            item.documentation = description
                ? `${description}\n\nDefault: ${value}`
                : `Default: ${value}`;
        }
    }

    return item;
});

connection.onHover(
    (_textDocumentPosition: TextDocumentPositionParams): Hover | null => {
        const document = documents.get(_textDocumentPosition.textDocument.uri);
        if (!document) {
            return null;
        }

        const text = document.getText();
        const position = _textDocumentPosition.position;
        const line = document.getText({
            start: { line: position.line, character: 0 },
            end: { line: position.line, character: Infinity },
        });

        const wordMatch = line.match(/\w+/g);
        if (!wordMatch) {
            return null;
        }

        let hoveredWord = "";
        let startChar = -1;
        for (const word of wordMatch) {
            const wordStartIndex = line.indexOf(word);
            const wordEndIndex = wordStartIndex + word.length;
            if (
                position.character >= wordStartIndex &&
                position.character <= wordEndIndex
            ) {
                hoveredWord = word;
                startChar = wordStartIndex;
                break;
            }
        }

        if (!hoveredWord) {
            return null;
        }

        // check if we are inside a block
        let inBlock = false;
        let blockName = "";
        const lines = text.split("\n");
        let blockStartLine = -1;

        for (let i = 0; i < position.line; i++) {
            if (lines[i].includes("{")) {
                inBlock = true;
                blockName = lines[i].split(/\s+/)[0];
                blockStartLine = i;
            }
            if (lines[i].includes("}")) {
                if (i > blockStartLine) {
                    inBlock = false;
                    blockName = "";
                }
            }
        }

        let value: any;
        let detail = "";
        let documentation = "";

        if (inBlock) {
            const blockConfig =
                configKeys[blockName as keyof typeof configKeys];
            if (
                typeof blockConfig === "object" &&
                blockConfig !== null &&
                hoveredWord in blockConfig
            ) {
                value = (blockConfig as Record<string, string>)[hoveredWord];
                detail = `(property) ${hoveredWord}: ${value}`;
                const desc = configDescriptions[hoveredWord] || "";
                documentation = desc
                    ? `${desc}\n\nDefault: ${value}`
                    : `Default: ${value}`;
            }
        } else {
            if (hoveredWord in configKeys) {
                value = configKeys[hoveredWord as keyof typeof configKeys];
                if (typeof value === "object" && value !== null) {
                    detail = `(block) ${hoveredWord}`;
                    const desc = configDescriptions[hoveredWord] || "";
                    documentation = desc || "Configuration block";
                } else {
                    detail = `(property) ${hoveredWord}: ${value}`;
                    const desc = configDescriptions[hoveredWord] || "";
                    documentation = desc
                        ? `${desc}\n\nDefault: ${value}`
                        : `Default: ${value}`;
                }
            }
        }

        if (!detail) {
            return null;
        }

        return {
            contents: {
                kind: "markdown",
                value: [
                    "```plaintext",
                    detail,
                    "```",
                    "---",
                    documentation,
                ].join("\n"),
            },
        };
    }
);

connection.onDefinition(
    (
        _textDocumentPosition: TextDocumentPositionParams
    ): LocationLink[] | null => {
        const document = documents.get(_textDocumentPosition.textDocument.uri);
        if (!document) {
            return null;
        }

        const text = document.getText();
        const position = _textDocumentPosition.position;
        const line = document.getText({
            start: { line: position.line, character: 0 },
            end: { line: position.line, character: Infinity },
        });

        // Extract the word at the cursor position
        const wordMatch = line.match(/\w+/g);
        if (!wordMatch) {
            return null;
        }

        let hoveredWord = "";
        let startChar = -1;
        for (const word of wordMatch) {
            const wordStartIndex = line.indexOf(word);
            const wordEndIndex = wordStartIndex + word.length;
            if (
                position.character >= wordStartIndex &&
                position.character <= wordEndIndex
            ) {
                hoveredWord = word;
                startChar = wordStartIndex;
                break;
            }
        }

        if (!hoveredWord || !(hoveredWord in configKeys)) {
            return null;
        }

        // Create a location that points to the grammar file
        // This is a "virtual" definition in the configGrammar.ts file
        const targetRange = {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
        };

        return [
            {
                originSelectionRange: {
                    start: { line: position.line, character: startChar },
                    end: {
                        line: position.line,
                        character: startChar + hoveredWord.length,
                    },
                },
                targetUri: document.uri.replace(
                    /config\.txt$/,
                    "configGrammar.ts"
                ),
                targetRange,
                targetSelectionRange: targetRange,
            },
        ];
    }
);

function validateDocument(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split("\n");
    let inBlock = false;
    let blockName = "";
    let blockStartLine = -1;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex].trim();

        // Skip comments and empty lines
        if (line.startsWith("#") || line === "") {
            continue;
        }

        // Handle block start
        if (line.endsWith("{")) {
            inBlock = true;
            blockName = line.split(/\s+/)[0];
            blockStartLine = lineIndex;
            continue;
        }

        // Handle block end
        if (line === "}") {
            inBlock = false;
            blockName = "";
            continue;
        }

        // Parse key-value pair
        const parts = line.split(/\s+/);
        const key = parts[0];

        if (!key) {
            continue;
        }

        // Validate the key
        let isValid = false;

        if (inBlock) {
            const blockConfig =
                configKeys[blockName as keyof typeof configKeys];
            if (typeof blockConfig === "object" && blockConfig !== null) {
                isValid = key in blockConfig;
            }
        } else {
            isValid = key in configKeys;
        }

        if (!isValid) {
            const range = {
                start: { line: lineIndex, character: 0 },
                end: { line: lineIndex, character: key.length },
            };

            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range,
                message: `Unknown configuration key: ${key}`,
                source: "openkore-lsp",
            });
        }

        // Validate level values (lvl must be 1-10)
        if (key === "lvl" && parts.length > 1) {
            const levelValue = parts[1];
            const levelNum = parseInt(levelValue, 10);

            if (isNaN(levelNum) || levelNum < 1 || levelNum > 10) {
                const levelStartChar = line.indexOf(levelValue);
                const range = {
                    start: { line: lineIndex, character: levelStartChar },
                    end: {
                        line: lineIndex,
                        character: levelStartChar + levelValue.length,
                    },
                };

                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range,
                    message: `Level must be between 1 and 10, got: ${levelValue}`,
                    source: "openkore-lsp",
                });
            }
        }

        // Validate hp and sp values (numbers, percentages, or comparison expressions)
        if ((key === "hp" || key === "sp") && parts.length > 1) {
            const valueStartIndex = 1;
            const restOfLine = parts.slice(valueStartIndex).join(" ");
            const isValid =
                /^\d+%?$/.test(parts[1]) || // plain number (1, 28) or percentage (10%, 20%)
                /^[<>=!]{1,2}\s*\d+%?$/.test(restOfLine); // comparison with optional space (< 10%, >= 50, etc)

            if (!isValid) {
                const valueStartChar = line.indexOf(parts[1]);
                const restLength = line.length - valueStartChar;
                const range = {
                    start: { line: lineIndex, character: valueStartChar },
                    end: {
                        line: lineIndex,
                        character: valueStartChar + restLength,
                    },
                };

                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range,
                    message: `${key} must be a number, percentage, or comparison expression (e.g., "< 10%", ">= 50"), got: ${restOfLine}`,
                    source: "openkore-lsp",
                });
            }
        }
    }

    return diagnostics;
}

connection.onDocumentSymbol((params: DocumentSymbolParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }

    const symbols: SymbolInformation[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    // Track configuration sections and blocks
    let currentSection = "Global Settings";
    let blockStack: string[] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex].trim();

        // Skip empty lines and comments that don't define sections
        if (!line || (line.startsWith("#") && !line.includes("="))) {
            // But capture section headers (comments like "# Section Name")
            if (line.startsWith("#") && line.length > 1) {
                const sectionName = line.substring(1).trim();
                // Only treat as section if it looks like a header (no = sign, starts with #)
                if (!sectionName.includes("=")) {
                    currentSection = sectionName;
                }
            }
            continue;
        }

        // Extract key from the line
        const keyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (!keyMatch) continue;

        const key = keyMatch[1];

        // Check if it's a block definition (has { after key)
        if (line.includes("{")) {
            const blockLocation = {
                uri: document.uri,
                range: {
                    start: { line: lineIndex, character: 0 },
                    end: { line: lineIndex, character: key.length },
                },
            };

            symbols.push({
                name: key,
                kind: SymbolKind.Object,
                deprecated: false,
                location: blockLocation,
                containerName: currentSection,
            });

            blockStack.push(key);
        } else if (line.includes("}")) {
            blockStack.pop();
        } else if (keyMatch && !line.startsWith("#")) {
            // Regular configuration key
            const keyLocation = {
                uri: document.uri,
                range: {
                    start: { line: lineIndex, character: 0 },
                    end: { line: lineIndex, character: key.length },
                },
            };

            symbols.push({
                name: key,
                kind: SymbolKind.Property,
                deprecated: false,
                location: keyLocation,
                containerName:
                    blockStack.length > 0
                        ? blockStack[blockStack.length - 1]
                        : currentSection,
            });
        }
    }

    return symbols;
});

documents.onDidChangeContent((change) => {
    const document = change.document;
    const diagnostics = validateDocument(document);
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
}); // Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
