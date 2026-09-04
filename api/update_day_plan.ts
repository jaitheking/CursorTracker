import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const { currentDayPlan, userPrompt, chatModel } = req.body;
    const resolvedChatModel: string = chatModel || 'gemini-3.8-flash';

    try {
        const systemInstruction = `
You are an AI Performance Coach. The user wants to modify a specific day's workout from their weekly plan.
You will be provided the current plan for that day in JSON format, and a user prompt with requested changes.
Return a valid JSON object matching the exact structure of the input, but modified according to the user's prompt.
DO NOT WRAP IN \`\`\`json\`\`\`, JUST OUTPUT THE RAW JSON OBJECT.
`;

        const model = genAI.getGenerativeModel({ model: resolvedChatModel, systemInstruction });
        const fullPrompt = `CURRENT DAY PLAN:\n${JSON.stringify(currentDayPlan)}\n\nUSER REQUEST: ${userPrompt}`;
        
        const result = await model.generateContent(fullPrompt);
        let text = result.response.text().trim();
        if (text.startsWith('```json')) {
            text = text.replace(/```json\n?/, '').replace(/\n?```$/, '');
        }

        res.status(200).json({ updatedPlan: JSON.parse(text) });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
