"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { clsx } from "clsx";

export function VoiceCommandButton() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        await sendAudioToAPI(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setFeedback(null);

      // Tự động dừng sau 10 giây để tránh ghi âm quá dài
      timeoutRef.current = setTimeout(() => {
        if (isRecording) stopRecording();
      }, 10000);

    } catch (err) {
      console.error("Microphone access denied:", err);
      setFeedback({ type: 'error', message: "Không thể truy cập Microphone." });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const sendAudioToAPI = async (blob: Blob) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('audio', blob);

    try {
      const response = await fetch('/api/ai/voice', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setFeedback({ type: 'success', message: data.message });
        // Tự động đóng feedback sau 5 giây
        setTimeout(() => setFeedback(null), 5000);
      } else {
        throw new Error(data.error || data.message || "Lỗi xử lý lệnh");
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[150] flex flex-col items-end gap-3 sm:bottom-8 sm:right-8">
      {/* Feedback Popover */}
      {feedback && (
        <div className={clsx(
          "flex items-center gap-3 rounded-2xl px-5 py-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 border backdrop-blur-md w-[280px] sm:w-auto",
          feedback.type === 'success' ? "bg-teal-50/90 border-teal-100 text-teal-900" : "bg-rose-50/90 border-rose-100 text-rose-900"
        )}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <p className="text-xs sm:text-sm font-semibold leading-tight">{feedback.message}</p>
          <button onClick={() => setFeedback(null)} className="ml-auto hover:opacity-70 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Button Container */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading}
          className={clsx(
            "relative flex h-20 w-20 sm:h-16 sm:w-16 items-center justify-center rounded-full shadow-[0_0_20px_rgba(0,0,0,0.2)] transition-all duration-300 active:scale-90",
            isRecording 
              ? "bg-rose-600 text-white shadow-[0_0_25px_rgba(225,29,72,0.5)]" 
              : "bg-indigo-600 text-white shadow-[0_0_25px_rgba(79,70,229,0.4)]",
            isLoading && "opacity-80"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-8 w-8 sm:h-7 sm:h-7 animate-spin" />
          ) : isRecording ? (
            <MicOff className="h-8 w-8 sm:h-7 sm:h-7" />
          ) : (
            <Mic className="h-8 w-8 sm:h-7 sm:h-7" />
          )}

          {/* Pulse/Glow effect */}
          {isRecording && (
            <div className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-30" />
          )}
          {!isRecording && !isLoading && (
             <div className="absolute inset-0 rounded-full bg-indigo-400 animate-pulse opacity-10" />
          )}
        </button>
        
        {/* Mobile Hint - Always visible on small screens */}
        {!isRecording && !isLoading && !feedback && (
          <span className="bg-white/90 backdrop-blur-sm border border-slate-200 text-indigo-700 text-[11px] px-3 py-1 rounded-full font-bold shadow-sm sm:hidden animate-bounce">
            Bấm để điều phối nhanh
          </span>
        )}
      </div>
    </div>
  );
}
