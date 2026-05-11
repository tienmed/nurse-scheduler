"use client";

import React, { useState } from "react";
import { Sparkles, X, Loader2, Bot, AlertTriangle, CheckCircle2 } from "lucide-react";

interface AIAssistantProps {
  weekStart?: string;
  month?: string;
  mode: "schedule" | "report";
}

export function AIAssistant({ weekStart, month, mode }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAIAction = async (action: "optimize" | "validate" | "report") => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setIsOpen(true);

    try {
      const response = await fetch("/api/ai/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          data: { 
            weekStart, 
            month: month || weekStart?.slice(0, 7) 
          }
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Lỗi không xác định");
      
      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {mode === "schedule" ? (
          <>
            <button
              onClick={() => handleAIAction("validate")}
              className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800 transition hover:border-indigo-300 hover:bg-indigo-100 shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              AI Phân tích lịch
            </button>
            <button
              onClick={() => handleAIAction("optimize")}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 shadow-md shadow-indigo-200"
            >
              <Bot className="h-4 w-4" />
              AI Đề xuất lịch
            </button>
          </>
        ) : (
          <button
            onClick={() => handleAIAction("report")}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 shadow-md shadow-indigo-200"
          >
            <Bot className="h-4 w-4" />
            AI Tóm tắt điều hành
          </button>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">AI Trợ lý Điều dưỡng</h3>
                  <p className="text-xs text-slate-500">Phân tích bằng Multi-Agent (Qwen & Gemma)</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-6 w-6 rounded-full bg-indigo-50" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-slate-900">AI đang suy nghĩ...</p>
                    <p className="text-xs text-slate-500">Quá trình này có thể mất 10-30 giây tùy độ phức tạp của lịch.</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                    <AlertTriangle className="h-8 w-8" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">Đã có lỗi xảy ra</h4>
                    <p className="text-sm text-slate-500 mt-1">{error}</p>
                  </div>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none">
                  <div className="flex items-center gap-2 mb-4 text-teal-600 font-medium text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Đã hoàn thành phân tích
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    {result}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50/50 px-8 py-4 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-xl px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
