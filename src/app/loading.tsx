export default function GlobalLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-[3px] border-slate-200 border-t-teal-600"></div>
        <h2 className="text-lg font-semibold text-slate-900">Đang tải dữ liệu...</h2>
        <p className="mt-1 text-sm text-slate-500">Vui lòng đợi giây lát</p>
      </div>
    </div>
  );
}
