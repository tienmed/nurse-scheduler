export type AIModelType = 'qwen3' | 'qwen2.5' | 'gemma4';

export interface AIResponse {
    content: string;
    model: string;
    usage?: any;
}

class AIService {
    private static instance: AIService;
    
    private readonly urls: Record<AIModelType | 'transcribe' | 'unified', string> = {
        'gemma4': process.env.GEMMA4_API_URL || 'https://pnt.badt.vn/gemma4',
        'qwen3': process.env.QWEN3_API_URL || 'https://pnt.badt.vn/qwen3',
        'qwen2.5': process.env.QWEN25_API_URL || 'https://pnt.badt.vn/qwen25',
        'transcribe': 'https://pnt.badt.vn/medical_transcribe',
        'unified': 'https://pnt.badt.vn/ai_agent'
    };

    private readonly apiToken = process.env.AI_API_TOKEN || '68f67779de494d422cc6fe17f7f20b3974a6fdcb46cb804fbab24b232aaa6013';

    private constructor() {}

    public static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    /**
     * Chuyển đổi âm thanh thành văn bản
     */
    async transcribeAudio(audioBlob: Blob): Promise<string> {
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'command.wav');

        const response = await fetch(`${this.urls.transcribe}/transcribe`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiToken}`
            },
            body: formData
        });

        if (!response.ok) throw new Error("Lỗi khi chuyển đổi giọng nói");
        const data = await response.json();
        return data.transcription;
    }

    /**
     * Phân tích câu lệnh điều phối bằng Qwen3
     */
    async parseVoiceCommand(text: string): Promise<{
        action: 'MOVE' | 'LEAVE' | 'UNKNOWN';
        staffName?: string;
        sourcePosition?: string;
        targetPosition?: string;
        replacedStaffName?: string;
        date?: string; // yyyy-MM-dd hoặc từ khóa 'today', 'tomorrow'
        shift?: 'morning' | 'afternoon' | 'full-day';
        time?: string;
    }> {
        const prompt = `
Dữ liệu đầu vào: "${text}"

Nhiệm vụ: Phân tích câu lệnh điều phối và chuyển thành JSON sau:
{
  "action": "MOVE" | "LEAVE" | "UNKNOWN",
  "staffName": "Tên nhân viên",
  "date": "today" | "tomorrow" | "yyyy-MM-dd" | "ngày...tháng...",
  "shift": "morning" | "afternoon" | "full-day",
  "reason": "Lý do nghỉ (nếu có)",
  "sourcePosition": "...",
  "targetPosition": "...",
  "replacedStaffName": "..."
}

Lưu ý cho hành động LEAVE:
- Luôn cố gắng bóc tách "lý do" nếu người dùng nhắc tới (ví dụ: "vì việc riêng", "đi khám").
- Nếu người dùng nói ngày cụ thể (ví dụ: "ngày 20 tháng 5"), hãy cố gắng chuyển về yyyy-MM-dd (giả định năm hiện tại 2026).
- Các từ khóa "hôm nay", "ngày mai" vẫn giữ nguyên là "today", "tomorrow".
- Chỉ trả về JSON.
`;
        const result = await this.callAI(prompt, "Bạn là trợ lý điều phối nhân sự chuyên nghiệp.", 'qwen3');
        try {
            // Làm sạch response từ AI (trích xuất nội dung trong block markdown nếu có)
            const match = result.match(/```json?\s*([\s\S]*?)\s*```/);
            const jsonStr = match ? match[1] : result;
            return JSON.parse(jsonStr.trim());
        } catch (e) {
            console.error("Failed to parse AI response as JSON:", result);
            return { action: 'UNKNOWN' };
        }
    }

    private async callAI(
        prompt: string, 
        systemPrompt: string,
        model: AIModelType = 'gemma4'
    ): Promise<string> {
        try {
            const url = this.urls[model];
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiToken}`
                },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 4096,
                    temperature: 0.7,
                    thinking_mode: (model === 'qwen3')
                })
            });

            if (!response.ok) {
                // Fallback logic
                if (model !== 'gemma4') {
                    const fallback: AIModelType = model === 'qwen3' ? 'qwen2.5' : 'gemma4';
                    return this.callAI(prompt, systemPrompt, fallback);
                }
                throw new Error(`AI API Error: ${response.status}`);
            }

            const data = await response.json();
            return data.response || data.output || data.text || data.choices?.[0]?.message?.content || "No response from AI.";
        } catch (error) {
            console.error(`AIService Error (${model}):`, error);
            if (model !== 'gemma4') return this.callAI(prompt, systemPrompt, 'gemma4');
            return "Lỗi kết nối hệ thống AI.";
        }
    }

    /**
     * Tối ưu hóa lịch trực bằng Qwen3
     */
    async optimizeSchedule(staffData: any, constraints: string): Promise<string> {
        const prompt = `
Dữ liệu nhân sự:
${JSON.stringify(staffData, null, 2)}

Các ràng buộc:
${constraints}

Nhiệm vụ: Hãy sắp xếp lịch trực tối ưu cho tháng tới. Đảm bảo:
1. Công bằng về số ca trực giữa các nhân viên.
2. Không vi phạm các ràng buộc đã nêu.
3. Ưu tiên các nguyện vọng nghỉ phép hợp lệ.

Trả về kết quả dưới dạng bảng hoặc danh sách rõ ràng.
`;
        return this.callAI(prompt, "Bạn là chuyên gia điều phối nhân sự y tế cấp cao.", 'qwen3');
    }

    /**
     * Kiểm tra xung đột và chính sách bằng Qwen2.5
     */
    async validateSchedule(schedule: any): Promise<string> {
        const prompt = `
Dự thảo lịch trực:
${JSON.stringify(schedule, null, 2)}

Hãy kiểm tra xem lịch trực này có vi phạm bất kỳ quy tắc nào sau đây không:
1. Trực quá 2 ca liên tiếp?
2. Nghỉ giữa 2 ca ít hơn 12 tiếng?
3. Tổng số giờ làm việc trong tuần vượt quá 48h?

Chỉ ra cụ thể các vị trí vi phạm (nếu có).
`;
        return this.callAI(prompt, "Bạn là trợ lý kiểm soát tuân thủ và chính sách lao động.", 'qwen2.5');
    }

    /**
     * Tạo thông báo thân thiện bằng Gemma4
     */
    async generateNotification(staffName: string, schedule: any): Promise<string> {
        const prompt = `
Chào ${staffName}, dưới đây là lịch trực tuần này của bạn:
${JSON.stringify(schedule, null, 2)}

Hãy viết một lời chào thân thiện, tóm tắt lại các buổi trực của nhân viên này và kèm theo một lời chúc làm việc hiệu quả.
`;
        return this.callAI(prompt, "Bạn là trợ lý ảo NurseFlow thân thiện, chuyên nghiệp.", 'gemma4');
    }
    /**
     * Sinh báo cáo tóm tắt điều hành tháng bằng Qwen3
     */
    async generateExecutiveReport(reportData: any): Promise<string> {
        const prompt = `
Dữ liệu thống kê vận hành tháng:
${JSON.stringify(reportData, null, 2)}

Hãy viết một bản báo cáo tóm tắt điều hành (Executive Report) chuyên nghiệp:
1. Đánh giá hiệu suất làm việc tổng thể của đội ngũ điều dưỡng.
2. Phân tích tình hình nghỉ phép và ảnh hưởng đến vận hành.
3. Nhận xét về việc xoay vòng vị trí (rotations) - có đảm bảo mọi người đều được đào tạo chéo không?
4. Đề xuất cải tiến cho tháng tiếp theo.

Yêu cầu: Văn phong trang trọng, súc tích, bằng tiếng Việt.
`;
        return this.callAI(prompt, "Bạn là Giám đốc điều dưỡng chuyên nghiệp.", 'qwen3');
    }
}

export const aiService = AIService.getInstance();
