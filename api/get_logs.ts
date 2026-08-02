import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing required environment variables.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    try {
        const { data, error } = await supabase.from('training_logs').select('activity_date, activity_type, details');

        if (error) throw error;
        res.status(200).json({ success: true, logs: data });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
