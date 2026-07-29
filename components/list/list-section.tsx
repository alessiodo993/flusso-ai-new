"use client";

import { ChevronRight, ListChecks, SearchX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CaptureBar } from "@/components/shared/capture-bar";
import { SelectionBar } from "@/components/shared/selection-bar";
import { ScheduleSheet } from "@/components/list/schedule-sheet";
import { TaskCard } from "@/components/list/task-card";
import {
  NO_FILTERS,
  hasFilters,
  ListToolbar,
  type ListFilters,
  type ListSort,
} from "@/components/list/list-toolbar";
import { StaleSection } from "@/components/list/stale-section";
import { TaskSheet } from "@/components/list/task-sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { safeColor } from "@/lib/colors";
import type { ListFilter } from "@/lib/events";
import { useProjects } from "@/lib/hooks/use-projects";
import { useTaskQuickActions } from "@/lib/hooks/use-task-quick-actions";
import {
  useBulkUpdateTasks,
  useCreateTask,
  useDeleteTasks,
  useRestoreTasks,
  useScheduleTask,
  useTasks,
  useUpdateTask,
} from "@/lib/hooks/use-tasks";
import { undoableToast } from "@/lib/hooks/use-undo";
import { buildListGroups } from "@/lib/list-view";
import { moveTask } from "@/lib/postpone";
import { todayISO } from "@/lib/time";
import type { Energy, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Triage. Qui un pensiero catturato diventa qualcosa di eseguibile: acquista
 * un progetto, una scadenza, una stima, e infine un posto sul calendario.
 */
export function ListSection({
  filter,
  onClearFilter,
}: {
  filter: ListFilter | null;
  onClearFilter: () => void;
}) {
  const today = todayISO();
  const { tasks, isLoading } = useTasks();
  const { active: projects, byId: projectsById } = useProjects();

  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTasks();
  const restore = useRestoreTasks();
  const schedule = useScheduleTask();
  const bulk = useBulkUpdateTasks();

  const [sort, setSort] = useState<ListSort>("progetto");
  const [filters, setFilters] = useState<ListFilters>(NO_FILTERS);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [scheduling, setScheduling] = useState<Task | null>(null);

  // L'header apre la Lista già ristretta ai task in scadenza.
  useEffect(() => {
    if (!filter) return;
    setFilters((current) => ({
      ...current,
      deadlineSoon: filter.deadlineSoon ?? current.deadlineSoon,
      projectId: filter.projectId ?? current.projectId,
    }));
  }, [filter]);

  const actions = useTaskQuickActions({
    onOpen: setOpenTask,
    onSchedule: setScheduling,
  });

  const groups = useMemo(
    () => buildListGroups({ tasks, projects, sort, filters, today }),
    [filters, projects, sort, tasks, today],
  );

  const visibleCount = useMemo(
    () => groups.reduce((total, group) => total + group.tasks.length, 0),
    [groups],
  );

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selected.has(task.id)),
    [selected, tasks],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deleteMany = useCallback(
    (list: Task[]) => {
      if (list.length === 0) return;
      setSelected(new Set());
      remove.mutate({ ids: list.map((task) => task.id) });
      undoableToast({
        message:
          list.length === 1
            ? `«${list[0].title}» eliminato.`
            : `${list.length} task eliminati.`,
        onUndo: () => restore.mutate({ tasks: list }),
      });
    },
    [remove, restore],
  );

  const clearFilters = useCallback(() => {
    setFilters(NO_FILTERS);
    onClearFilter();
  }, [onClearFilter]);

  return (
    <section className="panel overflow-hidden" aria-label="Lista">
      <CaptureBar
        variant="task"
        placeholder="Cosa c'è da fare?"
        onSubmit={(values) =>
          create.mutate({
            title: values.title,
            projectId: values.projectId,
            deadline: values.deadline,
            estMinutes: values.estMinutes,
            energy: values.energy,
          })
        }
      />

      <ListToolbar
        sort={sort}
        onSortChange={setSort}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onSetProject={(projectId) =>
            bulk.mutate({ ids: [...selected], project_id: projectId })
          }
          onSetEnergy={(energy: Energy | null) =>
            bulk.mutate({ ids: [...selected], energy })
          }
          onSchedule={() => setScheduling(selectedTasks[0] ?? null)}
          onDelete={() => deleteMany(selectedTasks)}
        />
      )}

      {visibleCount === 0 && !isLoading && (
        <EmptyState
          Icon={hasFilters(filters) ? SearchX : ListChecks}
          title={
            hasFilters(filters)
              ? "Nessun task con questi filtri"
              : "La lista è vuota"
          }
          description={
            hasFilters(filters)
              ? "Prova ad allargare la ricerca."
              : "Qui arriva quello che hai catturato, pronto per diventare un blocco."
          }
          action={
            hasFilters(filters) ? (
              <button type="button" className="btn btn-soft" onClick={clearFilters}>
                Togli i filtri
              </button>
            ) : undefined
          }
        />
      )}

      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.id);
        const grouped = sort === "progetto";

        return (
          <div key={group.id}>
            {grouped && (
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(group.id)) next.delete(group.id);
                    else next.add(group.id);
                    return next;
                  })
                }
                className="flex w-full items-center gap-2 border-b border-line bg-sunken px-3 py-2 text-left"
              >
                <ChevronRight
                  className={cn(
                    "size-4 shrink-0 text-ink-faint transition-transform duration-150 ease-out",
                    !isCollapsed && "rotate-90",
                  )}
                />
                {group.color && (
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: safeColor(group.color) }}
                  />
                )}
                <span className="truncate text-sm font-medium">{group.label}</span>
                <span className="tnum ml-auto text-xs text-ink-faint">
                  {group.tasks.length}
                </span>
              </button>
            )}

            {!isCollapsed && (
              <ul>
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    today={today}
                    project={
                      task.project_id
                        ? projectsById.get(task.project_id)
                        : undefined
                    }
                    selected={selected.has(task.id)}
                    selectionActive={selected.size > 0}
                    menuItems={actions.menuItems(task)}
                    onOpen={setOpenTask}
                    onRename={(id, title) => update.mutate({ id, title })}
                    onToggleDone={actions.toggleDone}
                    onToggleSelect={toggleSelect}
                    onToggleHighlight={actions.toggleHighlight}
                    onSchedule={setScheduling}
                    onDelete={(one) => deleteMany([one])}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <TaskSheet
        task={openTask}
        open={openTask !== null}
        onOpenChange={(next) => !next && setOpenTask(null)}
        onSchedule={(task) => {
          setOpenTask(null);
          setScheduling(task);
        }}
      />

      <StaleSection />

      <ScheduleSheet
        task={scheduling}
        open={scheduling !== null}
        onOpenChange={(next) => !next && setScheduling(null)}
        onConfirm={(input) => {
          const target = tasks.find((one) => one.id === input.id);
          if (!target) return;
          moveTask({
            task: target,
            day: input.day,
            startMinute: input.startMinute,
            schedule: () => schedule.mutate(input),
          });
        }}
        onBackToList={actions.backToList}
      />
    </section>
  );
}
