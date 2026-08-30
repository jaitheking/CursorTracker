import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing required environment variables.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const { old_activity_date, old_activity_type, new_activity_type, details, embeddingModel } = req.body;
    const resolvedEmbeddingModel: string = embeddingModel || 'gemini-embedding-exp-03-07';

    try {
        // Re-generate the vector embedding using Gemini
        const embeddingModelInstance = genAI.getGenerativeModel({ model: resolvedEmbeddingModel });
        const vectorResponse = await embeddingModelInstance.embedContent(details);
        const embedding = vectorResponse.embedding.values;

        // If the primary key (type) changed, we must delete the old one first
        if (old_activity_type !== new_activity_type) {
            const { error: deleteError } = await supabase.from('training_logs').delete().match({
                activity_date: old_activity_date,
                activity_type: old_activity_type
            });
            if (deleteError) throw deleteError;
        }

        // Save to Supabase (upsert)
        const { error: upsertError } = await supabase.from('training_logs').upsert({
            activity_date: old_activity_date, // Date remains the same
            activity_type: new_activity_type,
            details,
            embedding
        }, { onConflict: 'activity_date, activity_type' });

        if (upsertError) throw upsertError;

        res.status(200).json({ success: true, message: 'Log updated!' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
