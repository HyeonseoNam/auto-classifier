import { requestUrl } from 'obsidian';

export interface JinaAPIRequest {
  model: string;
  input: Array<{ text: string }>;
  labels: string[];
}

export interface JinaAPIResponsePrediction {
  label: string;
  score: number;
}

export interface JinaAPIResponseData {
  object: string;
  index: number;
  prediction: string;
  score: number;
  predictions: JinaAPIResponsePrediction[];
}

export interface JinaAPIResponse {
  usage: {
    total_tokens: number;
  };
  data: JinaAPIResponseData[];
}

export class JinaAI {
  static async callAPI(
    apiKey: string,
    baseURL: string,
    model: string,
    inputText: string[], // Changed from string to string[] to allow multiple inputs if needed by the plugin logic later
    labels: string[]
  ): Promise<JinaAPIResponse> {
    const apiUrl = `${baseURL}/classify`; // Assuming baseURL does not contain /classify
    const requestBody: JinaAPIRequest = {
      model: model,
      input: inputText.map(text => ({ text })),
      labels: labels,
    };

    console.log('Jina AI Request:', { url: apiUrl, body: requestBody });

    try {
      const response = await requestUrl({
        url: apiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        throw: false, // To handle errors manually
      });

      console.log('Jina AI Response Status:', response.status);
      console.log('Jina AI Response Body:', response.text); // Log raw text for debugging

      if (response.status !== 200) {
        let errorDetails = response.text;
        try {
            const jsonError = JSON.parse(response.text);
            errorDetails = jsonError.detail || JSON.stringify(jsonError);
        } catch (e) {
            // Keep errorDetails as text if not JSON
        }
        const errorMessage = `Jina AI API Error: ${response.status} - ${errorDetails}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      const responseData: JinaAPIResponse = response.json;
      console.log('Jina AI Parsed Response Data:', responseData);
      return responseData;

    } catch (error) {
      console.error('Error calling Jina AI API:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred while calling Jina AI API.');
    }
  }
}
