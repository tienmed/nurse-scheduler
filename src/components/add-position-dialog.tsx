"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X, MapPin, Loader2 } from "lucide-react";
import { savePositionAction } from "@/app/actions";

interface AddPositionDialogProps {
    existingAreas: string[];
}

export function AddPositionDialog({ existingAreas }: AddPositionDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [areaInput, setAreaInput] = useState("");
    const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const areaInputRef = useRef<HTMLInputElement>(null);

    const filteredAreas = existingAreas.filter((a) =>
        a.toLowerCase().includes(areaInput.toLowerCase())
    );

    const handleSubmit = (formData: FormData) => {
        startTransition(async () => {
            await savePositionAction(formData);
            setOpen(false);
            setAreaInput("");
        });
    };

    const selectArea = (area: string) => {
        setAreaInput(area);
        setShowAreaSuggestions(false);
        areaInputRef.current?.focus();
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/20 transition hover:bg-teal-700 hover:shadow-lg hover:shadow-teal-600/25 active:scale-[0.97]"
            >
                <Plus className="h-4 w-4" />
                Thêm vị trí
            </button>

            {/* Overlay */}
            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setOpen(false);
                    }}
                >
                    {/* Dialog */}
                    <div
                        className="relative w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 rounded-[28px] border border-white/80 bg-white p-6 shadow-2xl sm:p-8"
                    >
                        {/* Close */}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            title="Đóng"
                            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        {/* Header */}
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-teal-50 border border-teal-100">
                                <MapPin className="h-5 w-5 text-teal-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                                    Thêm vị trí mới
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Tạo vị trí làm việc và gán vào khu vực
                                </p>
                            </div>
                        </div>

                        {/* Form */}
                        <form ref={formRef} action={handleSubmit} className="space-y-5">
                            <input type="hidden" name="returnTo" value="/areas" />

                            {/* Tên vị trí */}
                            <div className="space-y-2">
                                <label
                                    htmlFor="add-pos-name"
                                    className="text-sm font-semibold text-slate-700"
                                >
                                    Tên vị trí <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="add-pos-name"
                                    name="name"
                                    type="text"
                                    required
                                    placeholder="VD: Phòng mổ, Hồi sức, Cấp cứu..."
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                                />
                            </div>

                            {/* Khu vực */}
                            <div className="relative space-y-2">
                                <label
                                    htmlFor="add-pos-area"
                                    className="text-sm font-semibold text-slate-700"
                                >
                                    Khu vực
                                </label>
                                <input
                                    ref={areaInputRef}
                                    id="add-pos-area"
                                    name="area"
                                    type="text"
                                    value={areaInput}
                                    onChange={(e) => {
                                        setAreaInput(e.target.value);
                                        setShowAreaSuggestions(true);
                                    }}
                                    onFocus={() => setShowAreaSuggestions(true)}
                                    onBlur={() => {
                                        // Delay để cho phép click vào suggestion
                                        setTimeout(() => setShowAreaSuggestions(false), 150);
                                    }}
                                    placeholder="Chọn hoặc nhập khu vực mới..."
                                    autoComplete="off"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                                />

                                {/* Suggestions dropdown */}
                                {showAreaSuggestions && filteredAreas.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
                                        {filteredAreas.map((area) => (
                                            <button
                                                key={area}
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => selectArea(area)}
                                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
                                            >
                                                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                {area}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Mô tả */}
                            <div className="space-y-2">
                                <label
                                    htmlFor="add-pos-desc"
                                    className="text-sm font-semibold text-slate-700"
                                >
                                    Mô tả
                                </label>
                                <textarea
                                    id="add-pos-desc"
                                    name="description"
                                    rows={2}
                                    placeholder="Ghi chú thêm về vị trí này (tuỳ chọn)..."
                                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/20"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOpen(false);
                                        setAreaInput("");
                                    }}
                                    disabled={isPending}
                                    className="rounded-2xl px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                                >
                                    Huỷ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/20 transition hover:bg-teal-700 hover:shadow-lg disabled:opacity-60"
                                >
                                    {isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                    {isPending ? "Đang lưu..." : "Tạo vị trí"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
