import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing required environment variables.' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { id, name, description, label, workout_data } = req.body;

    if (!name || !workout_data) {
        return res.status(400).json({ error: 'Missing required fields: name and workout_data.' });
    }

    try {
        const payload: any = {
            name,
            description,
            label,
            workout_data
        };

        if (id) {
            payload.id = id;
        }

        const { data, error } = await supabase
            .from('workout_catalog')
            .upsert(payload)
            .select();

        if (error) throw error;
        res.status(200).json({ success: true, workout: data[0] });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
