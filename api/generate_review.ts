import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const { chatModel, startDate, endDate } = req.body;
    const resolvedChatModel = chatModel || 'gemini-3.8-flash';

    try {
        // Build Supabase query with date filtering if provided
        let query = supabase
            .from('training_logs')
            .select('activity_date, activity_type, details')
            .order('activity_date', { ascending: false });
            
        if (startDate) {
            query = query.gte('activity_date', startDate);
        }
        if (endDate) {
            query = query.lte('activity_date', endDate);
        } else if (!startDate) {
            // Fallback limit if no dates provided
            query = query.limit(15);
        }

        const { data: recentLogs, error } = await query;

        if (error) throw error;

        // Note: In a real implementation, we would connect to https://mcp.coros.com/mcp here
        // to fetch native telemetry to augment the Supabase data for this date range.
        
        const dateContext = (startDate && endDate) 
            ? `for the week of ${startDate} to ${endDate}` 
            : `for the recent training period`;

        const systemInstruction = `
You are an expert, strict, and highly demanding AI Performance Coach analyzing an athlete ${dateContext}.
Be harsh but fair in your performance review. Spot gaps in the training week (e.g. missed runs, poorly executed runs).
The optimal schedule is: Tuesday = Recovery, Wednesday = Threshold, Thursday = Intervals, Saturday = LSD. Hold the athlete accountable to this.
Keep it concise and NOT wordy. 
Return a valid JSON object with the exact following keys:
- "summary": A brief 2-sentence harsh but fair overview.
- "keyInsights": Array of strings (3 concise, actionable, and strict insights pointing out gaps or praising perfection).
- "runningStats": An object with "totalDistance" (string), "avgPace" (string), "avgHR" (string).
- "strengthStats": An object with "totalTime" (string), "avgHR" (string).
- "chartData": An object with "labels" (array of dates combined with type of training, e.g., "Tue (Recovery)"), "runningPace" (array of numbers, pace in mins/km), "runningHR" (array of numbers), "runningDistance" (array of numbers in km), "strengthDuration" (array of numbers), "strengthHR" (array of numbers).
DO NOT WRAP IN \`\`\`json\`\`\`, JUST OUTPUT THE RAW JSON OBJECT.
`;

        const logsContext = recentLogs && recentLogs.length > 0 
            ? JSON.stringify(recentLogs) 
            : "No logs found for the specified period.";

        const model = genAI.getGenerativeModel({ model: resolvedChatModel, systemInstruction });
        const fullPrompt = `LOGS (${dateContext}):\n${logsContext}\n\nGenerate the performance review.`;
        
        const result = await model.generateContent(fullPrompt);
        let text = result.response.text().trim();
        if (text.startsWith('```json')) {
            text = text.replace(/```json\n?/, '').replace(/\n?```$/, '');
        }

        res.status(200).json({ review: JSON.parse(text) });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
