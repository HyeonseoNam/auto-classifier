import { Plugin, Notice } from "obsidian";
import {
	AutoClassifierSettingTab,
	AutoClassifierSettings,
	DEFAULT_SETTINGS,
	OutLocation,
	OutType,
	ClassifierEngine, // Added ClassifierEngine
} from "src/settings";
import { ViewManager } from "src/view-manager";
import { ChatGPT } from "src/api";
import { JinaAI, JinaAPIResponse } from "src/jina-api"; // Added JinaAI and JinaAPIResponse

enum InputType {
	SelectedArea,
	Title,
	FrontMatter,
	Content,
}

export default class AutoClassifierPlugin extends Plugin {
	settings: AutoClassifierSettings;
	viewManager = new ViewManager(this.app);

	async onload() {
		await this.loadSettings();

		// Commands
		this.addCommand({
			id: "classify-tag-selected",
			name: "Classify tag from Selected Area",
			callback: async () => {
				await this.runClassifyTag(InputType.SelectedArea);
			},
		});
		this.addCommand({
			id: "classify-tag-title",
			name: "Classify tag from Note Title",
			callback: async () => {
				await this.runClassifyTag(InputType.Title);
			},
		});
		this.addCommand({
			id: "classify-tag-frontmatter",
			name: "Classify tag from FrontMatter",
			callback: async () => {
				await this.runClassifyTag(InputType.FrontMatter);
			},
		});
		this.addCommand({
			id: "classify-tag-content",
			name: "Classify tag from Note Content",
			callback: async () => {
				await this.runClassifyTag(InputType.Content);
			},
		});

		this.addSettingTab(new AutoClassifierSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onunload() {}

	// create loading spin in the Notice message
	createLoadingNotice(text: string, number = 10000): Notice {
		const notice = new Notice("", number);
		const loadingContainer = document.createElement("div");
		loadingContainer.addClass("loading-container");

		const loadingIcon = document.createElement("div");
		loadingIcon.addClass("loading-icon");
		const loadingText = document.createElement("span");
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
		const currentEngine = this.settings.classifierEngine;

		// ------- [API Key check] -------
		// Note: Local AI (Ollama, LocalAI) usually doesn't require API keys
		if (currentEngine === ClassifierEngine.ChatGPT && !this.settings.apiKey) {
			// Check if it's likely a local AI setup (localhost or local IP)
			const baseUrl = this.settings.baseURL.toLowerCase();
			if (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1') && !baseUrl.includes('192.168.')) {
				new Notice(`⛔ ${this.manifest.name}: API Key is missing. Required for most cloud APIs.`);
				return null;
			}
		}
		if (currentEngine === ClassifierEngine.JinaAI && !this.settings.jinaApiKey) {
			new Notice(`⛔ ${this.manifest.name}: Jina AI API Key is missing.`);
			return null;
		}

		// ------- [Input] -------
		const refs = this.settings.commandOption.refs;
		// reference check
		if (this.settings.commandOption.useRef && (!refs || refs.length == 0)) {
			new Notice(`⛔ ${this.manifest.name}: no reference tags`);
			return null;
		}

		// Jina AI has a limit of 256 classes for zero-shot classification
		if (currentEngine === ClassifierEngine.JinaAI && refs.length > 256) {
			new Notice(`⛔ ${this.manifest.name}: Jina AI supports maximum 256 reference tags, but ${refs.length} were provided. Please reduce the number of tags.`);
			return null;
		}

		// Set Input
		let input: string | null = "";
		if (inputType == InputType.SelectedArea) {
			input = await this.viewManager.getSelection();
		} else if (inputType == InputType.Title) {
			input = await this.viewManager.getTitle();
		} else if (inputType == InputType.FrontMatter) {
			input = await this.viewManager.getFrontMatter();
		} else if (inputType == InputType.Content) {
			input = await this.viewManager.getContent();
		}

		// input error
		if (!input) {
			new Notice(`⛔ ${this.manifest.name}: no input data`);
			return null;
		}

		// Replace {{input}}, {{reference}} for ChatGPT
		let user_prompt = "";
		let system_role = "";

		if (currentEngine === ClassifierEngine.ChatGPT) {
			user_prompt = this.settings.commandOption.prmpt_template;
			user_prompt = user_prompt.replace("{{input}}", input);
			user_prompt = user_prompt.replace("{{reference}}", refs.join(","));
			system_role = this.settings.commandOption.chat_role; // Corrected from prmpt_template
		}

		// ------- [API Processing] -------
		try {
			let outputs: string[] = [];
			let jinaResponse: JinaAPIResponse | null = null;

			if (currentEngine === ClassifierEngine.ChatGPT) {
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
				// Parse ChatGPT response
				try {
					const response = JSON.parse(responseRaw.replace(/^```json\n/, "").replace(/\n```$/, ""));
					const resReliability = response.reliability;
					const resOutputs = response.outputs;

					if (!Array.isArray(resOutputs)) {
						new Notice(`⛔ ${this.manifest.name}: ChatGPT output format error (expected array)`);
						return null;
					}
					if (resReliability <= 0.2 && commandOption.useRef) { // Reliability check only if using references
						new Notice(
							`⛔ ${this.manifest.name}: ChatGPT response has low reliability (${resReliability})`,
						);
						return null;
					}
					outputs = resOutputs;
				} catch (error) {
					new Notice(`⛔ ${this.manifest.name}: ChatGPT JSON parsing error - ${error}`);
					console.error("ChatGPT JSON parsing error:", error, "Raw response:", responseRaw);
					return null;
				}
			} else if (currentEngine === ClassifierEngine.JinaAI) {
				jinaResponse = await JinaAI.callAPI(
					this.settings.jinaApiKey,
					this.settings.jinaBaseURL,
					this.settings.commandOption.model || 'jina-embeddings-v3', // Ensure model is passed
					[input], // Jina expects an array of texts
					refs
				);
				// Extract labels from Jina AI response
				// Assuming we take the top prediction for the first input text.
				// If multiple inputs were sent, this logic would need to iterate jinaResponse.data
				if (jinaResponse.data && jinaResponse.data.length > 0) {
					// Sort predictions by score and take the top ones
					const sortedPredictions = jinaResponse.data[0].predictions.sort((a, b) => b.score - a.score);
					outputs = sortedPredictions.map(p => p.label);
				} else {
					new Notice(`⛔ ${this.manifest.name}: Jina AI returned no data.`);
					return null;
				}
			}

			// Limit number of suggestions
			const limitedOutputs = outputs.slice(0, this.settings.commandOption.max_suggestions);

			if (limitedOutputs.length === 0) {
				new Notice(`⛔ ${this.manifest.name}: No tags were classified.`);
				return null;
			}

			// ------- [Add Tags] -------
			// Output Type 1. [Tag Case] + Output Type 2. [Wikilink Case]
			if (
				commandOption.outType == OutType.Tag ||
				commandOption.outType == OutType.Wikilink
			) {
				for (const resOutput of limitedOutputs) {
					if (commandOption.outLocation == OutLocation.Cursor) {
						this.viewManager.insertAtCursor(
							resOutput,
							commandOption.overwrite,
							commandOption.outType,
							commandOption.outPrefix,
							commandOption.outSuffix,
						);
					} else if (
						commandOption.outLocation == OutLocation.ContentTop
					) {
						this.viewManager.insertAtContentTop(
							resOutput,
							commandOption.outType,
							commandOption.outPrefix,
							commandOption.outSuffix,
						);
					}
				}
			}
			// Output Type 3. [Frontmatter Case]
			else if (commandOption.outType == OutType.FrontMatter) {
				this.viewManager.insertAtFrontMatter(
					commandOption.key,
					limitedOutputs,
					commandOption.overwrite,
					commandOption.outPrefix,
					commandOption.outSuffix,
				);
			}
			// Output Type 4. [Title]
			else if (commandOption.outType == OutType.Title) {
				this.viewManager.insertAtTitle(
					limitedOutputs,
					commandOption.overwrite,
					commandOption.outPrefix,
					commandOption.outSuffix,
				);
			}
			// Show token usage if available
			let tokenInfo = "";
			if (currentEngine === ClassifierEngine.JinaAI && jinaResponse && jinaResponse.usage) {
				tokenInfo = ` (${jinaResponse.usage.total_tokens} tokens used)`;
			}
			const engineName = currentEngine === ClassifierEngine.ChatGPT ? "OpenAI-compatible API" : "Jina AI";
			new Notice(`✅ ${this.manifest.name}: classified with ${limitedOutputs.length} tags using ${engineName}${tokenInfo}.`);

		} catch (error: any) {
			const engineName = currentEngine === ClassifierEngine.ChatGPT ? "OpenAI-compatible API" : "Jina AI";
			new Notice(`⛔ ${this.manifest.name} API Error: ${error.message || error}`);
			console.error(`${engineName} API Error:`, error);
			return null;
		}
	}
}
