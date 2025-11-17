import { configKeys } from "./configGrammar";

type Config = Record<string, any>;

export function parseConfig(text: string): Config {
    const config: Config = {};
    const lines = text.split("\n");
    let inBlock = false;
    let blockKey: string | null = null;
    let blockCounter: Record<string, number> = {};

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith("#") || trimmedLine === "") {
            continue;
        }

        if (trimmedLine.endsWith("{")) {
            inBlock = true;
            const parts = trimmedLine.slice(0, -1).trim().split(/\s+/);
            const key = parts[0];
            if (!blockCounter[key]) {
                blockCounter[key] = 0;
            }
            blockCounter[key]++;
            blockKey = `${key}_${blockCounter[key]}`;
            config[blockKey] = {};
            if (parts.length > 1) {
                config[blockKey] = parts.slice(1).join(" ");
            }
            continue;
        }

        if (trimmedLine === "}") {
            inBlock = false;
            blockKey = null;
            continue;
        }

        const parts = trimmedLine.split(/\s+/);
        const key = parts[0];
        const value = parts.slice(1).join(" ");

        if (inBlock && blockKey) {
            if (!config[blockKey]) {
                config[blockKey] = {};
            }
            config[blockKey][key] = value;
        } else {
            config[key] = value;
        }
    }

    return config;
}
