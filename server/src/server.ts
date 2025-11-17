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
import { itemsControlFieldCount } from "./itemsControlGrammar";
import { monsterControlFieldCount } from "./monsterControlGrammar";

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

function getFileType(document: TextDocument): string {
    const fileName = document.uri.split("/").pop() || "";
    if (fileName === "items_control.txt") {
        return "items_control";
    }
    if (fileName === "mon_control.txt") {
        return "mon_control";
    }
    return "config";
}

function validateDocument(document: TextDocument): Diagnostic[] {
    const fileType = getFileType(document);
    if (fileType === "items_control") {
        return validateItemsControl(document);
    }
    if (fileType === "mon_control") {
        return validateMonsterControl(document);
    }
    return validateConfig(document);
}

function validateItemsControl(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        let trimmedLine = line.trim();

        // Skip comments and empty lines
        if (trimmedLine.startsWith("#") || trimmedLine === "") {
            continue;
        }

        // Remove inline comments
        const commentIdx = trimmedLine.indexOf("#");
        if (commentIdx !== -1) {
            trimmedLine = trimmedLine.substring(0, commentIdx).trim();
        }

        // Skip if line is now empty after removing comment
        if (trimmedLine === "") {
            continue;
        }

        // Parse from the end: we expect exactly 3-5 numeric fields at the end
        // Format: (item name which can be numeric or text) (minimum) (auto-store) (auto-sell) [put-cart] [get-cart]
        let allParts = trimmedLine.split(/\s+/);

        // We need exactly 3-5 numeric fields at the end (min, auto-store, auto-sell, [put-cart], [get-cart])
        // Count backwards from the end to find how many consecutive numeric fields we have
        let numericFieldCount = 0;
        for (
            let i = allParts.length - 1;
            i >= 0 && numericFieldCount < 5;
            i--
        ) {
            const val = allParts[i];
            if (/^\d+$/.test(val)) {
                numericFieldCount++;
            } else {
                break;
            }
        }

        // Ensure we have at least 1 part left for the item name
        // So if we have 4 parts and all are numeric, we only take the last 3 as control fields
        const maxControlFields = allParts.length - 1; // Keep at least 1 for item name
        if (numericFieldCount > maxControlFields) {
            numericFieldCount = maxControlFields;
        }

        if (numericFieldCount < 3) {
            const range = {
                start: { line: lineIndex, character: 0 },
                end: { line: lineIndex, character: trimmedLine.length },
            };
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range,
                message: `Expected at least 3 numeric fields at end of line (minimum, auto-store, auto-sell), got ${numericFieldCount}`,
                source: "openkore-lsp",
            });
            continue;
        }

        // Extract the numeric fields (always the last N, where N is numericFieldCount)
        const numericFields = allParts.slice(
            allParts.length - numericFieldCount
        );

        // The item name is everything before the numeric fields
        // It can be a single numeric ID or multiple words
        const itemNameParts = allParts.slice(
            0,
            allParts.length - numericFieldCount
        );

        // Validate minimum (first numeric field, must be >= 0)
        const minValue = numericFields[0];
        const minNum = parseInt(minValue, 10);
        if (isNaN(minNum) || minNum < 0) {
            const minStartChar = line.indexOf(minValue);
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: lineIndex, character: minStartChar },
                    end: {
                        line: lineIndex,
                        character: minStartChar + minValue.length,
                    },
                },
                message: `Minimum must be a number >= 0, got: ${minValue}`,
                source: "openkore-lsp",
            });
        }

        // Validate flags (auto-store, auto-sell, [put-cart], [get-cart] must be 0 or 1)
        for (let i = 1; i < numericFields.length; i++) {
            const value = numericFields[i];
            if (value !== "0" && value !== "1") {
                const valueStartChar = line.indexOf(value);
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: {
                        start: { line: lineIndex, character: valueStartChar },
                        end: {
                            line: lineIndex,
                            character: valueStartChar + value.length,
                        },
                    },
                    message: `Flag must be 0 or 1, got: ${value}`,
                    source: "openkore-lsp",
                });
            }
        }
    }

    return diagnostics;
}

