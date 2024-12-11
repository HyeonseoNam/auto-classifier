import { Plugin, Notice } from "obsidian";
import { AutoClassifierSettingTab, AutoClassifierSettings, DEFAULT_SETTINGS, OutLocation, OutType} from "src/settings";
import { ViewManager } from "src/view-manager";
import { ChatGPT } from 'src/api';

enum InputType {
	SelectedArea,
	Title,
	FrontMatter,
	Content
}

export default class AutoClassifierPlugin extends Plugin {
	settings: AutoClassifierSettings;
	viewManager = new ViewManager(this.app);

	async onload() {
		await this.loadSettings();

		// Commands
		this.addCommand({
			id: 'classify-tag-selected',
			name: 'Classify tag from Selected Area',
			callback: async () => {
				await this.runClassifyTag(InputType.SelectedArea);
			}
		});
		this.addCommand({
			id: 'classify-tag-title',
			name: 'Classify tag from Note Title',
			callback: async () => {
				await this.runClassifyTag(InputType.Title);
			}
		});
		this.addCommand({
			id: 'classify-tag-frontmatter',
			name: 'Classify tag from FrontMatter',
			callback: async () => {
				await this.runClassifyTag(InputType.FrontMatter);
			}
		});
		this.addCommand({
			id: 'classify-tag-content',
			name: 'Classify tag from Note Content',
			callback: async () => {
				await this.runClassifyTag(InputType.Content);
			}
		});

		this.addSettingTab(new AutoClassifierSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onunload() {
	}

	// create loading spin in the Notice message
	createLoadingNotice(text: string, number = 10000): Notice {
		const notice = new Notice('', number);
		const loadingContainer = document.createElement('div');
		loadingContainer.addClass('loading-container');

		const loadingIcon = document.createElement('div');
		loadingIcon.addClass('loading-icon');
		const loadingText = document.createElement('span');
		loadingText.textContent = text;
		//@ts-ignore
		notice.noticeEl.empty();
		loadingContainer.appendChild(loadingIcon);
		loadingContainer.appendChild(loadingText);
		//@ts-ignore
		notice.noticeEl.appendChild(loadingContainer);

		return notice;
	}

	async runClassifyTag(inputType: InputType) {
		const loadingNotice = this.createLoadingNotice(`${this.manifest.name}: Processing..`);
		try {
			await this.classifyTag(inputType);
			loadingNotice.hide();
		} catch (err) {
			loadingNotice.hide();
		}
	}

	// Main Classification
	async classifyTag(inputType: InputType) {
		const commandOption = this.settings.commandOption;
		// ------- [API Key check] -------
		if (!this.settings.apiKey) {
			new Notice(`⛔ ${this.manifest.name}: You shuld input your API Key`);
			return null
		}
		// ------- [Input] -------
		const refs = this.settings.commandOption.refs;
		// reference check
		if (this.settings.commandOption.useRef && (!refs || refs.length == 0)) {
			new Notice(`⛔ ${this.manifest.name}: no reference tags`);
			return null
		}

		// Set Input 
		let input: string | null = '';
		if (inputType == InputType.SelectedArea) {
			input = await this.viewManager.getSelection();
		}
		else if (inputType == InputType.Title) {
			input = await this.viewManager.getTitle();
		}
		else if (inputType == InputType.FrontMatter) {
			input = await this.viewManager.getFrontMatter();
		}
		else if (inputType == InputType.Content) {
			input = await this.viewManager.getContent();
		}

		// input error
		if (!input) {
			new Notice(`⛔ ${this.manifest.name}: no input data`);
			return null;
		}

		// Replace {{input}}, {{reference}}
		let user_prompt = this.settings.commandOption.prmpt_template;
		user_prompt = user_prompt.replace('{{input}}', input);
		user_prompt = user_prompt.replace('{{reference}}', refs.join(','));
		user_prompt = user_prompt.replace('{{max_suggestions}}', String(this.settings.commandOption.max_suggestions));

		const system_role = this.settings.commandOption.prmpt_template;

		// ------- [API Processing] -------
		// Call API
		const responseRaw = await ChatGPT.callAPI(
			system_role, 
			user_prompt, 
			this.settings.apiKey,
			this.settings.commandOption.model,
			this.settings.commandOption.max_tokens,
			undefined,
			undefined,
			undefined,
			undefined,
			this.settings.baseURL,
		);
		try {
			const response = JSON.parse(responseRaw);
			const resReliability = response.reliability;
			const resOutputs = response.outputs;

			// Validate response format
			if (!Array.isArray(resOutputs)) {
				new Notice(`⛔ ${this.manifest.name}: output format error (expected array)`);
				return null;
			}

			// Avoid low reliability
			if (resReliability <= 0.2) {
				new Notice(`⛔ ${this.manifest.name}: response has low reliability (${resReliability})`);
				return null;
			}

			// ------- [Add Tags] -------
			for (const resOutput of resOutputs) {
		// Output Type 1. [Tag Case] + Output Type 2. [Wikilink Case]
		if (commandOption.outType == OutType.Tag || commandOption.outType == OutType.Wikilink) {
			if (commandOption.outLocation == OutLocation.Cursor) {
				this.viewManager.insertAtCursor(resOutput, commandOption.overwrite, commandOption.outType, commandOption.outPrefix, commandOption.outSuffix);
			} 
			else if (commandOption.outLocation == OutLocation.ContentTop) {
				this.viewManager.insertAtContentTop(resOutput, commandOption.outType, commandOption.outPrefix, commandOption.outSuffix);
			}
		}
		// Output Type 3. [Frontmatter Case]
		else if (commandOption.outType == OutType.FrontMatter) {
			this.viewManager.insertAtFrontMatter(commandOption.key, resOutput, commandOption.overwrite, commandOption.outPrefix, commandOption.outSuffix);
		}
		// Output Type 4. [Title]
		else if (commandOption.outType == OutType.Title) {
			this.viewManager.insertAtTitle(resOutput, commandOption.overwrite, commandOption.outPrefix, commandOption.outSuffix);
		}
			}
			new Notice(`✅ ${this.manifest.name}: classified with ${resOutputs.length} tags`);
	}

}


