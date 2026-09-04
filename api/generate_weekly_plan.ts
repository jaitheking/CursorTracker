import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const { userPrompt, chatModel, embeddingModel } = req.body;
    const resolvedChatModel: string = chatModel || 'gemini-3.8-flash';
    const resolvedEmbeddingModel: string = embeddingModel || 'gemini-embedding-exp-03-07';

    try {
        const systemInstruction = `
You are an AI Performance Coach generating a structured 7-day training plan for an above-average runner & strength trainer using a Coros Pace 4.
The user trains Monday through Sunday, and Sunday is strictly a rest/reset day.
Provide actionable advice based on past training logs.
Return a valid JSON array of exactly 7 objects, representing Monday through Sunday.
Each object must have the following keys:
- "day": string (e.g., "Monday")
- "type": string (e.g., "Running", "Strength", "Hybrid", "Rest")
- "focus": string (e.g., "Speed Work", "Upper Body", "Recovery")
- "details": string (The main workout description/circuit details)
DO NOT WRAP IN \`\`\`json\`\`\`, JUST OUTPUT THE RAW JSON ARRAY.
`;

        // Search Supabase for general progression/history
        const embeddingModelInstance = genAI.getGenerativeModel({ model: resolvedEmbeddingModel });
        // Embed a generic query to find recent progressive training
        const promptVector = await embeddingModelInstance.embedContent(userPrompt || "Progressive running and strength training schedule");

        const { data: pastLogs } = await supabase.rpc('match_training_logs', {
            query_embedding: promptVector.embedding.values,
            match_threshold: 0.5,
            match_count: 7
        });

        const historicalContext = pastLogs && pastLogs.length > 0 
            ? JSON.stringify(pastLogs.map((l: any) => l.details)) 
            : "No specific past logs found.";

        const model = genAI.getGenerativeModel({ model: resolvedChatModel, systemInstruction });
        const fullPrompt = `PAST RELEVANT LOGS:\n${historicalContext}\n\nUSER REQUEST: ${userPrompt || "Generate my 7-day training plan."}`;
        
        const result = await model.generateContent(fullPrompt);
        let text = result.response.text().trim();
        if (text.startsWith('```json')) {
            text = text.replace(/```json\n?/, '').replace(/\n?```$/, '');
        }

        res.status(200).json({ plan: JSON.parse(text) });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
