import { App, PluginSettingTab } from 'obsidian';
import AliasesForAliasesPlugin from './main';

export class AliasesForAliasesSettingTab extends PluginSettingTab {
    plugin: AliasesForAliasesPlugin;

    constructor(app: App, plugin: AliasesForAliasesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Aliases for Aliases' });
        containerEl.createEl('p', {
            text: 'Any frontmatter property whose name starts with "aliases:" will be treated as aliases. ' +
                  'For example, "aliases:japanese" or "aliases:spanish" can hold alternate-language names ' +
                  'that will be resolved as wikilinks throughout the vault.'
        });
    }
}
