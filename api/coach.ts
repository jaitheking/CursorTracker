import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing required environment variables.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const { userPrompt } = req.body;

    try {
        const systemInstruction = "You are an AI Performance Coach. Provide concise, actionable advice based on the user's past training logs.";

        // Vectorize the prompt to find relevant history
        const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
        const promptVector = await embeddingModel.embedContent(userPrompt);

        // Search Supabase for similar past sessions
        const { data: pastLogs } = await supabase.rpc('match_training_logs', {
            query_embedding: promptVector.embedding.values,
            match_threshold: 0.6,
            match_count: 5
        });

        const historicalContext = pastLogs && pastLogs.length > 0 
            ? JSON.stringify(pastLogs.map((l: any) => l.details)) 
            : "No specific past logs found.";

        // Generate Plan
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
        const fullPrompt = `PAST RELEVANT LOGS:\n${historicalContext}\n\nUSER REQUEST: ${userPrompt}`;
        const result = await model.generateContent(fullPrompt);

        res.status(200).json({ plan: result.response.text() });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}