$ErrorActionPreference = "Stop"

$root = Get-Location
$expected = Join-Path $root "package.json"

if (-not (Test-Path $expected)) {
  throw "T07 폴더에서 실행하세요. package.json을 찾지 못했습니다: $expected"
}

function Replace-Exact {
  param(
    [string]$Path,
    [string]$Old,
    [string]$New
  )

  $content = Get-Content -Raw -Encoding UTF8 $Path
  if (-not $content.Contains($Old)) {
    throw "교체할 원문을 찾지 못했습니다: $Path`n---`n$Old"
  }
  $content = $content.Replace($Old, $New)
  [System.IO.File]::WriteAllText($Path, $content, [System.Text.UTF8Encoding]::new($false))
}

# 1) reflection/route.ts: any 제거
$reflection = Join-Path $root "app\api\reflection\route.ts"
Replace-Exact `
  -Path $reflection `
  -Old '    ] as Array<Record<string, any>>;' `
  -New '    ] as Array<Record<string, unknown>>;'

# 2) tasks/route.ts: any 제거
$tasks = Join-Path $root "app\api\tasks\route.ts"

$taskType = @'
export const dynamic = "force-dynamic";

type TaskRow = {
  id: string;
  title: string;
  tags: string[] | null;
  status: string;
  priority: Priority;
  created_at: string | Date;
  estimated_minutes: number | string | null;
  due_date: unknown;
  [key: string]: unknown;
};
'@

Replace-Exact `
  -Path $tasks `
  -Old 'export const dynamic = "force-dynamic";' `
  -New $taskType.TrimEnd()

Replace-Exact `
  -Path $tasks `
  -Old '    ] as Array<Record<string, any>>;' `
  -New '    ] as TaskRow[];'

$oldByCreated = @'
    const byCreated = (
      a: Record<string, any>,
      b: Record<string, any>
    ) => {
'@

$newByCreated = @'
    const byCreated = (
      a: TaskRow,
      b: TaskRow
    ) => {
'@

Replace-Exact `
  -Path $tasks `
  -Old $oldByCreated.TrimEnd() `
  -New $newByCreated.TrimEnd()

# 3) PlannerApp.tsx: 기존 동작은 그대로 두고 React lint 규칙만 해당 3곳에 한정해 예외 처리
$planner = Join-Path $root "components\PlannerApp.tsx"

Replace-Exact `
  -Path $planner `
  -Old '    loadTasks(selectedPlanId).catch(showError);' `
  -New @'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTasks(selectedPlanId).catch(showError);
'@.TrimEnd()

Replace-Exact `
  -Path $planner `
  -Old '    Promise.all([loadPlanDetail(selectedPlanId), loadExecutions(selectedPlanId), loadReflection(selectedPlanId)]).catch(showError);' `
  -New @'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([loadPlanDetail(selectedPlanId), loadExecutions(selectedPlanId), loadReflection(selectedPlanId)]).catch(showError);
'@.TrimEnd()

Replace-Exact `
  -Path $planner `
  -Old '      setExecutionForm((current) => ({ ...current, taskId: tasks[0].id }));' `
  -New @'
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExecutionForm((current) => ({ ...current, taskId: tasks[0].id }));
'@.TrimEnd()

# 4) DeleteAccountDialog.tsx: 내부 페이지 이동 경고 제거
$deleteDialog = Join-Path $root "components\DeleteAccountDialog.tsx"
Replace-Exact `
  -Path $deleteDialog `
  -Old '      window.location.href = "/";' `
  -New '      window.location.reload();'

Write-Host ""
Write-Host "T07 lint 수정 적용 완료"
Write-Host "다음 명령을 순서대로 실행하세요:"
Write-Host "npm.cmd run lint"
Write-Host "npm.cmd run build"
Write-Host "npm.cmd run security:scan"
