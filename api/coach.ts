import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing required environment variables.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const { userPrompt, chatModel, embeddingModel } = req.body;
    const resolvedChatModel: string = chatModel || 'gemini-3.7-flash';
    const resolvedEmbeddingModel: string = embeddingModel || 'gemini-embedding-exp-03-07';

    try {
        const systemInstruction = `
You are an AI Performance Coach. Provide actionable advice based on the user's past training logs. 
ALWAYS return training plans strictly structured into 3 phases: 
- Phase 1: Warm-up
- Phase 2: Main Training Circuit (or Main Training if non-circuit)
- Phase 3: Warm-down, Finisher & Stretching

### Formatting & Layout Rules:
1. Visual Clarity: Use clean, generous vertical spacing between sections and exercises. Avoid dense walls of text or clustered markdown.
2. Section Summaries: At the top of each Phase, include high-level summary bullets for:
   * Total Time
   * Structure / Volume
   * Progression Increment
3. Exercise Formatting:
   * Bold exercise names along with sets, reps, or durations on the primary line.
   * Put focus areas, progression notes, and execution cues on indented sub-bullets directly beneath each exercise.
   * Use double spaces at the end of lines or clean markdown line breaks to prevent text from merging together.
4. Circuit Style: For strength training sessions, structure Phase 2 as a circuit-style routine with clear round counts and rest periods.
`;

        // Vectorize the prompt to find relevant history
        const embeddingModelInstance = genAI.getGenerativeModel({ model: resolvedEmbeddingModel });
        const promptVector = await embeddingModelInstance.embedContent(userPrompt);

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
        const model = genAI.getGenerativeModel({ model: resolvedChatModel, systemInstruction });
        const fullPrompt = `PAST RELEVANT LOGS:\n${historicalContext}\n\nUSER REQUEST: ${userPrompt}`;
        const result = await model.generateContent(fullPrompt);

        res.status(200).json({ plan: result.response.text() });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}