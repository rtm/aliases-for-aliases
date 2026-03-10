import {
    Plugin,
    TFile,
    CachedMetadata,
    Notice,
} from 'obsidian';
import { around } from 'monkey-around';
import { AliasesForAliasesSettingTab } from './settings';

export default class AliasesForAliasesPlugin extends Plugin {
    // Store custom aliases for reference
    private customAliases: Map<string, Set<string>> = new Map();
    // Map of alias to file path for quick lookup
    aliasToFilePath: Map<string, string> = new Map();
    // Track property names already registered as list type
    private registeredListProperties: Set<string> = new Set();
    // Store original metadataCache method for restoration
    private originalGetFirstLinkpathDest: Function;

    async onload() {
        console.log('Loading Aliases for Aliases plugin');

        // Add settings tab
        this.addSettingTab(new AliasesForAliasesSettingTab(this.app, this));

        // Patch getFirstLinkpathDest to resolve custom aliases when links are followed
        this.originalGetFirstLinkpathDest = this.app.metadataCache.getFirstLinkpathDest.bind(this.app.metadataCache);
        // @ts-ignore
        this.app.metadataCache.getFirstLinkpathDest = (linkpath: string, sourcePath: string): TFile | null => {
            const filePath = this.aliasToFilePath.get(linkpath);
            if (filePath) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) return file;
            }
            return this.originalGetFirstLinkpathDest(linkpath, sourcePath);
        };

        // Register event to process files when metadata changes
        this.registerEvent(
            this.app.metadataCache.on('changed', (file, data, cache) => {
                this.processFileAliases(file, cache);
            })
        );

        // Process all currently loaded files and patch the built-in link suggester
        this.app.workspace.onLayoutReady(() => {
            this.refreshAliases();
            this.patchLinkSuggester();
        });

        // Add command to refresh aliases
        this.addCommand({
            id: 'refresh-custom-aliases',
            name: 'Refresh Custom Aliases',
            callback: () => {
                this.refreshAliases();
                new Notice('Custom aliases refreshed');
            }
        });

        // Debug command: dump alias map to console
        this.addCommand({
            id: 'debug-aliases',
            name: 'Debug: Dump Alias Map to Console',
            callback: () => {
                console.log('=== Aliases for Aliases: aliasToFilePath ===');
                this.aliasToFilePath.forEach((filePath, alias) => {
                    console.log(`  "${alias}" → ${filePath}`);
                });
                console.log(`Total: ${this.aliasToFilePath.size} aliases`);
                new Notice(`${this.aliasToFilePath.size} custom aliases loaded — see console`);
            }
        });

        // Register a handler for file menu
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if (file instanceof TFile) {
                    const cache = this.app.metadataCache.getFileCache(file);
                    if (cache && cache.frontmatter) {
                        const customAliases = this.getCustomAliasesForFile(file.path, cache);
                        if (customAliases.size > 0) {
                            menu.addItem((item) => {
                                item.setTitle('Copy Custom Aliases')
                                    .setIcon('clipboard-copy')
                                    .onClick(() => {
                                        navigator.clipboard.writeText(Array.from(customAliases).join(', '));
                                        new Notice('Custom aliases copied to clipboard');
                                    });
                            });
                        }
                    }
                }
            })
        );
    }

    patchLinkSuggester() {
        // The built-in link suggester is always at index 0
        // @ts-ignore
        const suggest = this.app.workspace.editorSuggest?.suggests?.[0];
        if (!suggest) {
            console.warn('Aliases for Aliases: could not find built-in link suggester');
            return;
        }

        const plugin = this;

        // Use monkey-around to safely patch the prototype — handles multiple plugins patching
        // the same method and cleanly restores on unload via this.register()
        this.register(around(suggest.constructor.prototype, {
            getSuggestions(old: Function) {
                return function (this: unknown, context: any) {
                    const original: any[] = old.call(this, context);
                    const query = (context?.query ?? '').toLowerCase();
                    if (!query) return original;

                    const custom = Array.from(plugin.aliasToFilePath.entries())
                        .filter(([alias]) => alias.toLowerCase().includes(query))
                        .map(([alias, filePath]) => {
                            const file = plugin.app.vault.getAbstractFileByPath(filePath);
                            if (!(file instanceof TFile)) return null;
                            return {
                                type: 'file' as const,
                                file,
                                path: filePath,
                                score: alias.toLowerCase() === query ? 1 : 0.5,
                                matches: null,
                                alias,
                            };
                        })
                        .filter((s): s is NonNullable<typeof s> => s !== null);

                    return [...original, ...custom];
                };
            }
        }));

        console.log('Aliases for Aliases: patched built-in link suggester');
    }

    onunload() {
        console.log('Unloading Aliases for Aliases plugin');

        // Restore original method
        // @ts-ignore
        this.app.metadataCache.getFirstLinkpathDest = this.originalGetFirstLinkpathDest;

        // monkey-around patches registered via this.register() are cleaned up automatically

        this.customAliases.clear();
        this.aliasToFilePath.clear();
    }

    refreshAliases() {
        this.customAliases.clear();
        this.aliasToFilePath.clear();

        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache) {
                this.processFileAliases(file, cache);
            }
        }

        console.log('Aliases for aliases: Refreshed custom aliases',
            this.customAliases.size, 'files with custom aliases,',
            this.aliasToFilePath.size, 'total custom aliases');
    }

    getCustomAliasesForFile(filePath: string, cache: CachedMetadata): Set<string> {
        const customAliasesForFile = new Set<string>();

        if (!cache.frontmatter) return customAliasesForFile;

        for (const key of Object.keys(cache.frontmatter)) {
            if (!key.startsWith('aliases:')) continue;

            this.ensureListType(key);

            const propertyValue = cache.frontmatter[key];

            if (Array.isArray(propertyValue)) {
                propertyValue.forEach(value => {
                    if (typeof value === 'string' && value.trim()) {
                        customAliasesForFile.add(value.trim());
                    }
                });
            } else if (typeof propertyValue === 'string' && propertyValue.trim()) {
                customAliasesForFile.add(propertyValue.trim());
            }
        }

        return customAliasesForFile;
    }

    ensureListType(property: string) {
        if (this.registeredListProperties.has(property)) return;
        try {
            // @ts-ignore
            this.app.metadataTypeManager.setType(property, 'multitext');
            this.registeredListProperties.add(property);
        } catch (e) {
            console.warn(`Aliases for Aliases: could not register "${property}" as list type`, e);
        }
    }

    processFileAliases(file: TFile, cache: CachedMetadata) {
        const filePath = file.path;
        const customAliasesForFile = this.getCustomAliasesForFile(filePath, cache);

        if (customAliasesForFile.size > 0) {
            this.customAliases.set(filePath, customAliasesForFile);
            customAliasesForFile.forEach(alias => {
                this.aliasToFilePath.set(alias, filePath);
            });
        } else {
            this.customAliases.delete(filePath);
        }
    }
}
