"use client";

import { useState, useEffect } from "react";
import { CalendarRange, ChevronRight, X } from "lucide-react";

interface DataHorizonPickerProps {
    initialHorizon?: string;
}

export function DataHorizonPicker({ initialHorizon }: DataHorizonPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [horizon, setHorizon] = useState(initialHorizon || "60");

    useEffect(() => {
        // Nếu chưa từng chọn (không có cookie), tự động mở popup sau 1 giây
        if (!initialHorizon) {
            const timer = setTimeout(() => setIsOpen(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [initialHorizon]);

    const saveHorizon = (value: string) => {
        setHorizon(value);
        // Lưu vào cookie 1 năm
        document.cookie = `nh-data-horizon=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
        setIsOpen(false);
        // Reload để server áp dụng bộ lọc mới
        window.location.reload();
    };

    const options = [
        { value: "14", label: "14 ngày gần đây", desc: "Siêu tốc độ (2 tuần)" },
        { value: "30", label: "30 ngày gần đây", desc: "Tốc độ nhanh (1 tháng)" },
        { value: "60", label: "60 ngày gần đây", desc: "Mặc định (2 tháng)" },
        { value: "all", label: "Tất cả dữ liệu", desc: "Có thể gây chậm ứng dụng" },
    ];

    const currentOption = options.find(o => o.value === horizon) || options[2]; // Default to 60 (index 2)

    return (
        <>
            {/* Nút nhỏ ở thanh trạng thái hoặc footer */}
            <button
                onClick={() => setIsOpen(true)}
                title="Chọn phạm vi dữ liệu"
                className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
            >
                <CalendarRange className="h-3.5 w-3.5" />
                Phạm vi: {currentOption.label}
            </button>

            {/* Modal Popup */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md animate-in fade-in zoom-in duration-300 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
                        <div className="relative p-6 pb-0">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
                                <CalendarRange className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Phạm vi hiển thị dữ liệu</h3>
                            <p className="mt-2 text-sm text-slate-500">
                                Chọn khoảng thời gian bạn muốn làm việc. Giới hạn phạm vi giúp ứng dụng chạy nhanh hơn và tiết kiệm dung lượng.
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="space-y-2">
                                {options.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => saveHorizon(opt.value)}
                                        className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${horizon === opt.value
                                            ? "border-teal-500 bg-teal-50/50 ring-1 ring-teal-500"
                                            : "border-slate-100 bg-slate-50 hover:border-slate-300 hover:bg-white"
                                            }`}
                                    >
                                        <div>
                                            <p className={`font-bold ${horizon === opt.value ? "text-teal-900" : "text-slate-900"}`}>
                                                {opt.label}
                                            </p>
                                            <p className="text-xs text-slate-500">{opt.desc}</p>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 ${horizon === opt.value ? "text-teal-500" : "text-slate-300"}`} />
                                    </button>
                                ))}
                            </div>

                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="rounded-2xl px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
