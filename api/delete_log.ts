import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing required environment variables.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { activity_date, activity_type } = req.body;

    try {
        const { error: deleteError } = await supabase.from('training_logs').delete().match({
            activity_date: activity_date,
            activity_type: activity_type
        });

        if (deleteError) throw deleteError;

        res.status(200).json({ success: true, message: 'Log deleted!' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
