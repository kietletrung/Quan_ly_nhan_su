import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '@/lib/getGeminiApiKey';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export async function POST(req: Request) {
  try {
    const { base64File, base64Pdf, fileName, fileType, clientGeminiKey } = await req.json();

    const rawData = base64File || base64Pdf;
    if (!rawData) {
      return NextResponse.json({ success: false, error: 'Thiếu dữ liệu file tải lên' }, { status: 400 });
    }

    const apiKey = clientGeminiKey || await getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'MISSING_GEMINI_KEY',
        message: 'Bạn chưa cấu hình API Key của Google Gemini.' 
      }, { status: 400 });
    }

    const name = (fileName || '').toLowerCase();
    const ext = name.substring(name.lastIndexOf('.'));
    const declaredType = (fileType || '').toLowerCase();

    const prompt = `
Bạn là một trợ lý AI giáo dục chuyên nghiệp phục vụ cho trung tâm giáo dục & đào tạo Nhân Phú.
Nhiệm vụ của bạn là đọc hiểu, phân tích nội dung đề thi / bài tập / tài liệu được cung cấp (từ file PDF, hình ảnh chụp đề thi, tài liệu Word .docx, bảng tính Excel .xlsx, hoặc văn bản text).
Bạn phải đọc kỹ toàn bộ nội dung (hỗ trợ tốt tiếng Nhật bao gồm Kanji/Hiragana/Katakana, tiếng Hàn, tiếng Anh, tiếng Việt, toán học...) và trích xuất hoặc tự động sinh TOÀN BỘ danh sách câu hỏi thành JSON mảng theo định dạng mẫu:
[
  {
    "id": "chuỗi_id_ngẫu_nhiên_9_ký_tự",
    "type": "MULTIPLE_CHOICE",
    "text": "Nội dung câu hỏi trắc nghiệm (ví dụ: Từ nào sau đây có nghĩa là 'xin chào' trong tiếng Nhật?)",
    "options": [
      { "id": "A", "text": "Konnichiwa" },
      { "id": "B", "text": "Sayonara" },
      { "id": "C", "text": "Arigatou" },
      { "id": "D", "text": "Sumimasen" }
    ],
    "correctAnswer": "A",
    "points": 10
  },
  {
    "id": "chuỗi_id_ngẫu_nhiên_9_ký_tự",
    "type": "SHORT_ANSWER",
    "text": "Nội dung câu hỏi điền từ hoặc tự luận ngắn (ví dụ: Điền từ thích hợp vào chỗ trống: Watashi wa ... desu.)",
    "options": [],
    "correctAnswer": "Gakusei",
    "points": 10
  }
]

Yêu cầu chi tiết và quy tắc xử lý:
1. PHÂN LOẠI CÂU HỎI:
   - "MULTIPLE_CHOICE": Nếu câu hỏi có các lựa chọn A, B, C, D (hoặc 1, 2, 3, 4 -> hãy chuẩn hóa thành A, B, C, D). "options" phải là mảng các đối tượng { "id": "A", "text": "..." }, "correctAnswer" là mã chữ cái đáp án đúng (ví dụ "A").
   - "SHORT_ANSWER": Nếu là câu hỏi tự luận, câu hỏi điền vào chỗ trống (như "1. _____ のところに何を入れますか"), dịch câu hoặc câu hỏi trả lời ngắn. "options" để mảng rỗng [], "correctAnswer" là đáp án chuẩn hoặc từ cần điền.
2. XÁC ĐỊNH ĐÁP ÁN:
   - Nếu trong tài liệu có sẵn đáp án (khoanh tròn, in đậm, gạch chân, hoặc có bảng đáp án ở cuối), hãy trích xuất chính xác đáp án đó.
   - Nếu trong tài liệu không ghi sẵn đáp án, bạn hãy suy luận và giải câu hỏi đó để đưa ra đáp án chính xác nhất làm "correctAnswer".
3. TRƯỜNG HỢP TÀI LIỆU KHÔNG PHẢI ĐỀ THI SẴN:
   - Nếu tài liệu tải lên là danh sách từ vựng, ngữ pháp, bài đọc hiểu, hoặc danh sách kiến thức (Word/Excel/Text/Ảnh), hãy thông minh tự động tạo ra bộ câu hỏi kiểm tra kiến thức (trắc nghiệm và điền từ) bám sát nội dung của tài liệu đó.
4. ĐỊNH DẠNG VÀ TÍNH DUY NHẤT:
   - Mỗi câu hỏi phải có trường "id" là chuỗi ngẫu nhiên 9 ký tự (ví dụ: "q_a8f9c2d1e").
   - "points": Mặc định là 10 (hoặc chia đều phù hợp).
   - Hãy bỏ qua Furigana rác hoặc ký tự nhiễu OCR, giữ nguyên độ chính xác của từ ngữ tiếng Nhật, Hàn, Anh, Việt.
5. QUY TẮC PHẢN HỒI (CỰC KỲ QUAN TRỌNG):
   - CHỈ trả về dữ liệu JSON mảng thuần túy [ ... ], KHÔNG được bọc trong thẻ markdown \`\`\`json hay bất kỳ văn bản giải thích nào ngoài chuỗi JSON sạch để hệ thống parse trực tiếp bằng JSON.parse().
`;

    let geminiParts: any[] = [];
    const fileBuffer = Buffer.from(rawData, 'base64');

    // 1. Xử lý file Word (.docx, .doc)
    if (ext === '.docx' || ext === '.doc' || declaredType.includes('word') || declaredType.includes('officedocument.wordprocessingml')) {
      try {
        const mammothResult = await mammoth.extractRawText({ buffer: fileBuffer });
        const docText = mammothResult.value.trim();
        if (!docText) {
          return NextResponse.json({ success: false, error: 'File Word không có nội dung văn bản để trích xuất.' }, { status: 400 });
        }
        geminiParts = [
          { text: prompt + `\n\n--- TÀI LIỆU WORD ĐÍNH KÈM: ${fileName || 'Tài liệu Word'} ---\n${docText}` }
        ];
      } catch (err: any) {
        if (ext === '.doc') {
          return NextResponse.json({ 
            success: false, 
            error: 'File Word định dạng .doc cũ không được hỗ trợ trực tiếp. Vui lòng mở file và lưu lại dưới dạng .docx hoặc .pdf rồi tải lên lại.' 
          }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: 'Lỗi khi đọc file Word: ' + err.message }, { status: 400 });
      }
    }
    // 2. Xử lý file Excel (.xlsx, .xls, .csv)
    else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv' || declaredType.includes('spreadsheet') || declaredType.includes('excel') || declaredType.includes('csv')) {
      try {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetTexts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          // Loại bỏ các dòng trống rỗng không có chữ
          const cleanLines = csv
            .split('\n')
            .filter(line => line.replace(/[,;\t\s\r]/g, '').length > 0)
            .join('\n');
          if (cleanLines.trim()) {
            sheetTexts.push(`[Sheet: ${sheetName}]\n${cleanLines}`);
          }
        }
        const excelContent = sheetTexts.join('\n\n').trim();
        if (!excelContent) {
          return NextResponse.json({ success: false, error: 'File Excel không có nội dung dữ liệu.' }, { status: 400 });
        }
        geminiParts = [
          { text: prompt + `\n\n--- DỮ LIỆU EXCEL / BẢNG TÍNH ĐÍNH KÈM: ${fileName || 'Bang_tinh.xlsx'} ---\n${excelContent}` }
        ];
      } catch (err: any) {
        return NextResponse.json({ success: false, error: 'Lỗi khi đọc file Excel: ' + err.message }, { status: 400 });
      }
    }
    // 3. Xử lý file Text / Markdown (.txt, .md, .json)
    else if (ext === '.txt' || ext === '.md' || ext === '.json' || declaredType.startsWith('text/')) {
      const textContent = fileBuffer.toString('utf-8').trim();
      if (!textContent) {
        return NextResponse.json({ success: false, error: 'File văn bản trống.' }, { status: 400 });
      }
      geminiParts = [
        { text: prompt + `\n\n--- NỘI DUNG VĂN BẢN ĐÍNH KÈM: ${fileName || 'document.txt'} ---\n${textContent}` }
      ];
    }
    // 4. Xử lý Hình ảnh (.png, .jpg, .jpeg, .webp, .heic)
    else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp' || ext === '.heic' || declaredType.startsWith('image/')) {
      let imageMime = 'image/jpeg';
      if (ext === '.png' || declaredType.includes('png')) imageMime = 'image/png';
      else if (ext === '.webp' || declaredType.includes('webp')) imageMime = 'image/webp';
      else if (ext === '.heic' || declaredType.includes('heic')) imageMime = 'image/heic';

      geminiParts = [
        { text: prompt + `\n\n(Tài liệu ảnh đính kèm: ${fileName || 'Hinh_anh_de_thi'})` },
        {
          inlineData: {
            mimeType: imageMime,
            data: rawData
          }
        }
      ];
    }
    // 5. Mặc định là PDF (hoặc fallback PDF)
    else {
      geminiParts = [
        { text: prompt + `\n\n(Tài liệu PDF đính kèm: ${fileName || 'De_thi.pdf'})` },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: rawData
          }
        }
      ];
    }

    // Danh sách các model Gemini được ưu tiên thử nghiệm (nếu model đầu bị quá tải, tự động chuyển model tiếp theo)
    const CANDIDATE_MODELS = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
      'gemini-flash-latest'
    ];

    let lastErrorMsg = '';
    let parsedQuestions: any[] | null = null;
    let successfulModel = '';

    for (const model of CANDIDATE_MODELS) {
      try {
        console.log(`[Gemini AI] Đang gọi model: ${model}...`);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: geminiParts
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        });

        const data = await response.json();

        if (!response.ok) {
          const errMsg = data.error?.message || `Lỗi HTTP ${response.status} từ model ${model}`;
          console.warn(`[Gemini AI] Model ${model} gặp lỗi:`, errMsg);
          lastErrorMsg = errMsg;

          // Nếu API Key sai thì dừng ngay để người dùng kiểm tra key
          if (data.error?.code === 403 || errMsg.toLowerCase().includes('api key not valid') || errMsg.toLowerCase().includes('invalid api key')) {
            return NextResponse.json({ 
              success: false, 
              error: 'INVALID_GEMINI_KEY', 
              message: 'API Key Google Gemini không hợp lệ hoặc đã hết hạn.' 
            }, { status: 400 });
          }

          // Nếu model đang quá tải hoặc gặp lỗi tạm thời (high demand, 503, 429, 404), chờ 600ms rồi thử model tiếp theo
          await new Promise(r => setTimeout(r, 600));
          continue;
        }

        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Dọn dẹp chuỗi JSON nếu Gemini tự động bọc trong ```json
        let cleanJson = responseText.trim();
        if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        }

        try {
          const result = JSON.parse(cleanJson);
          if (Array.isArray(result) && result.length > 0) {
            parsedQuestions = result;
            successfulModel = model;
            console.log(`[Gemini AI] Thành công trích xuất ${result.length} câu hỏi với model: ${model}`);
            break; // Thành công
          } else if (Array.isArray(result) && result.length === 0) {
            console.warn(`[Gemini AI] Model ${model} trả về 0 câu hỏi, thử model dự phòng tiếp theo...`);
            parsedQuestions = result;
            successfulModel = model;
          }
        } catch (parseErr) {
          console.warn(`[Gemini AI] Lỗi parse JSON từ model ${model}:`, cleanJson);
          lastErrorMsg = 'Dữ liệu trả về từ AI không đúng định dạng JSON.';
          continue;
        }
      } catch (networkErr: any) {
        console.warn(`[Gemini AI] Lỗi mạng khi gọi model ${model}:`, networkErr.message);
        lastErrorMsg = networkErr.message;
        continue;
      }
    }

    if (parsedQuestions && parsedQuestions.length > 0) {
      return NextResponse.json({ 
        success: true, 
        questions: parsedQuestions, 
        modelUsed: successfulModel,
        method: 'gemini_multimodal_ai' 
      });
    }

    // Nếu tất cả các model đều gặp sự cố quá tải
    let friendlyError = lastErrorMsg || 'Không thể trích xuất câu hỏi từ file.';
    const lowerErr = lastErrorMsg.toLowerCase();
    if (
      lowerErr.includes('high demand') ||
      lowerErr.includes('overloaded') ||
      lowerErr.includes('resourceexhausted') ||
      lowerErr.includes('503') ||
      lowerErr.includes('quota')
    ) {
      friendlyError = 'Máy chủ Google Gemini đang gặp tình trạng quá tải tạm thời (Spikes in demand). Hệ thống đã tự động thử các model dự phòng (2.0-flash, 1.5-flash, 1.5-pro) nhưng Google vẫn đang bận. Vui lòng bấm thử lại sau 15-30 giây!';
    }

    return NextResponse.json({ 
      success: false, 
      error: friendlyError,
      rawError: lastErrorMsg 
    }, { status: 500 });

  } catch (error: any) {
    console.error('Lỗi API parse-pdf (Gemini):', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
