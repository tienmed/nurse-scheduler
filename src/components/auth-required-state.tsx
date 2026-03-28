import Link from "next/link";
import { LogIn, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

interface AuthRequiredStateProps {
  returnTo?: string;
}

export function AuthRequiredState({ returnTo = "/" }: AuthRequiredStateProps) {
  const href = `/sign-in?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <EmptyState
      icon={ShieldAlert}
      title="Phiên đăng nhập cần được làm mới"
      description="Phiên Google của bạn hiện không được đọc ổn định ở request này. Bạn có thể đăng nhập lại rồi quay về đúng màn hình đang làm việc mà không phải đoán lại thao tác."
      action={
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
        >
          <LogIn className="h-4 w-4" />
          Đăng nhập lại
        </Link>
      }
      tips={[
        "Trang hiện tại không tự đẩy bạn ra ngoài nữa để tránh mất ngữ cảnh.",
        "Sau khi đăng nhập lại, bạn có thể quay về tiếp tục thao tác đang dở.",
      ]}
      tone="amber"
    />
  );
}
