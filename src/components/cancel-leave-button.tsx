"use client";

import { useState, useTransition } from "react";
import { Briefcase, Loader2, X } from "lucide-react";
import { cancelLeaveAction } from "@/app/actions";

interface CancelLeaveButtonProps {
    leaveId: string;
    staffName: string;
    date: string;
    shiftLabel: string;
}

export function CancelLeaveButton({ leaveId, staffName, date, shiftLabel }: CancelLeaveButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleConfirm = (formData: FormData) => {
        startTransition(async () => {
            await cancelLeaveAction(formData);
            setShowConfirm(false);
        });
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setShowConfirm(true)}
                title="Đăng ký đi làm"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60 transition hover:bg-emerald-100 hover:text-emerald-800 hover:border-emerald-300 active:scale-[0.97]"
            >
                <Briefcase className="h-3 w-3" />
                Đi làm
            </button>

            {showConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowConfirm(false);
                    }}
                >
                    <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-[28px] border border-white/80 bg-white p-6 shadow-2xl sm:p-8">
                        <button
                            type="button"
                            onClick={() => setShowConfirm(false)}
                            title="Đóng"
                            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div className="mb-5 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-emerald-50 border border-emerald-100">
                                <Briefcase className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                                    Xác nhận đi làm
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Huỷ đăng ký nghỉ phép
                                </p>
                            </div>
                        </div>

                        <p className="mb-6 text-sm text-slate-600 leading-relaxed">
                            Bạn xác nhận <strong>{staffName}</strong> sẽ quay lại làm việc vào{" "}
                            <strong>{shiftLabel}</strong> ngày <strong>{date}</strong>?
                            <br />
                            <span className="text-slate-400 mt-1 block">
                                Đăng ký nghỉ phép cho ca này sẽ bị xoá khỏi hệ thống.
                            </span>
                        </p>

                        <form action={handleConfirm} className="space-y-6">
                            <input type="hidden" name="leaveId" value={leaveId} />
                            <input type="hidden" name="returnTo" value="/leave" />
                            {shiftLabel.toLowerCase() !== "cả ngày" && <input type="hidden" name="cancelType" value="all" />}

                            {shiftLabel.toLowerCase() === "cả ngày" && (
                                <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="cancelType" value="all" defaultChecked className="text-emerald-600 focus:ring-emerald-600" />
                                        <span className="text-sm font-medium text-slate-700">Đi làm cả ngày (Huỷ toàn bộ phép)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                                        <input type="radio" name="cancelType" value="morning" className="text-emerald-600 focus:ring-emerald-600" />
                                        <span className="text-sm font-medium text-slate-700">Chỉ đi làm Sáng (Giữ phép Chiều)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                                        <input type="radio" name="cancelType" value="afternoon" className="text-emerald-600 focus:ring-emerald-600" />
                                        <span className="text-sm font-medium text-slate-700">Chỉ đi làm Chiều (Giữ phép Sáng)</span>
                                    </label>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(false)}
                                    disabled={isPending}
                                    className="rounded-2xl px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                                >
                                    Huỷ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 hover:shadow-lg disabled:opacity-60"
                                >
                                    {isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Briefcase className="h-4 w-4" />
                                    )}
                                    {isPending ? "Đang xử lý..." : "Xác nhận"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
