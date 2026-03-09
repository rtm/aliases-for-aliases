import {
    Plugin,
    TFile,
    CachedMetadata,
    Notice,
    MarkdownView,
} from 'obsidian';
import {
    AliasesForAliasesSettings,
    DEFAULT_SETTINGS,
    AliasesForAliasesSettingTab
} from './settings';

export default class AliasesForAliasesPlugin extends Plugin {
    settings: AliasesForAliasesSettings;

    // Store custom aliases for reference
    private customAliases: Map<string, Set<string>> = new Map();
    // Map of alias to file path for quick lookup
    private aliasToFilePath: Map<string, string> = new Map();
    // Store original metadataCache methods for restoration
    private originalGetFirstLinkpathDest: Function;
    private originalGetLinkSuggestions: Function;

    async onload() {
        console.log('Loading Aliases for Aliases plugin');

        await this.loadSettings();

        // Add settings tab
        this.addSettingTab(new AliasesForAliasesSettingTab(this.app, this));

        // Patch getFirstLinkpathDest to resolve custom aliases
        this.originalGetFirstLinkpathDest = this.app.metadataCache.getFirstLinkpathDest.bind(this.app.metadataCache);
        // @ts-ignore - monkey patching
        this.app.metadataCache.getFirstLinkpathDest = (linkpath: string, sourcePath: string): TFile | null => {
            // Check our custom aliases first
            const filePath = this.aliasToFilePath.get(linkpath);
            if (filePath) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) return file;
            }
            return this.originalGetFirstLinkpathDest(linkpath, sourcePath);
        };

        // Patch getLinkSuggestions to include custom aliases in autocomplete
        this.originalGetLinkSuggestions = this.app.metadataCache.getLinkSuggestions.bind(this.app.metadataCache);
        // @ts-ignore - monkey patching
        this.app.metadataCache.getLinkSuggestions = (query: string) => {
            const originalSuggestions = this.originalGetLinkSuggestions(query);
            if (!query) return originalSuggestions;

            const customSuggestions = Array.from(this.aliasToFilePath.entries())
                .filter(([alias]) => alias.toLowerCase().contains(query.toLowerCase()))
                .map(([alias, filePath]) => {
                    const file = this.app.vault.getAbstractFileByPath(filePath);
                    if (!(file instanceof TFile)) return null;
                    return {
                        file,
                        alias,
                        path: filePath,
                        score: alias.toLowerCase() === query.toLowerCase() ? 1 : 0.5
                    };
                })
                .filter(s => s !== null);

            return [...originalSuggestions, ...customSuggestions];
        };

        // Register event to process files when metadata changes
        this.registerEvent(
            this.app.metadataCache.on('changed', (file, data, cache) => {
                this.processFileAliases(file, cache);
            })
        );

        // Process all currently loaded files
        this.app.workspace.onLayoutReady(() => {
            this.refreshAliases();
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

    onunload() {
        console.log('Unloading Aliases for Aliases plugin');

        // Restore original methods
        // @ts-ignore
        this.app.metadataCache.getFirstLinkpathDest = this.originalGetFirstLinkpathDest;
        // @ts-ignore
        this.app.metadataCache.getLinkSuggestions = this.originalGetLinkSuggestions;

        // Clear our custom aliases
        this.customAliases.clear();
        this.aliasToFilePath.clear();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.refreshAliases();
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

        for (const property of this.settings.aliasProperties) {
            if (cache.frontmatter[property]) {
                const propertyValue = cache.frontmatter[property];

                if (Array.isArray(propertyValue)) {
                    propertyValue.forEach(value => {
                        if (typeof value === 'string' && value.trim()) {
                            customAliasesForFile.add(value.trim());
                        }
                    });
                } else if (typeof propertyValue === 'string') {
                    if (propertyValue.trim()) {
                        customAliasesForFile.add(propertyValue.trim());
                    }
                }
            }
        }

        return customAliasesForFile;
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
