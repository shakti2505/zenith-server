import dotenv from 'dotenv';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';

async function testModels() {
  const modelsToTest = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
  ];

  for (const model of modelsToTest) {
    try {
      console.log(`Testing model: "${model}"...`);
      const chat = new ChatGoogleGenerativeAI({
        model,
        apiKey,
        temperature: 0.1,
      });

      const res = await chat.invoke([new HumanMessage('Say "OK"')]);
      console.log(`✅ Model "${model}" SUCCEEDED! Response:`, res.content);
      break;
    } catch (err: any) {
      console.log(`❌ Model "${model}" failed:`, err.message);
    }
  }
}

testModels();
