"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pendingText?: string;
  variant?: "primary" | "outline";
}

export function SubmitButton({
  children,
  className,
  pendingText = "Đang xử lý...",
  variant = "primary",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed";

  const variantStyles =
    variant === "outline"
      ? "border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100 disabled:bg-slate-100"
      : "bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-300";

  return (
    <button
      {...props}
      disabled={pending || props.disabled}
      className={`${baseStyles} ${variantStyles} ${className || ""}`}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
