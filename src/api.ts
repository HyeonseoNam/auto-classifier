import { requestUrl } from "obsidian";
export class ChatGPT {
	private static baseUrl = 'https://api.openai.com/v1/chat/completions';

	static async callAPI(
		system_role: string,
		user_prompt: string,
		apiKey: string,
		model = "gpt-3.5-turbo",
		temperature = 0,
		max_tokens = 150,
		top_p = 0.95,
		frequency_penalty = 0,
		presence_penalty = 0.5): Promise<string> {

		const headers = {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		};

		const body = JSON.stringify({
			model: 'gpt-3.5-turbo',
			messages: [
				{ "role": "system", "content": system_role },
				{ "role": "user", "content": user_prompt },
			],
			max_tokens: max_tokens,
			n: 1,
			// stop: '\n',
			stop: null,
			temperature: temperature,
			top_p: top_p,
			frequency_penalty: frequency_penalty,
			presence_penalty: presence_penalty
		});

		const response = await requestUrl({
			url: this.baseUrl,
			method: 'POST',
			headers: headers,
			body: body,
		});

		if (response.status >= 400) {
			throw new Error(`API call error: ${response.status}`);
		}

		const data = JSON.parse(response.text);
		return data.choices[0].message.content;
	}
}