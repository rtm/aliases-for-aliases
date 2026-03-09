import { App, PluginSettingTab, Setting } from 'obsidian';
import AliasesForAliasesPlugin from './main';

export interface AliasesForAliasesSettings {
    // Array of frontmatter properties to treat as aliases
    aliasProperties: string[];
}

export const DEFAULT_SETTINGS: AliasesForAliasesSettings = {
    aliasProperties: ['keywords', 'tags']
};

export class AliasesForAliasesSettingTab extends PluginSettingTab {
    plugin: AliasesForAliasesPlugin;

    constructor(app: App, plugin: AliasesForAliasesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Aliases for aliases - Settings' });

        new Setting(containerEl)
            .setName('Frontmatter properties to treat as aliases')
            .setDesc('Enter frontmatter properties to be treated as aliases (comma-separated)')
            .addText(text => text
                .setPlaceholder('keywords, tags, etc.')
                .setValue(this.plugin.settings.aliasProperties.join(', '))
                .onChange(async (value) => {
                    // Split by comma and trim whitespace
                    this.plugin.settings.aliasProperties = value
                        .split(',')
                        .map(prop => prop.trim())
                        .filter(prop => prop.length > 0);
                    
                    await this.plugin.saveSettings();
                    // Refresh aliases when settings change
                    this.plugin.refreshAliases();
                }));

        containerEl.createEl('p', { 
            text: 'Note: Changes will apply to all open files immediately and to other files when they are opened.'
        });
    }
}