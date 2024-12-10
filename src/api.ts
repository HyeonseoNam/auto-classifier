import OpenAI from 'openai';

export class ChatGPT {
	static async callAPI(
		system_role: string,
		user_prompt: string,
		apiKey: string,
		model: string = 'gpt-3.5-turbo',
		max_tokens: number = 150,
		temperature: number = 0,
		top_p: number = 0.95,
		frequency_penalty: number = 0,
		presence_penalty: number = 0.5,
		baseURL?: string,
	): Promise<string> {
		const client = new OpenAI({
			apiKey: apiKey,
			dangerouslyAllowBrowser: true, // Required for client-side use
			baseURL: baseURL || 'https://api.openai.com/v1'
		});

		try {
			const completion = await client.chat.completions.create({
				model: model,
				messages: [
					{ role: "system", content: system_role },
					{ role: "user", content: user_prompt }
				],
				max_tokens: max_tokens,
				temperature: temperature,
				top_p: top_p,
				frequency_penalty: frequency_penalty,
				presence_penalty: presence_penalty
			});

			return completion.choices[0].message.content || '';
		} catch (error) {
			if (error instanceof OpenAI.APIError) {
				throw new Error(`OpenAI API Error: ${error.status} - ${error.message}`);
			}
			throw error;
		}
	}
}
