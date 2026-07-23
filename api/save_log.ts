import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing required environment variables.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const { activity_type, details } = req.body;

    try {
        // Generate the vector embedding using Gemini
        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const vectorResponse = await embeddingModel.embedContent(details);
        const embedding = vectorResponse.embedding.values;

        // Save to Supabase
        const { error } = await supabase.from('training_logs').insert({
            activity_type,
            details,
            embedding
        });

        if (error) throw error;
        res.status(200).json({ success: true, message: 'Log vectorized and saved!' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}