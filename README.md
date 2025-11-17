# OpenKore Language Server Protocol (LSP) Extension

A comprehensive Language Server Protocol extension for [OpenKore](https://github.com/openkore/openkore) configuration files, providing intelligent editor support for `control/config.txt` and related configuration files.

## Features

### 🎯 Autocomplete

-   Full autocomplete for all OpenKore configuration keys
-   Context-aware suggestions (top-level vs. block-level keys)
-   Support for nested block configurations (attackSkillSlot, storageAuto, equipAuto, etc.)
-   Detailed information on hover during completion

### 📖 Hover Information

-   Comprehensive descriptions for every configuration key
-   Default values displayed for easy reference
-   Boolean indicators (0=no, 1=yes) for toggle settings
-   Mode descriptions for multi-value settings

### ✅ Real-time Validation

-   Detects unknown configuration keys as you type
-   Yellow warnings for typos or misspelled keys
-   Validates against the complete OpenKore configuration schema

### 🔍 Go to Definition

-   Jump to configuration key definitions with Ctrl+Click (Cmd+Click on Mac)
-   Navigate to key schema information instantly

### 📋 Document Symbols / Outline

-   View all configuration sections in the Outline (Ctrl+Shift+O / Cmd+Shift+O)
-   Quick navigation between configuration blocks
-   Hierarchical organization by section and block type

## Installation

1. Clone this repository
2. Install dependencies:
    ```bash
    bun install
    cd client && bun install && cd ..
    cd server && bun install && cd ..
    ```
3. Build the extension:
    ```bash
    bun run build
    ```

## Development

### Building

```bash
bun run compile      # TypeScript compilation
bun run watch        # Watch mode for development
```

### Launching for Testing

1. Open the project in VS Code: `code .`
2. Press `F5` to launch the `[Extension Development Host]`
3. Open or edit any `control/*.txt` file to activate the LSP
4. Reload (`Cmd+Shift+F5` / `Ctrl+Shift+F5`) after making server changes

## Configuration Schema

The extension supports **300+** OpenKore configuration keys organized into logical sections:

### Core Sections

-   **Login & Connection**: Server, username, password, character selection
-   **XKore**: XKore proxy and injection settings
-   **Attack Settings**: Attack modes, distances, LOS checking, anti-KS
-   **Movement & Routing**: Route configuration, teleporting, escaping
-   **Auto Behaviors**: Automatic responses, skills, spells
-   **Item Management**: Auto-pickup, gathering, weight management
-   **Storage & Trading**: Auto-sell, auto-storage, trade management
-   **Character Development**: Stats, skills, levels
-   **Teleport**: Emergency teleport configurations
-   **Mercenary/Homunculus**: Companion AI settings
-   **Logging & Debugging**: Logging levels, debug options

### Block Configurations

-   `attackSkillSlot`: Define skills to use during attacks
-   `storageAuto`: Configure automatic storage management
-   `equipAuto`: Define equipment for different situations
-   `buyAuto` / `sellAuto`: Automatic buying and selling
-   `partySkill`: Party-wide skill configurations
-   And more...

## Usage

### Basic Usage

1. Open a `control/*.txt` configuration file
2. Start typing a configuration key - autocomplete suggestions appear
3. Hover over any key to see its description and default value
4. Use Ctrl+Click to jump to key definitions
5. Open Outline (Ctrl+Shift+O) to navigate the file structure

### Configuration Examples

```
# Top-level configuration
master exampleserver.com
username my_account
char my_character

# Attack configuration
attackAuto 2
attackDistance 5
attackCheckLOS 1

# Nested block configuration
attackSkillSlot {
    lvl 10 Skill_Name 2 30
    lvl 20 Other_Skill 1 15
}

# Storage configuration
storageAuto 1
storageAuto_npc Alberta Kafra
storageAuto_distance 5
```

## Architecture

```
.
├── client/
│   ├── src/
│   │   └── extension.ts       # VS Code extension entry point
│   └── package.json           # Client dependencies
├── server/
│   ├── src/
│   │   ├── server.ts          # LSP server implementation
│   │   ├── configGrammar.ts   # Configuration schema & descriptions
│   │   └── parser.ts          # Configuration file parser
│   └── package.json           # Server dependencies
└── README.md
```

### Key Components

**`configGrammar.ts`** (1300+ lines)

-   `configKeys`: Complete schema with all valid configuration keys and nested blocks
-   `configDescriptions`: Human-readable descriptions for every key with boolean/mode indicators

**`server.ts`** (480+ lines)

-   `onCompletion`: Provides autocomplete suggestions
-   `onCompletionResolve`: Adds detailed information to completions
-   `onHover`: Shows descriptions and defaults on hover
-   `onDefinition`: Implements Go to Definition functionality
-   `onDocumentSymbol`: Provides document outline/symbols
-   `validateDocument`: Real-time validation of configuration keys

**`extension.ts`**

-   Activates LSP for files matching `**/control/*.txt`
-   Configures language support and client-server communication

## Building and Distribution

### Package for Distribution

```bash
bun run package
```

This creates a `.vsix` file that can be installed in VS Code without publishing to the marketplace.

### Install from .vsix

In VS Code:

1. Open Extensions sidebar (Ctrl+Shift+X)
2. Click "Install from VSIX..."
3. Select the generated `.vsix` file

## Technologies Used

-   **VS Code Language Server Protocol (LSP)**: v8.1.0
-   **TypeScript**: ES2020 target
-   **Bun**: Package manager and runtime
-   **OpenKore**: Configuration schema based on official source

## Contributing

To enhance the configuration schema:

1. Add new keys to `configKeys` object in `configGrammar.ts`
2. Add descriptions to `configDescriptions` object
3. Test with autocomplete, hover, and validation
4. Compile and verify with `bun run compile`

## License

See LICENSE file for details.

## Related Projects

-   [OpenKore](https://github.com/openkore/openkore) - Main OpenKore bot project
-   [VS Code LSP Documentation](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
