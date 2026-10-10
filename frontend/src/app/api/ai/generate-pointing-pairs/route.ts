import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '@/lib/getGeminiApiKey';

export async function POST(req: Request) {
  try {
    const { topic = 'Từ đồng âm tiếng Nhật (Pitch Accent)', count = 4, clientGeminiKey } = await req.json();

    const apiKey = clientGeminiKey || await getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'MISSING_GEMINI_KEY',
        message: 'Bạn chưa cấu hình API Key của Google Gemini.' 
      }, { status: 400 });
    }

    const aiPrompt = `
Bạn là một chuyên gia ngôn ngữ học và giáo viên tiếng Nhật/tiếng Hàn/tiếng Anh.
Nhiệm vụ của bạn là tạo danh sách ${count} cặp từ vựng so sánh / phân biệt phát âm (Pitch Accent hoặc từ đồng âm khác nghĩa hoặc cặp từ đối lập) theo chủ đề: "${topic}".

Định dạng JSON yêu cầu trả về là một mảng:
[
  {
    "id": "p_1",
    "topic": "Từ đồng âm: はな (hoa vs mũi)",
    "left": {
      "romaji": "hana",
      "emoji": "🌹",
      "japanese": "はな",
      "pitchText": "は ⤴ な",
      "meaning": "bông hoa"
    },
    "right": {
      "romaji": "hana",
      "emoji": "👃",
      "japanese": "はな",
      "pitchText": "は ⤵ な",
      "meaning": "cái mũi"
    }
  }
]

Quy tắc:
1. Đối với tiếng Nhật: Ghi rõ romaji, emoji trực quan, hiragana/kanji, và trong "pitchText" hãy thể hiện rõ hướng cao độ bằng mũi tên ⤴ (thấp lên cao), ⤵ (cao xuống thấp), hoặc ➡ (bằng phẳng) ở giữa các âm tiết.
2. Nghĩa tiếng Việt ngắn gọn, dễ hiểu (ví dụ: bông hoa, cái mũi, cơn mưa, kẹo ngọt...).
3. CHỈ trả về JSON mảng thuần túy, không có văn bản nào khác hay markdown \`\`\`json.
`;

    const CANDIDATE_MODELS = [
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash'
    ];

    let lastErrorMsg = '';
    let parsedData = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: aiPrompt }]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json"
            }
          })
        });

        const data = await response.json();
        if (!response.ok) {
          lastErrorMsg = data.error?.message || `HTTP ${response.status}`;
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let clean = text.trim();
        if (clean.startsWith('```')) {
          clean = clean.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        }

        const json = JSON.parse(clean);
        if (Array.isArray(json) && json.length > 0) {
          parsedData = json;
          break;
        }
      } catch (err: any) {
        lastErrorMsg = err.message;
        continue;
      }
    }

    if (parsedData) {
      return NextResponse.json({ success: true, pairs: parsedData });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Không thể tạo danh sách cặp từ từ AI: ' + lastErrorMsg 
    }, { status: 500 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
