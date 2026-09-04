import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing GEMINI_API_KEY.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const { fitData, chatModel } = req.body;
    const resolvedChatModel: string = chatModel || 'gemini-3.8-flash';

    try {
        const systemInstruction = `
You are an expert sports data analyst. Your job is to read raw parsed FIT file JSON data and produce a highly structured, accurate, and clean markdown summary of the workout. 
Do NOT misinterpret lap data. Specifically:
- Overall distance and duration are the TOTALS.
- Do NOT mistake the first lap's distance/time as the overall total.
- If it is a strength workout (no distance, only time and HR), identify it as such.
- If it is a running workout, summarize total distance, total time, average pace, max/avg HR, cadence, and a clean breakdown of the laps (splits).
Extract all important metrics accurately. Provide the summary as clean markdown text.
`;

        const model = genAI.getGenerativeModel({ model: resolvedChatModel, systemInstruction });
        const result = await model.generateContent(`Here is the raw FIT file JSON data:\n\n${JSON.stringify(fitData, null, 2)}\n\nPlease summarize this workout data accurately.`);

        res.status(200).json({ summary: result.response.text() });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
