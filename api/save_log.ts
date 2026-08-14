import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing required environment variables.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const { activity_date, activity_type, details, embeddingModel } = req.body;
    const resolvedEmbeddingModel: string = embeddingModel || 'gemini-embedding-exp-03-07';

    try {
        // Generate the vector embedding using Gemini
        const embeddingModelInstance = genAI.getGenerativeModel({ model: resolvedEmbeddingModel });
        const vectorResponse = await embeddingModelInstance.embedContent(details);
        const embedding = vectorResponse.embedding.values;

        // Save to Supabase
        const { error } = await supabase.from('training_logs').upsert({
            activity_date,
            activity_type,
            details,
            embedding
        }, { onConflict: 'activity_date, activity_type' });

        if (error) throw error;
        res.status(200).json({ success: true, message: 'Log vectorized and saved!' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}