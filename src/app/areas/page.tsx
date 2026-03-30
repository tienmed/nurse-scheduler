import { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuthRequiredState } from "@/components/auth-required-state";
import { EmptyState } from "@/components/empty-state";
import { SurfaceSection } from "@/components/surface-section";
import { getAppData } from "@/lib/repository";
import { canEdit, getUserContext } from "@/lib/session";
import { MapPin, Map as MapIcon } from "lucide-react";
import { PositionCard } from "@/components/position-card";
import type { Position } from "@/lib/types";

export const metadata: Metadata = {
  title: "Khu vực & Vị trí - NurseFlow",
};

function groupPositionsByArea(positions: Position[]) {
  const groups = new globalThis.Map<string, Position[]>();
  groups.set("Khác", []);

  for (const pos of positions) {
    if (!pos.area) {
      groups.get("Khác")!.push(pos);
      continue;
    }
    if (!groups.has(pos.area)) {
      groups.set(pos.area, []);
    }
    groups.get(pos.area)!.push(pos);
  }

  if (groups.get("Khác")!.length === 0) {
    groups.delete("Khác");
  }

  // Sắp xếp các khu vực theo thứ tự chữ cái, Khác ở cuối
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === "Khác") return 1;
    if (b === "Khác") return -1;
    return a.localeCompare(b, "vi");
  });

  const sortedGroups = new globalThis.Map<string, Position[]>();
  for (const key of sortedKeys) {
    sortedGroups.set(key, groups.get(key)!);
  }

  return sortedGroups;
}

export default async function AreasPage() {
  const { user } = await getUserContext({ required: false });

  if (!user) {
    return (
      <AppShell
        currentPath="/areas"
        title="Khu vực & Vị trí"
        description="Quản lý định mức nhân sự (quota) và sắp xếp thứ tự ưu tiên gán trực."
        authEnabled={true}
        user={null}
      >
        <AuthRequiredState />
      </AppShell>
    );
  }

  if (!canEdit(user.role)) {
    redirect("/leave");
  }

  const data = await getAppData();
  const editable = canEdit(user.role);
  const areaGroups = groupPositionsByArea(data.positions);

  return (
    <AppShell
      currentPath="/areas"
      title="Khu vực & Vị trí"
      description="Quản lý định mức nhân sự (quota) và sắp xếp thứ tự ưu tiên gán trực tại từng vị trí."
      authEnabled={true}
      user={user}
    >
      <div className="mx-auto mt-6 max-w-6xl space-y-8 pb-12 px-4 sm:px-6">
        {areaGroups.size === 0 ? (
          <SurfaceSection title="Không có dữ liệu" eyebrow="Trống">
            <EmptyState
              icon={MapIcon}
              title="Chưa có vị trí nào"
              description="Hãy sang trang Nhân sự để thêm các vị trí làm việc và tính năng này sẽ được bật."
              tone="slate"
            />
          </SurfaceSection>
        ) : (
          Array.from(areaGroups.entries()).map(([areaName, positions], areaIndex) => {
            const themeColors = [
              "bg-indigo-50/70 border-indigo-100",
              "bg-emerald-50/70 border-emerald-100",
              "bg-rose-50/70 border-rose-100",
              "bg-amber-50/70 border-amber-100",
              "bg-cyan-50/70 border-cyan-100",
              "bg-violet-50/70 border-violet-100",
              "bg-orange-50/70 border-orange-100"
            ];
            const themeBackground = areaName === "Khác" ? "bg-slate-50/80 border-slate-200" : themeColors[areaIndex % themeColors.length];

            return (
              <SurfaceSection key={areaName} title={`${positions.length} vị trí`} eyebrow={areaName}>
                <h2 className="mb-6 flex items-center gap-3 text-xl font-bold tracking-tight text-slate-800">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-[16px] border border-slate-200/60 shadow-sm ${themeBackground.split(' ')[0]}`}>
                    <MapPin className="h-5 w-5 opacity-70" />
                  </div>
                  {areaName}
                  <span className="ml-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    {positions.length} vị trí
                  </span>
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {positions.map((pos: Position) => (
                    <PositionCard
                      key={pos.id}
                      position={pos}
                      allStaff={data.staff}
                      editable={editable}
                    />
                  ))}
                </div>
              </SurfaceSection>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
