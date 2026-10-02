import { QuickTasksBoard } from "@/components/quickTasks/QuickTasksBoard";
import { listQuickTasks } from "@/lib/queries/quickTasks";
import { listAllBrandsLite } from "@/lib/queries/brands";
import { listCampaignsLite } from "@/lib/queries/campaigns";
import { getLang, ts } from "@/lib/i18n";

export default async function QuickTasksPage() {
  const tasks = listQuickTasks();
  const brands = listAllBrandsLite();
  const activations = listCampaignsLite();
  const lang = await getLang();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">{ts(lang, "Quick Tasks", "Việc nhanh")}</h1>
        <div className="font-mono-tag text-[12px] text-foreground-muted mt-1">
          {ts(lang, "Personal operational memory — capture first, organise later. Not tied to a formal Campaign, Brand or A&P package until you link one.", "Ghi nhớ công việc cá nhân — ghi lại trước, sắp xếp sau. Chưa gắn với Campaign, Brand hay gói A&P chính thức nào cho đến khi bạn liên kết.")}
        </div>
      </div>

      <QuickTasksBoard initialTasks={tasks} brands={brands} activations={activations} />
    </div>
  );
}
