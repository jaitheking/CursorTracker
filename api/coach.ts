import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { userPrompt } = req.body;

    try {
        // Read instructions
        const sysInstructionPath = path.join(process.cwd(), 'src', 'config', 'system_instructions.txt');
        const systemInstruction = fs.readFileSync(sysInstructionPath, 'utf8');

        // Vectorize the prompt to find relevant history
        const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
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