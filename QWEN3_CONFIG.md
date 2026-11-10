# HƯỚNG DẪN TÍCH HỢP & CẤU HÌNH API QWEN3 [QWEN3]

Tài liệu này chứa đầy đủ thông tin xác thực, Endpoint và mã nguồn mẫu để tích hợp trực tiếp cụm AI **QWEN3** sang bất kỳ dự án mới nào mà không cần cấu hình lại từ đầu.

---

## 1. Thông Tin Kết Nối & Xác Thực (Credentials)

| Mục | Giá trị |
| :--- | :--- |
| **Nhà cung cấp** | Cụm AI Nội Viện PNT (`pnt.badt.vn`) |
| **Model ID** | `qwen3-claude-distill` |
| **API Token (`AI_API_TOKEN`)** | `68f67779de494d422cc6fe17f7f20b3974a6fdcb46cb804fbab24b232aaa6013` |
| **OpenAI Base URL** | `https://pnt.badt.vn/qwen3/v1` |
| **Chat Completions Endpoint** | `https://pnt.badt.vn/qwen3/v1/chat/completions` |
| **Direct REST Endpoint** | `https://pnt.badt.vn/qwen3` |
| **Loại xác thực (Auth Header)** | `Authorization: Bearer <AI_API_TOKEN>` |

> **Các Model khác cùng cụm (dùng chung token):**
> - **Unified Agent:** Base URL `https://pnt.badt.vn/ai_agent/v1` (Model: `ai-agent`)
> - **Gemma 3:** Base URL `https://pnt.badt.vn/gemma4/v1` (Model: `gemma-3-4b-it`)
> - **Qwen 2.5:** Endpoint `https://pnt.badt.vn/qwen25`

---

## 2. Cấu Hình Biến Môi Trường (.env)

Tạo hoặc thêm vào tệp `.env` hoặc `.env.local` ở dự án mới:

```env
# Cấu hình AI QWEN3
AI_API_TOKEN=68f67779de494d422cc6fe17f7f20b3974a6fdcb46cb804fbab24b232aaa6013
QWEN3_BASE_URL=https://pnt.badt.vn/qwen3/v1
QWEN3_MODEL=qwen3-claude-distill
```

---

## 3. Mã Nguồn Tích Hợp Sẵn Sàng Chạy

### Cách 1: Sử dụng thư viện chính thức `openai` (TypeScript / JavaScript)

Cài đặt:
```bash
npm install openai
```

Mã nguồn (`qwen3.ts`):
```typescript
import OpenAI from "openai";

const qwen3 = new OpenAI({
  apiKey: process.env.AI_API_TOKEN || "68f67779de494d422cc6fe17f7f20b3974a6fdcb46cb804fbab24b232aaa6013",
  baseURL: process.env.QWEN3_BASE_URL || "https://pnt.badt.vn/qwen3/v1",
});

export async function askQwen3(prompt: string, systemPrompt: string = "Bạn là trợ lý AI chuyên nghiệp."): Promise<string> {
  const response = await qwen3.chat.completions.create({
    model: "qwen3-claude-distill",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content || "";
}

// Chạy thử nghiệm:
// askQwen3("Chào bạn, hãy giới thiệu năng lực của bạn.").then(console.log);
```

---

### Cách 2: Gọi trực tiếp bằng `fetch` chuẩn (Không cần cài thư viện)

Mã nguồn (`ai-client.js`):
```javascript
export async function callQwen3({
  prompt,
  system = "Bạn là trợ lý AI thông minh.",
  stream = false
}) {
  const token = process.env.AI_API_TOKEN || "68f67779de494d422cc6fe17f7f20b3974a6fdcb46cb804fbab24b232aaa6013";

  const response = await fetch("https://pnt.badt.vn/qwen3/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "qwen3-claude-distill",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      stream: stream,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen3 API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}
```

---

### Cách 3: Python (OpenAI SDK / Requests)

Cài đặt:
```bash
pip install openai
```

Mã nguồn (`qwen3.py`):
```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("AI_API_TOKEN", "68f67779de494d422cc6fe17f7f20b3974a6fdcb46cb804fbab24b232aaa6013"),
    base_url=os.environ.get("QWEN3_BASE_URL", "https://pnt.badt.vn/qwen3/v1")
)

def ask_qwen3(prompt: str, system_prompt: str = "Bạn là trợ lý AI chuyên nghiệp.") -> str:
    response = client.chat.completions.create(
        model="qwen3-claude-distill",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=4096
    )
    return response.choices[0].message.content

if __name__ == "__main__":
    print(ask_qwen3("Xin chào Qwen3, hãy hỗ trợ tôi lập trình."))
```

---

### Cách 4: Kiểm tra nhanh qua cURL (Terminal / CMD)

```bash
curl -X POST "https://pnt.badt.vn/qwen3/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 68f67779de494d422cc6fe17f7f20b3974a6fdcb46cb804fbab24b232aaa6013" \
  -d '{
    "model": "qwen3-claude-distill",
    "messages": [
      {"role": "user", "content": "Kiểm tra kết nối Qwen3"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

---

## 4. Chế Độ Suy Luận Sâu (Thinking Mode)

Khi cần mô hình thực hiện các tác vụ tính toán phức tạp, giải quyết ràng buộc hoặc viết báo cáo phân tích chuyên sâu, bạn có thể gọi endpoint trực tiếp `https://pnt.badt.vn/qwen3` với cờ `thinking_mode: true`:

```json
POST https://pnt.badt.vn/qwen3
Headers:
  Authorization: Bearer 68f67779de494d422cc6fe17f7f20b3974a6fdcb46cb804fbab24b232aaa6013
  Content-Type: application/json

Body:
{
  "messages": [
    { "role": "system", "content": "Bạn là chuyên gia quy hoạch nhân sự." },
    { "role": "user", "content": "Tối ưu hóa lịch trực với các ràng buộc sau..." }
  ],
  "max_tokens": 4096,
  "temperature": 0.7,
  "thinking_mode": true
}
```
Phản hồi nhận được sẽ nằm trong trường `response`, `output` hoặc `text`.