function validateMonsterControl(document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        let trimmedLine = line.trim();

        // Skip comments and empty lines
        if (trimmedLine.startsWith("#") || trimmedLine === "") {
            continue;
        }

        // Remove inline comments
        const commentIdx = trimmedLine.indexOf("#");
        if (commentIdx !== -1) {
            trimmedLine = trimmedLine.substring(0, commentIdx).trim();
        }

        // Skip if line is now empty after removing comment
        if (trimmedLine === "") {
            continue;
        }

        // Parse fields: monster attack teleport search [skillcancel] [lv] [joblv] [hp] [sp] [weight]
        // Monster name can have spaces and be numeric or text
        // Minimum: 3 fields (attack, teleport, search)
        // Optional: skillcancel and other fields up to 9 total
        const allParts = trimmedLine.split(/\s+/);

        // Count numeric fields from the end to determine where the control fields start
        // We need at least 3 control fields (attack, teleport, search)
        let numericFieldCount = 0;
        for (
            let i = allParts.length - 1;
            i >= 0 && numericFieldCount < 6;
            i--
        ) {
            const val = allParts[i];
            // Can be negative numbers or floats (for weight)
            if (/^-?\d+(\.\d+)?$/.test(val)) {
                numericFieldCount++;
            } else {
                break;
            }
        }

        // Ensure we have at least 1 part left for the monster name
        const maxControlFields = allParts.length - 1;
        if (numericFieldCount > maxControlFields) {
            numericFieldCount = maxControlFields;
        }

        // We need at least 3 numeric control fields (attack, teleport, search)
        if (numericFieldCount < 3) {
            const range = {
                start: { line: lineIndex, character: 0 },
                end: { line: lineIndex, character: trimmedLine.length },
            };
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range,
                message: `Expected at least 3 numeric fields at end of line (attack, teleport, search), got ${numericFieldCount}`,
                source: "openkore-lsp",
            });
            continue;
        }

        // Extract the numeric fields (control fields)
        const numericFields = allParts.slice(
            allParts.length - numericFieldCount
        );

        // Validate attack field (should be -1, 0, 1, 2, or 3)
        const attackValue = numericFields[0];
        if (!/^-?[0-3]$/.test(attackValue)) {
            const attackStartChar = line.indexOf(attackValue);
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: lineIndex, character: attackStartChar },
                    end: {
                        line: lineIndex,
                        character: attackStartChar + attackValue.length,
                    },
                },
                message: `Attack must be -1, 0, 1, 2, or 3, got: ${attackValue}`,
                source: "openkore-lsp",
            });
        }

        // Validate teleport field (can be negative, 0, 1, 2, 3, or >= 4)
        const teleportValue = numericFields[1];
        if (!/^-?\d+$/.test(teleportValue)) {
            const teleportStartChar = line.indexOf(teleportValue);
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: lineIndex, character: teleportStartChar },
                    end: {
                        line: lineIndex,
                        character: teleportStartChar + teleportValue.length,
                    },
                },
                message: `Teleport must be a number, got: ${teleportValue}`,
                source: "openkore-lsp",
            });
        }

        // Validate search field (must be 0 or 1)
        const searchValue = numericFields[2];
        if (searchValue !== "0" && searchValue !== "1") {
            const searchStartChar = line.indexOf(searchValue);
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: { line: lineIndex, character: searchStartChar },
                    end: {
                        line: lineIndex,
                        character: searchStartChar + searchValue.length,
                    },
                },
                message: `Search must be 0 or 1, got: ${searchValue}`,
                source: "openkore-lsp",
            });
        }

        // Validate skillcancel field (must be 0 or 1) - OPTIONAL, only validate if present
        if (numericFields.length > 3) {
            const skillcancelValue = numericFields[3];
            if (skillcancelValue !== "0" && skillcancelValue !== "1") {
                const skillcancelStartChar = line.indexOf(skillcancelValue);
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: {
                        start: {
                            line: lineIndex,
                            character: skillcancelStartChar,
                        },
                        end: {
                            line: lineIndex,
                            character:
                                skillcancelStartChar + skillcancelValue.length,
                        },
                    },
                    message: `Skillcancel must be 0 or 1, got: ${skillcancelValue}`,
                    source: "openkore-lsp",
                });
            }
        }

        // Validate optional numeric fields (lv, joblv, hp, sp, weight)
        // These start at index 4 if skillcancel exists, or index 3 if it doesn't
        const optionalFieldStartIndex = numericFields.length > 3 ? 4 : 3;
        for (let i = optionalFieldStartIndex; i < numericFields.length; i++) {
            const value = numericFields[i];
            // Can be integer or float (for weight field)
            if (!/^-?\d+(\.\d+)?$/.test(value)) {
                const valueStartChar = line.indexOf(value);
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: {
                        start: { line: lineIndex, character: valueStartChar },
                        end: {
                            line: lineIndex,
                            character: valueStartChar + value.length,
                        },
                    },
                    message: `Optional field must be a number, got: ${value}`,
                    source: "openkore-lsp",
                });
            }
        }
    }

    return diagnostics;
}

function validateConfig(document: TextDocument): Diagnostic[] {
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
