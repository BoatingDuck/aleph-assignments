"use client";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
type Priority = "low" | "medium" | "high";
type TaskStatus = "todo" | "doing" | "done";
type Tab = "plan" | "do" | "see" | "tracking" | "check";
type MetricKey = "plan" | "done" | "delayed" | "blocked" | "estimated" | "actual";
type Plan = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  priority: Priority;
  success_criteria: string;
  estimated_minutes: number;
  improvement_from_previous?: string | null;
  source_plan_id?: string | null;
  created_at: string;
  updated_at: string;
  task_count?: number;
  version_count?: number;
};
type PlanVersion = {
  id: string;
  version_no: number;
  snapshot: Record<string, unknown>;
  created_at: string;
};
type Task = {
  id: string;
  plan_id: string;
  title: string;
  due_date: string | null;
  priority: Priority;
  tags: string[];
  estimated_minutes: number;
  status: TaskStatus;
  completion_cycle: number;
  completed_at: string | null;
  created_at: string;
};
type Execution = {
  id: string;
  task_id: string;
  task_title: string;
  started_at: string;
  ended_at: string;
  actual_minutes: number;
  blocker_reason: string | null;
};
type Reflection = {
  metrics: {
    planCount: number;
    doneCount: number;
    delayedCount: number;
    blockedCount: number;
    estimatedMinutes: number;
    actualMinutes: number;
    differenceMinutes: number;
  };
  todaySeoul: string;
  details: Record<MetricKey, Array<Task | Execution>>;
  reflections: Array<{ id: string; improvement_text: string; carried_to_plan_id: string; created_at: string }>;
};
type SecurityCheck = { id: string; content: string; created_at: string };
type TrackingConfig = {
  id: string;
  question: string;
  metric_name: string;
  metric_unit: string;
  calculation_rule: string;
  plan_rule: string;
  missing_value_rule: string;
  duplicate_value_rule: string;
  outlier_rule: string;
  rounding_rule: string;
  week_starts_on: "monday" | "sunday";
  created_at: string;
  updated_at: string;
};
type RuleChange = {
  id: string;
  old_plan_rule: string;
  new_plan_rule: string;
  reason: string;
  day1_date: string;
  day2_date: string;
  changed_at: string;
};
const emptyPlanForm = {
  title: "",
  startDate: "",
  endDate: "",
  priority: "high" as Priority,
  successCriteria: "",
  estimatedMinutes: "600"
};
const emptyTaskForm = {
  title: "",
  dueDate: "",
  priority: "medium" as Priority,
  tags: "",
  estimatedMinutes: "60"
};
function dateOnly(value?: string | null) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(parsed);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function seoulDateOnly(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function toLocalInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function minutesLabel(value: number) {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  if (!hours) return `${sign}${minutes}분`;
  if (!minutes) return `${sign}${hours}시간`;
  return `${sign}${hours}시간 ${minutes}분`;
}
function kstDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) }
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error || "요청 처리에 실패했습니다.");
  return data;
}
export default function PlannerApp() {
  const [tab, setTab] = useState<Tab>("plan");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [securityChecks, setSecurityChecks] = useState<SecurityCheck[]>([]);
  const [trackingConfig, setTrackingConfig] = useState<TrackingConfig | null>(null);
  const [ruleChange, setRuleChange] = useState<RuleChange | null>(null);
  const [trackingDayCount, setTrackingDayCount] = useState(0);
  const [trackingDayDates, setTrackingDayDates] = useState<string[]>([]);
  const [trackingTotalMinutes, setTrackingTotalMinutes] = useState(0);
  const [trackingAverageMinutes, setTrackingAverageMinutes] = useState(0);
  const [newPlanRule, setNewPlanRule] = useState("");
  const [ruleChangeReason, setRuleChangeReason] = useState("");
  const [savingRuleChange, setSavingRuleChange] = useState(false);
  const [todayRecordDate, setTodayRecordDate] = useState("");
  const [todayActualMinutes, setTodayActualMinutes] = useState(0);
  const [todayRecordConfirmed, setTodayRecordConfirmed] = useState(false);
  const [confirmingTodayRecord, setConfirmingTodayRecord] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [newPlanMode, setNewPlanMode] = useState(true);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [executionForm, setExecutionForm] = useState({ taskId: "", startedAt: toLocalInputValue(), endedAt: toLocalInputValue(), blockerReason: "" });
  const [improvementText, setImprovementText] = useState("");
  const [securityText, setSecurityText] = useState("<script>alert('xss')</script>");
  const [detailMetric, setDetailMetric] = useState<MetricKey>("plan");
  const [filters, setFilters] = useState({ q: "", status: "all", priority: "all", tag: "", sort: "default" });
  const [completing, setCompleting] = useState<Record<string, boolean>>({});
  const [planMenuOpen, setPlanMenuOpen] = useState(false);
  const completeKeys = useRef<Record<string, string>>({});
  const detailRef = useRef<HTMLDivElement>(null);
  const planFormRef = useRef<HTMLFormElement>(null);
  const planMenuRef = useRef<HTMLDivElement>(null);
  const planDetailRequestRef = useRef(0);
  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }, []);
  const showError = useCallback((value: unknown) => {
    setError(value instanceof Error ? value.message : String(value));
    window.setTimeout(() => setError(""), 4500);
  }, []);
  const loadPlans = useCallback(async (preferId?: string) => {
    const data = await api<{ ok: true; plans: Plan[] }>("/api/plans");
    setPlans(data.plans);
    const nextId = preferId || selectedPlanId || data.plans[0]?.id || "";
    setSelectedPlanId(nextId);
    return nextId;
  }, [selectedPlanId]);
  const loadPlanDetail = useCallback(async (planId: string) => {
    const requestId = ++planDetailRequestRef.current;
    if (!planId) {
      setSelectedPlan(null);
      setVersions([]);
      return;
    }
    const data = await api<{ ok: true; plan: Plan; versions: PlanVersion[] }>(`/api/plans/${planId}`);
    if (requestId !== planDetailRequestRef.current) return;
    setSelectedPlan(data.plan);
    setVersions(data.versions);
    if (!newPlanMode) {
      setPlanForm({
        title: data.plan.title,
        startDate: dateOnly(data.plan.start_date),
        endDate: dateOnly(data.plan.end_date),
        priority: data.plan.priority,
        successCriteria: data.plan.success_criteria,
        estimatedMinutes: String(data.plan.estimated_minutes)
      });
    }
  }, [newPlanMode]);
  const loadTasks = useCallback(async (planId = selectedPlanId) => {
    if (!planId) {
      setTasks([]);
      return;
    }
    const params = new URLSearchParams({ planId, ...filters });
    const data = await api<{ ok: true; tasks: Task[] }>(`/api/tasks?${params.toString()}`);
    setTasks(data.tasks);
  }, [filters, selectedPlanId]);
  const loadExecutions = useCallback(async (planId = selectedPlanId) => {
    if (!planId) {
      setExecutions([]);
      return;
    }
    const data = await api<{ ok: true; executions: Execution[] }>(`/api/executions?planId=${encodeURIComponent(planId)}`);
    setExecutions(data.executions);
  }, [selectedPlanId]);
  const loadReflection = useCallback(async (planId = selectedPlanId) => {
    if (!planId) {
      setReflection(null);
      return;
    }
    const data = await api<Reflection & { ok: true }>(`/api/reflection?planId=${encodeURIComponent(planId)}`);
    setReflection(data);
  }, [selectedPlanId]);
  const loadSecurityChecks = useCallback(async () => {
    const data = await api<{ ok: true; checks: SecurityCheck[] }>("/api/security-check");
    setSecurityChecks(data.checks);
  }, []);
  const loadTrackingConfig = useCallback(async () => {
    const data = await api<{
      ok: true;
      config: TrackingConfig | null;
      ruleChange: RuleChange | null;
      dayCount: number;
      dayDates: string[];
      totalMinutes: number;
      averageMinutes: number;
      todayDate: string;
      todayActualMinutes: number;
      todayRecordConfirmed: boolean;
    }>("/api/tracking-config");
    setTrackingConfig(data.config);
    setRuleChange(data.ruleChange);
    setTrackingDayCount(data.dayCount);
    setTrackingDayDates(data.dayDates);
    setTrackingTotalMinutes(data.totalMinutes);
    setTrackingAverageMinutes(data.averageMinutes);
    setTodayRecordDate(data.todayDate);
    setTodayActualMinutes(data.todayActualMinutes);
    setTodayRecordConfirmed(data.todayRecordConfirmed);
    if (data.config && !data.ruleChange) {
      setNewPlanRule(data.config.plan_rule);
    }
  }, []);
  async function confirmTodayRecord() {
    if (todayRecordConfirmed) return;
    setConfirmingTodayRecord(true);
    try {
      const data = await api<{ ok: true; recordDate: string; metricValue: number; alreadyConfirmed: boolean }>(
        "/api/tracking-config",
        { method: "POST", body: JSON.stringify({}) }
      );
      await loadTrackingConfig();
      flash(
        data.alreadyConfirmed
          ? `${data.recordDate} 관찰 기록은 이미 확정되어 있습니다.`
          : `${data.recordDate} 관찰 기록 ${data.metricValue}분을 확정했습니다.`
      );
    } catch (e) {
      showError(e);
    } finally {
      setConfirmingTodayRecord(false);
    }
  }
  async function submitPlanRuleChange(event: FormEvent) {
    event.preventDefault();
    if (!trackingConfig || ruleChange) return;
    const nextRule = newPlanRule.trim();
    const reason = ruleChangeReason.trim();
    if (!nextRule) return showError(new Error("변경할 계획 규칙을 입력하세요."));
    if (!reason) return showError(new Error("변경 이유를 입력하세요."));
    if (nextRule === trackingConfig.plan_rule) {
      return showError(new Error("현재 계획 규칙과 다른 내용으로 입력하세요."));
    }
    setSavingRuleChange(true);
    try {
      await api("/api/tracking-config", {
        method: "PATCH",
        body: JSON.stringify({ newPlanRule: nextRule, reason })
      });
      await loadTrackingConfig();
      setRuleChangeReason("");
      flash("계획 규칙을 한 번 변경하고 변경 이력을 저장했습니다.");
    } catch (e) {
      showError(e);
    } finally {
      setSavingRuleChange(false);
    }
  }
  const refreshPlanData = useCallback(async (planId = selectedPlanId) => {
    if (!planId) return;
    await Promise.all([loadPlanDetail(planId), loadTasks(planId), loadExecutions(planId), loadReflection(planId)]);
    await loadPlans(planId);
  }, [loadExecutions, loadPlanDetail, loadPlans, loadReflection, loadTasks, selectedPlanId]);
  useEffect(() => {
    (async () => {
      try {
        const planId = await loadPlans();
        await Promise.all([loadSecurityChecks(), loadTrackingConfig()]);
        if (planId) {
          await Promise.all([loadPlanDetail(planId), loadExecutions(planId), loadReflection(planId)]);
        }
      } catch (e) {
        showError(e);
      } finally {
        setLoading(false);
      }
    })();
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!selectedPlanId) return;
// eslint-disable-next-line react-hooks/set-state-in-effect
    loadTasks(selectedPlanId).catch(showError);
  }, [filters, selectedPlanId, loadTasks, showError]);
  useEffect(() => {
    if (!selectedPlanId) return;
// eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([loadPlanDetail(selectedPlanId), loadExecutions(selectedPlanId), loadReflection(selectedPlanId)]).catch(showError);
  }, [selectedPlanId, loadExecutions, loadPlanDetail, loadReflection, showError]);
  useEffect(() => {
    if (!selectedPlanId || tasks.length === 0) return;
    if (!executionForm.taskId || !tasks.some((task) => task.id === executionForm.taskId)) {
// eslint-disable-next-line react-hooks/set-state-in-effect
      setExecutionForm((current) => ({ ...current, taskId: tasks[0].id }));
    }
  }, [executionForm.taskId, selectedPlanId, tasks]);
  useEffect(() => {
    if (!planMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (planMenuRef.current && !planMenuRef.current.contains(event.target as Node)) {
        setPlanMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlanMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [planMenuOpen]);
  const allTags = useMemo(() => [...new Set(tasks.flatMap((task) => task.tags || []))].sort(), [tasks]);
  const sortRuleText = useMemo(() => {
    if (filters.sort === "priority") return "우선순위 높은 순 → 생성순 → ID순";
    if (filters.sort === "estimated") return "예상 시간 큰 순 → 생성순 → ID순";
    if (filters.sort === "created") return "생성순 → ID순";
    return "마감일 빠른 순 → 우선순위 높은 순 → 생성순 → ID순";
  }, [filters.sort]);
  function makeT06Draft() {
    const startDate = seoulDateOnly();
    const end = new Date(`${startDate}T00:00:00+09:00`);
    end.setDate(end.getDate() + 1);
    setNewPlanMode(true);
    setPlanForm({
      title: "ALEPH T06 Plan-Do-See 다이어리 완성",
      startDate,
      endDate: seoulDateOnly(end),
      priority: "high",
      successCriteria: "T06 완주 체크리스트를 모두 검증하고 공개 결과물·소스·제출문까지 완성한다.",
      estimatedMinutes: "600"
    });
    flash("T06 실제 계획 초안이 입력되었습니다. 기간을 확인한 후 저장해 주세요.");
  }
  function startNewPlan() {
    setTab("plan");
    setNewPlanMode(true);
    setPlanForm(emptyPlanForm);
    flash("새 계획 입력란을 열었습니다.");
    window.setTimeout(() => planFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }
  function editCurrentPlan() {
    if (!selectedPlan) return;
    setNewPlanMode(false);
    setPlanForm({
      title: selectedPlan.title,
      startDate: dateOnly(selectedPlan.start_date),
      endDate: dateOnly(selectedPlan.end_date),
      priority: selectedPlan.priority,
      successCriteria: selectedPlan.success_criteria,
      estimatedMinutes: String(selectedPlan.estimated_minutes)
    });
    setTab("plan");
  }
  async function submitPlan(event: FormEvent) {
    event.preventDefault();
    try {
      if (newPlanMode) {
        const data = await api<{ ok: true; plan: Plan }>("/api/plans", { method: "POST", body: JSON.stringify(planForm) });
        setSelectedPlanId(data.plan.id);
        setNewPlanMode(false);
        await loadPlans(data.plan.id);
        await loadPlanDetail(data.plan.id);
        flash("계획이 저장되었습니다.");
      } else if (selectedPlanId) {
        await api(`/api/plans/${selectedPlanId}`, { method: "PATCH", body: JSON.stringify(planForm) });
        await refreshPlanData(selectedPlanId);
        flash("계획이 수정되었습니다. 수정 전 내용은 이력에 보관되었습니다.");
      }
    } catch (e) {
      showError(e);
    }
  }
  async function deleteCurrentPlan() {
    if (!selectedPlanId || !selectedPlan) return;
    const confirmed = window.confirm(
      `“${selectedPlan.title}” 계획을 영구 삭제하시겠습니까?\n\n` +
      "이 계획의 할 일, 완료 기록, 실행 기록, 수정 이력, 돌아보기 기록도 함께 삭제됩니다.\n" +
      "이 작업은 되돌릴 수 없습니다."
    );
    if (!confirmed) return;
    try {
      await api(`/api/plans/${selectedPlanId}`, { method: "DELETE" });
      // 삭제된 계획을 읽던 요청이 뒤늦게 도착해 화면을 되돌리지 못하게 막습니다.
      planDetailRequestRef.current += 1;
      setSelectedPlan(null);
      setVersions([]);
      setTasks([]);
      setExecutions([]);
      setReflection(null);
      setEditingTaskId(null);
      setTaskForm(emptyTaskForm);
      const data = await api<{ ok: true; plans: Plan[] }>("/api/plans");
      setPlans(data.plans);
      const nextId = data.plans[0]?.id || "";
      setSelectedPlanId(nextId);
      if (nextId) {
        setNewPlanMode(false);
        await Promise.all([
          loadPlanDetail(nextId),
          loadTasks(nextId),
          loadExecutions(nextId),
          loadReflection(nextId)
        ]);
      } else {
        setNewPlanMode(true);
        setPlanForm(emptyPlanForm);
      }
      flash("계획과 연결된 기록을 모두 삭제했습니다.");
    } catch (e) {
      showError(e);
    }
  }
  async function addT06Tasks() {
    if (!selectedPlanId || !selectedPlan) return;
    if ((reflection?.metrics.planCount ?? 0) > 0 && !window.confirm("이미 할 일이 있습니다. T06 기본 할 일 6개를 추가로 넣을까요?")) return;
    const dueDate = dateOnly(selectedPlan.end_date);
    const presets = [
      ["DB 구조와 서버 연결 완성", "DB,백엔드", 60, "high"],
      ["계획 저장과 수정 이력 기능 완성", "Plan,기능", 120, "high"],
      ["할 일 CRUD·검색·필터·정렬 완성", "Do,기능", 150, "high"],
      ["실행 기록과 중복 완료 방지 완성", "Do,DB", 120, "high"],
      ["돌아보기 집계와 근거 이동 완성", "See,집계", 90, "medium"],
      ["보안 점검·내보내기·배포·제출 검수", "검수,배포", 60, "high"]
    ] as const;
    try {
      for (const [title, tags, estimatedMinutes, priority] of presets) {
        await api("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ planId: selectedPlanId, title, dueDate, priority, tags: tags.split(","), estimatedMinutes })
        });
      }
      await refreshPlanData();
      flash("T06 실제 진행용 할 일 6개가 추가되었습니다. 필요한 항목은 수정할 수 있습니다.");
    } catch (e) {
      showError(e);
    }
  }
  async function submitTask(event: FormEvent) {
    event.preventDefault();
    if (!selectedPlanId) return showError(new Error("먼저 계획을 하나 저장하세요."));
    try {
      const payload = { ...taskForm, planId: selectedPlanId, tags: taskForm.tags.split(",") };
      if (editingTaskId) {
        await api(`/api/tasks/${editingTaskId}`, { method: "PATCH", body: JSON.stringify(payload) });
        flash("할 일이 수정되었습니다.");
      } else {
        await api("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
        flash("할 일이 추가되었습니다.");
      }
      setTaskForm(emptyTaskForm);
      setEditingTaskId(null);
      await refreshPlanData();
    } catch (e) {
      showError(e);
    }
  }
  function editTask(task: Task) {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      dueDate: dateOnly(task.due_date),
      priority: task.priority,
      tags: (task.tags || []).join(", "),
      estimatedMinutes: String(task.estimated_minutes)
    });
    document.getElementById("task-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  async function completeTask(task: Task) {
    const key = completeKeys.current[task.id] || crypto.randomUUID();
    completeKeys.current[task.id] = key;
    setCompleting((current) => ({ ...current, [task.id]: true }));
    try {
      const data = await api<{ ok: true; deduplicated: boolean }>(`/api/tasks/${task.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key })
      });
      await refreshPlanData();
      flash(data.deduplicated ? "중복 완료 요청이 감지되어 기존 기록을 유지했습니다." : "완료 처리되었습니다.");
    } catch (e) {
      showError(e);
    } finally {
      delete completeKeys.current[task.id];
      setCompleting((current) => ({ ...current, [task.id]: false }));
    }
  }
  async function reopenTask(task: Task) {
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: "doing" }) });
      await refreshPlanData();
      flash("완료한 할 일을 다시 진행 중으로 돌렸어요.");
    } catch (e) {
      showError(e);
    }
  }
  async function deleteTask(task: Task) {
    if (!window.confirm(`“${task.title}”을 지울까요? 화면에서는 사라지고 DB에는 삭제 시각이 남습니다.`)) return;
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      await refreshPlanData();
      flash("할 일을 지웠어요.");
    } catch (e) {
      showError(e);
    }
  }
  async function submitExecution(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/executions", {
        method: "POST",
        body: JSON.stringify({
          ...executionForm,
          startedAt: new Date(executionForm.startedAt).toISOString(),
          endedAt: new Date(executionForm.endedAt).toISOString()
        })
      });
      setExecutionForm((current) => ({ ...current, startedAt: toLocalInputValue(), endedAt: toLocalInputValue(), blockerReason: "" }));
      await refreshPlanData();
      flash("실행 기록이 저장되었습니다. 원래 계획 값은 그대로 유지됩니다.");
    } catch (e) {
      showError(e);
    }
  }
  function openMetric(metric: MetricKey) {
    setDetailMetric(metric);
    window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
  }
  async function carryImprovement(event: FormEvent) {
    event.preventDefault();
    if (!selectedPlanId) return;
    try {
      const data = await api<{ ok: true; nextPlan: Plan }>("/api/reflection/carry", {
        method: "POST",
        body: JSON.stringify({ planId: selectedPlanId, improvementText })
      });
      setImprovementText("");
      setNewPlanMode(false);
      // 이전 계획을 읽던 느린 응답이 새 계획 화면을 덮어쓰지 못하게 무효화합니다.
      planDetailRequestRef.current += 1;
      await loadPlans(data.nextPlan.id);
      setSelectedPlanId(data.nextPlan.id);
      setSelectedPlan(data.nextPlan);
      setVersions([]);
      setPlanForm({
        title: data.nextPlan.title,
        startDate: dateOnly(data.nextPlan.start_date),
        endDate: dateOnly(data.nextPlan.end_date),
        priority: data.nextPlan.priority,
        successCriteria: data.nextPlan.success_criteria,
        estimatedMinutes: String(data.nextPlan.estimated_minutes)
      });
      setTab("plan");
      flash("고칠 점을 담은 다음 계획을 만들고 계획 화면으로 이동했습니다.");
      window.setTimeout(() => planFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) {
      showError(e);
    }
  }
  async function saveSecurityCheck(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/security-check", { method: "POST", body: JSON.stringify({ content: securityText }) });
      await loadSecurityChecks();
      flash("문자열이 DB에 저장되었습니다. 아래에서 실행되지 않고 글자 그대로 표시되는지 확인해 주세요.");
    } catch (e) {
      showError(e);
    }
  }
  const metricDetails = reflection?.details?.[detailMetric] ?? [];
  const selectedTask = tasks.find((task) => task.id === executionForm.taskId);
  if (loading) {
    return <main className="loading-screen"><div className="acorn-loader">●</div><p>계획의 결을 펼치는 중…</p></main>;
  }
  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-main">
          <div className="hero-title-row">
            <div className="hero-copy">
              <p className="eyebrow hero-eyebrow">PLAN · DO · SEE</p>
              <h1>Plan-Do-See Diary</h1>
              <p className="hero-description">계획 · 실행 · 돌아보기를 한 흐름으로 기록합니다.</p>
              <p className="public-note">로그인한 계정의 기록만 볼 수 있습니다.</p>
            </div>
            <div className="hero-card">
              <span className="hero-card-label">현재 흐름</span>
              <div className="flow-row"><b>Plan</b><i>→</i><b>Do</b><i>→</i><b>See</b></div>
              <p>{selectedPlan ? selectedPlan.title : "첫 계획을 만들어 시작해 주세요."}</p>
              {reflection && <div className="mini-progress"><span style={{ width: `${reflection.metrics.planCount ? Math.round(reflection.metrics.doneCount / reflection.metrics.planCount * 100) : 0}%` }} /></div>}
            </div>
          </div>
        </div>
      </header>
      {(notice || error) && <div className={`toast ${error ? "toast-error" : ""}`}>{error || notice}</div>}
      <section className="workspace">
        <aside className="sidebar">
          <div className="brand-mark"><span>pds</span><small>diary</small></div>
          <nav>
            {([[
              "plan", "01", "계획 세우기"
            ], ["do", "02", "실제로 하기"], ["see", "03", "돌아보기"], ["tracking", "04", "관찰 설정"], ["check", "05", "최종 점검"]] as [Tab, string, string][]).map(([key, number, label]) => (
              <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><span>{number}</span>{label}</button>
            ))}
          </nav>
          <div className="plan-picker">
            <label>보고 있는 계획</label>
            <div ref={planMenuRef} className={`plan-select ${planMenuOpen ? "open" : ""}`}>
              <button
                type="button"
                className="plan-select-trigger"
                aria-haspopup="listbox"
                aria-expanded={planMenuOpen}
                onClick={() => setPlanMenuOpen((open) => !open)}
              >
                <span>{plans.find((plan) => plan.id === selectedPlanId)?.title || "계획 없음"}</span>
                <i aria-hidden="true">⌄</i>
              </button>
              {planMenuOpen && (
                <div className="plan-select-menu" role="listbox" aria-label="보고 있는 계획 선택">
                  <button
                    type="button"
                    role="option"
                    aria-selected={!selectedPlanId}
                    className={!selectedPlanId ? "selected" : ""}
                    onClick={() => {
                      setSelectedPlanId("");
                      setNewPlanMode(true);
                      setPlanMenuOpen(false);
                    }}
                  >
                    계획 없음
                  </button>
                  {plans.map((plan) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedPlanId === plan.id}
                      className={selectedPlanId === plan.id ? "selected" : ""}
                      key={plan.id}
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setNewPlanMode(false);
                        setPlanMenuOpen(false);
                      }}
                    >
                      {plan.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="link-button" onClick={startNewPlan}>＋ 새 계획</button>
          </div>
          <a className="export-button" href="/api/export">전체 자료 JSON 내보내기 ↗</a>
        </aside>
        <div className="content">
          {tab === "plan" && (
            <section className="section-stack">
              <div className="section-heading"><div><p className="eyebrow">CARD 1</p><h2>계획 세우기</h2><p>수정해도 처음 계획이 사라지지 않게, 이전 값을 별도의 버전으로 남깁니다.</p></div><button className="ghost-button" onClick={makeT06Draft}>T06 계획 초안 채우기</button></div>
              {selectedPlan && !newPlanMode && <div className="current-plan-banner"><div><span>현재 계획</span><strong>{selectedPlan.title}</strong></div><button onClick={editCurrentPlan}>현재 계획 수정</button></div>}
              {selectedPlan?.improvement_from_previous && !newPlanMode && (
                <div className="carried-note carried-note-plan">
                  <b>이전 돌아보기에서 넘어온 고칠 점</b>
                  <p>{selectedPlan.improvement_from_previous}</p>
                </div>
              )}
              <form ref={planFormRef} className="panel compact-form plan-form" onSubmit={submitPlan}>
                <div className="panel-title"><h3>{newPlanMode ? "새 계획" : "현재 계획 수정"}</h3><span>{newPlanMode ? "저장 후 Plan → Do → See가 시작됩니다." : "저장 직전에 기존 값이 수정 이력으로 복사됩니다."}</span></div>
                <div className="plan-form-layout">
                  <div className="plan-form-left">
                    <label>계획 이름<input value={planForm.title} onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })} required /></label>
                    <div className="inline-fields date-fields">
                      <label>시작일<input type="date" value={planForm.startDate} onChange={(e) => setPlanForm({ ...planForm, startDate: e.target.value })} required /></label>
                      <label>종료일<input type="date" value={planForm.endDate} onChange={(e) => setPlanForm({ ...planForm, endDate: e.target.value })} required /></label>
                    </div>
                    <div className="inline-fields meta-fields">
                      <label>우선순위<select value={planForm.priority} onChange={(e) => setPlanForm({ ...planForm, priority: e.target.value as Priority })}><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option></select></label>
                      <label>예상 시간(분)<input type="number" min="0" value={planForm.estimatedMinutes} onChange={(e) => setPlanForm({ ...planForm, estimatedMinutes: e.target.value })} required /></label>
                    </div>
                  </div>
                  <label className="success-criteria-field">성공 기준<textarea value={planForm.successCriteria} onChange={(e) => setPlanForm({ ...planForm, successCriteria: e.target.value })} required /></label>
                </div>
                <div className="form-actions form-actions-bottom">
                  {!newPlanMode && <button className="danger-button" type="button" onClick={deleteCurrentPlan}>계획 삭제</button>}
                  <button className="primary-button" type="submit">{newPlanMode ? "계획 저장" : "수정 저장 + 이전 계획 보관"}</button>
                </div>
              </form>
              <div className="panel">
                <div className="panel-title"><h3>수정 이력</h3><span>{versions.length}개의 이전 계획이 보관되어 있습니다.</span></div>
                {versions.length === 0 ? <p className="empty">아직 수정 전 이력이 없습니다. 현재 계획을 한 번 수정하면 여기에 이전 값이 남습니다.</p> :
                  <div className="history-list">{versions.map((version) => <article key={version.id}><div><b>v{version.version_no} · 수정 전 보관본</b><span>{kstDateTime(version.created_at)}</span></div><strong>{String(version.snapshot.title ?? "")}</strong><p>{String(version.snapshot.success_criteria ?? "")}</p><small>{String(version.snapshot.start_date ?? "").slice(0, 10)} ~ {String(version.snapshot.end_date ?? "").slice(0, 10)} · {minutesLabel(Number(version.snapshot.estimated_minutes ?? 0))}</small></article>)}</div>}
              </div>
            </section>
          )}
          {tab === "do" && (
            <section className="section-stack">
              <div className="section-heading"><div><p className="eyebrow">CARD 2 · CARD 3</p><h2>할 일과 실제 기록</h2><p>계획에 딸린 할 일을 다루고, 실제 시작·종료·막힌 이유는 별도 실행 기록으로 남깁니다.</p></div><button className="ghost-button" onClick={addT06Tasks}>T06 실제 할 일 6개 채우기</button></div>
              <form id="task-form" className="panel compact-form task-form" onSubmit={submitTask}>
                <div className="panel-title"><h3>{editingTaskId ? "할 일 수정" : "할 일 추가"}</h3><span>마감일 · 우선순위 · 태그 · 예상 시간을 함께 저장합니다.</span></div>
                <div className="task-form-layout">
                  <div className="task-form-left">
                    <label className="task-title-field">할 일<textarea rows={2} value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required /></label>
                    <label className="task-date-field">마감일<input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></label>
                  </div>
                  <div className="task-form-right">
                    <label>우선순위<select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as Priority })}><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option></select></label>
                    <label>예상 시간(분)<input type="number" min="0" value={taskForm.estimatedMinutes} onChange={(e) => setTaskForm({ ...taskForm, estimatedMinutes: e.target.value })} /></label>
                    <label>태그<input placeholder="DB, UI, 검수" value={taskForm.tags} onChange={(e) => setTaskForm({ ...taskForm, tags: e.target.value })} /></label>
                  </div>
                </div>
                <div className="form-actions form-actions-bottom"><button className="primary-button" type="submit">{editingTaskId ? "수정 저장" : "할 일 만들기"}</button>{editingTaskId && <button type="button" className="ghost-button" onClick={() => { setEditingTaskId(null); setTaskForm(emptyTaskForm); }}>수정 취소</button>}</div>
              </form>
              <div className="panel">
                <div className="panel-title"><h3>찾기 · 거르기 · 정렬</h3><span>현재 정렬 기준: {sortRuleText}</span></div>
                <div className="filter-grid">
                  <input placeholder="할 일 또는 태그 검색" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
                  <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="all">모든 상태</option><option value="todo">할 일</option><option value="doing">진행 중</option><option value="done">완료</option></select>
                  <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}><option value="all">모든 우선순위</option><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option></select>
                  <select value={filters.tag} onChange={(e) => setFilters({ ...filters, tag: e.target.value })}><option value="">모든 태그</option>{allTags.map((tag) => <option key={tag}>{tag}</option>)}</select>
                  <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="default">기본 정렬</option><option value="priority">우선순위순</option><option value="estimated">예상 시간 큰 순</option><option value="created">생성순</option></select>
                </div>
              </div>
              <div className="task-list">
                {tasks.length === 0 ? <div className="panel empty">조건에 맞는 할 일이 없습니다.</div> : tasks.map((task) => (
                  <article className={`task-card status-${task.status}`} key={task.id}>
                    <div className="task-status-dot" />
                    <div className="task-main">
                      <div className="task-top"><div><span className={`priority priority-${task.priority}`}>{task.priority === "high" ? "높음" : task.priority === "medium" ? "보통" : "낮음"}</span><strong>{task.title}</strong></div></div>
                      <div className="task-meta"><span>마감 {task.due_date ? dateOnly(task.due_date) : "없음"}</span><span>예상 {minutesLabel(task.estimated_minutes)}</span>{task.tags.map((tag) => <em key={tag}>#{tag}</em>)}</div>
                    </div>
                    <div className="task-actions"><span className={`status-pill status-pill-${task.status}`}>{task.status === "done" ? "완료" : task.status === "doing" ? "진행 중" : "할 일"}</span><button onClick={() => editTask(task)}>수정</button>{task.status === "done" ? <button onClick={() => reopenTask(task)}>진행 중으로</button> : <button disabled={completing[task.id]} onClick={() => completeTask(task)}>{completing[task.id] ? "처리 중" : "완료"}</button>}<button className="danger" onClick={() => deleteTask(task)}>삭제</button></div>
                  </article>
                ))}
              </div>
              <form className="panel form-grid compact-form execution-panel" onSubmit={submitExecution}>
                <div className="panel-title"><h3>실제로 한 일 기록</h3><span>이 기록은 계획/예상 시간을 덮어쓰지 않습니다.</span></div>
                <label className="wide">연결할 할 일<select value={executionForm.taskId} onChange={(e) => setExecutionForm({ ...executionForm, taskId: e.target.value })} required><option value="">선택</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
                <label>시작 시각<input type="datetime-local" value={executionForm.startedAt} onChange={(e) => setExecutionForm({ ...executionForm, startedAt: e.target.value })} required /></label>
                <label>끝난 시각<input type="datetime-local" value={executionForm.endedAt} onChange={(e) => setExecutionForm({ ...executionForm, endedAt: e.target.value })} required /></label>
                <label className="wide">막혔던 이유<textarea placeholder="없었다면 비워 두어도 됩니다." value={executionForm.blockerReason} onChange={(e) => setExecutionForm({ ...executionForm, blockerReason: e.target.value })} /></label>
                <div className="wide form-actions form-actions-bottom"><button className="primary-button" disabled={!selectedTask} type="submit">실행 기록 저장</button></div>
              </form>
              <div className="panel">
                <div className="panel-title"><h3>실행 기록</h3><span>{executions.length}건 · 실제 시간은 서버에서 시작/종료 차이로 계산합니다.</span></div>
                {executions.length === 0 ? <p className="empty">아직 실제로 한 일 기록이 없습니다. 제출 전 실제 기록 3건 이상을 직접 남기세요.</p> : <div className="execution-list">{executions.map((item) => <article key={item.id}><div><strong>{item.task_title}</strong><b>{minutesLabel(item.actual_minutes)}</b></div><p>{kstDateTime(item.started_at)} → {kstDateTime(item.ended_at)}</p>{item.blocker_reason && <blockquote>막힘 · {item.blocker_reason}</blockquote>}</article>)}</div>}
              </div>
            </section>
          )}
          {tab === "see" && (
            <section className="section-stack">
              <div className="section-heading"><div><p className="eyebrow">CARD 4</p><h2>돌아보기</h2><p>숫자를 누르면 그 숫자를 만든 실제 기록까지 따라갑니다.</p></div><span className="date-chip">서울 기준 오늘 {reflection?.todaySeoul ?? "-"}</span></div>
              <div className="metrics-grid">
                <button onClick={() => openMetric("plan")}><span>계획 수</span><strong>{reflection?.metrics.planCount ?? 0}</strong><small>지우지 않은 할 일</small></button>
                <button onClick={() => openMetric("done")}><span>완료 수</span><strong>{reflection?.metrics.doneCount ?? 0}</strong><small>현재 완료 상태</small></button>
                <button onClick={() => openMetric("delayed")}><span>지연 수</span><strong>{reflection?.metrics.delayedCount ?? 0}</strong><small>미완료 + 지난 마감</small></button>
                <button onClick={() => openMetric("blocked")}><span>막힘 수</span><strong>{reflection?.metrics.blockedCount ?? 0}</strong><small>막힌 이유가 있는 할 일</small></button>
                <button onClick={() => openMetric("estimated")}><span>예상 시간</span><strong>{minutesLabel(reflection?.metrics.estimatedMinutes ?? 0)}</strong><small>대상 할 일 합계</small></button>
                <button onClick={() => openMetric("actual")}><span>실제 시간</span><strong>{minutesLabel(reflection?.metrics.actualMinutes ?? 0)}</strong><small>실행 기록 합계</small></button>
              </div>
              <div className="difference-card"><div><span>실제 − 예상</span><strong>{minutesLabel(reflection?.metrics.differenceMinutes ?? 0)}</strong></div><p>{(reflection?.metrics.differenceMinutes ?? 0) > 0 ? "예상보다 더 걸렸습니다. 어디에서 시간이 늘었는지 아래 기록에서 확인하세요." : (reflection?.metrics.differenceMinutes ?? 0) < 0 ? "예상보다 빠르게 끝났습니다. 다음 계획의 예상 시간을 조정할 근거가 됩니다." : "예상과 실제가 같습니다."}</p></div>
              <div className="panel evidence-panel" ref={detailRef}>
                <div className="panel-title"><h3>집계 근거 · {detailMetric}</h3><span>위 숫자를 누를 때마다 해당 기록으로 바뀝니다.</span></div>
                {metricDetails.length === 0 ? <p className="empty">이 숫자를 만든 기록이 없습니다.</p> : <div className="evidence-list">{metricDetails.map((item) => "task_title" in item ? <article key={item.id}><strong>{item.task_title}</strong><span>{minutesLabel(item.actual_minutes)}</span><small>{kstDateTime(item.started_at)} → {kstDateTime(item.ended_at)}</small>{item.blocker_reason && <p>막힘 · {item.blocker_reason}</p>}</article> : <article key={item.id}><strong>{item.title}</strong><span>{item.status === "done" ? "완료" : item.status === "doing" ? "진행 중" : "할 일"}</span><small>마감 {item.due_date ? dateOnly(item.due_date) : "없음"} · 예상 {minutesLabel(item.estimated_minutes)}</small></article>)}</div>}
              </div>
              <form className="panel carry-panel" onSubmit={carryImprovement}>
                <div className="panel-title"><h3>고칠 점을 다음 계획으로</h3><span>한 줄을 저장하면 그 문장을 품은 새 계획이 실제 DB에 만들어집니다.</span></div>
                <textarea placeholder="예: DB 설정 시간을 너무 짧게 잡았다. 다음에는 배포 전 검증 시간을 60분 따로 둔다." value={improvementText} onChange={(e) => setImprovementText(e.target.value)} required />
                <div className="form-actions form-actions-bottom"><button className="primary-button" type="submit">이 한 줄로 다음 계획 만들기 →</button></div>
                {selectedPlan?.improvement_from_previous && <div className="carried-note"><b>이 계획으로 넘어온 이전의 고칠 점</b><p>{selectedPlan.improvement_from_previous}</p></div>}
              </form>
            </section>
          )}
          {tab === "tracking" && (
            <section className="section-stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">CARD 4</p>
                  <h2>5일 관찰 설정</h2>
                  <p>Day 1부터 적용한 질문·지표·계산 규칙을 계정에 연결된 DB 설정에서 그대로 읽어 보여 줍니다.</p>
                </div>
                {trackingConfig && <span className="date-chip">설정일 {kstDateTime(trackingConfig.created_at)}</span>}
              </div>
              {!trackingConfig ? (
                <div className="panel empty">아직 이 계정에 저장된 5일 관찰 설정이 없습니다.</div>
              ) : (
                <>
                  <div className="tracking-summary-grid">
                    <article><span>관찰 질문</span><strong>{trackingConfig.question}</strong></article>
                    <article><span>측정 지표</span><strong>{trackingConfig.metric_name}</strong></article>
                    <article><span>측정 단위</span><strong>{trackingConfig.metric_unit}</strong></article>
                    <article><span>주 시작 요일</span><strong>{trackingConfig.week_starts_on === "monday" ? "월요일" : "일요일"}</strong></article>
                  </div>
                  <div className="panel today-observation-panel">
                    <div className="panel-title">
                      <h3>오늘 관찰 기록</h3>
                      <span>Asia/Seoul 기준 오늘의 실행 기록을 합산해 일별 관찰값으로 확정합니다.</span>
                    </div>
                    <div className="today-observation-summary">
                      <div>
                        <span>관찰 날짜</span>
                        <strong>{todayRecordDate || "-"}</strong>
                      </div>
                      <div>
                        <span>오늘 실행 기록 합계</span>
                        <strong>{minutesLabel(todayActualMinutes)}</strong>
                      </div>
                    </div>
                    <div className="form-actions form-actions-bottom">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={confirmTodayRecord}
                        disabled={todayRecordConfirmed || confirmingTodayRecord}
                      >
                        {todayRecordConfirmed ? "오늘 기록 확정 완료" : confirmingTodayRecord ? "확정 중…" : "오늘 기록 확정"}
                      </button>
                    </div>
                    <p className="tracking-help">
                      {todayRecordConfirmed
                        ? "오늘 날짜의 관찰값이 저장되었습니다. 같은 날짜로는 중복 기록을 만들지 않습니다."
                        : "버튼을 누르면 현재까지 저장된 오늘 실행 기록의 actual_minutes 합계를 관찰값으로 저장합니다."}
                    </p>
                  </div>
                  {trackingDayCount === 5 && (
                    <div className="panel">
                      <div className="panel-title">
                        <h3>5일 관찰 결과</h3>
                        <span>확정한 5일 기록을 같은 계산 규칙으로 집계합니다.</span>
                      </div>
                  
                      <div className="tracking-summary-grid">
                        <article>
                          <span>5일 합계</span>
                          <strong>{trackingTotalMinutes}분</strong>
                        </article>
                  
                        <article>
                          <span>5일 평균</span>
                          <strong>{trackingAverageMinutes.toFixed(1)}분</strong>
                        </article>
                      </div>
                    </div>
                  )}
                  <div className="panel tracking-rules-panel">
                    <div className="panel-title">
                      <h3>고정 계산 규칙</h3>
                      <span>5일 동안 같은 질문·지표·단위·계산 기준을 유지합니다.</span>
                    </div>
                    <dl className="tracking-rule-list">
                      <div><dt>집계·계산 규칙</dt><dd>{trackingConfig.calculation_rule}</dd></div>
                      <div><dt>결측값</dt><dd>{trackingConfig.missing_value_rule}</dd></div>
                      <div><dt>중복값</dt><dd>{trackingConfig.duplicate_value_rule}</dd></div>
                      <div><dt>이상치</dt><dd>{trackingConfig.outlier_rule}</dd></div>
                      <div><dt>반올림</dt><dd>{trackingConfig.rounding_rule}</dd></div>
                    </dl>
                  </div>
                  <div className="panel plan-rule-panel">
                    <div className="panel-title">
                      <h3>계획 규칙</h3>
                      <span>Day 1~2에는 처음 규칙을 사용하고, Day 2 기록 후 Day 3 기록 전에 딱 한 번 변경합니다.</span>
                    </div>
                    <div className="current-rule-box">
                      <span>현재 계획 규칙</span>
                      <strong>{trackingConfig.plan_rule}</strong>
                    </div>
                    {!ruleChange ? (
                      <>
                        <div className="tracking-day-status">
                          <span>기록된 관찰 날짜</span>
                          <strong>{trackingDayCount}일</strong>
                          <small>
                            {trackingDayDates.length > 0
                              ? trackingDayDates.map((date) => dateOnly(date)).join(" · ")
                              : "아직 저장된 날짜가 없습니다."}
                          </small>
                        </div>
                        {trackingDayCount === 2 ? (
                          <form className="plan-rule-change-form" onSubmit={submitPlanRuleChange}>
                            <label>
                              변경할 계획 규칙
                              <textarea
                                rows={2}
                                value={newPlanRule}
                                onChange={(e) => setNewPlanRule(e.target.value)}
                                required
                              />
                            </label>
                            <label>
                              변경 이유
                              <textarea
                                rows={3}
                                placeholder="Day 1과 Day 2 결과를 보고 왜 이 규칙으로 바꾸는지 적습니다."
                                value={ruleChangeReason}
                                onChange={(e) => setRuleChangeReason(e.target.value)}
                                required
                              />
                            </label>
                            <div className="form-actions form-actions-bottom">
                              <button className="primary-button" type="submit" disabled={savingRuleChange}>
                                {savingRuleChange ? "저장 중…" : "계획 규칙 1회 변경"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <p className="empty">
                            {trackingDayCount < 2
                              ? "Day 2 기록까지 완료되면 계획 규칙 변경 입력란이 열립니다."
                              : "Day 3 기록이 이미 존재하므로 계획 규칙을 변경할 수 없습니다."}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="rule-change-content">
                        <div><span>변경 전</span><p>{ruleChange.old_plan_rule}</p></div>
                        <div><span>변경 후</span><p>{ruleChange.new_plan_rule}</p></div>
                        <div><span>변경 이유</span><p>{ruleChange.reason}</p></div>
                        <div className="rule-change-meta">
                          <span>참조 날짜 {dateOnly(ruleChange.day1_date)} · {dateOnly(ruleChange.day2_date)}</span>
                          <span>변경 시각 {kstDateTime(ruleChange.changed_at)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
          {tab === "check" && (
            <section className="section-stack">
              <div className="section-heading"><div><p className="eyebrow">CARD 5</p><h2>잃지 않게, 새지 않게</h2><p>실제 DB 저장·새로고침·내보내기·문자열 안전 표시·비밀값 분리를 마지막으로 확인합니다.</p></div></div>
              <div className="check-grid">
                <article><span>01</span><strong>서버 DB</strong><p>계획·할 일·실행 기록·돌아보기 근거가 PostgreSQL에 저장됩니다.</p></article>
                <article><span>02</span><strong>새로고침</strong><p>ID·날짜·값·분 단위는 DB에서 다시 읽어 복원합니다.</p></article>
                <article><span>03</span><strong>내보내기</strong><p>왼쪽의 JSON 내보내기로 전체 자료를 파일 하나로 받습니다.</p></article>
                <article><span>04</span><strong>비밀값</strong><p>DATABASE_URL은 서버 전용 환경변수이며 API 응답에 포함하지 않습니다.</p></article>
              </div>
              <form className="panel security-panel" onSubmit={saveSecurityCheck}>
                <div className="panel-title"><h3>스크립트 모양 글자 안전 표시</h3><span>DB에 저장한 뒤 React의 일반 텍스트 렌더링으로만 보여 줍니다.</span></div>
                <label>테스트 문자열<textarea value={securityText} onChange={(e) => setSecurityText(e.target.value)} /></label>
                <div className="form-actions form-actions-bottom"><button className="primary-button" type="submit">DB에 저장해 확인</button></div>
                <div className="code-results">{securityChecks.map((check) => <code key={check.id}>{check.content}</code>)}</div>
              </form>
              <div className="panel checklist-panel">
                <div className="panel-title"><h3>제출 전 실데이터 체크</h3><span>코드가 아닌 실제 자료를 기준으로 마지막에 확인할 항목입니다.</span></div>
                <ul>
                  <li className={plans.length >= 1 ? "done" : ""}>실제 계획 1개 이상 <b>{plans.length}개</b></li>
                  <li className={(reflection?.metrics.planCount ?? 0) >= 5 ? "done" : ""}>선택 계획의 할 일 5개 이상 <b>{reflection?.metrics.planCount ?? 0}개</b></li>
                  <li className={executions.length >= 3 ? "done" : ""}>실제로 한 일 기록 3개 이상 <b>{executions.length}개</b></li>
                  <li className={Boolean(reflection && Object.values(reflection.metrics).some((value) => value !== 0)) ? "done" : ""}>돌아보기 집계가 전부 0이 아님</li>
                  <li className={securityChecks.length >= 1 ? "done" : ""}>스크립트 모양 글자 저장·표시 확인</li>
                </ul>
              </div>
              <div className="panel technical-note"><h3>소스에 포함된 검수 장치</h3><p><code>contracts/pds-schema-v2.json</code>에 표·항목·관계·날짜 규칙이 정리되어 있고, <code>npm run security:scan</code>으로 소스/배포 대상 파일의 비밀값 원문 후보를 검사할 수 있습니다.</p><p>Git 기록과 Vercel 환경변수는 배포 직전에 별도로 한 번 확인하세요.</p></div>
            </section>
          )}
        </div>
      </section>
      <footer><span>Plan what matters.</span><span>Do what happened.</span><span>See what changed.</span></footer>
    </main>
  );
}
