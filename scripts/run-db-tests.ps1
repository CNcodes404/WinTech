<#
  Runs every rollback-only database test suite against the linked Supabase project and prints a summary.
  Each suite ends by raising "ALL_<NAME>_PASSED (n checks)", which rolls back every change it made.

  Usage (from the repo root, after `npx supabase login` and `npx supabase link`):
    powershell -ExecutionPolicy Bypass -File scripts/run-db-tests.ps1
    npm run test:db
#>
$ErrorActionPreference = 'Continue'
$suites = 'rls_profiles', 'rls_audit', 'cycles', 'contributions', 'valuations', 'nav', 'fees', 'client_portal'
$failed = 0
$total = 0

foreach ($suite in $suites) {
  $output = (npx supabase db query --remote --yes -f "supabase/tests/$suite.test.sql" 2>&1 | Out-String)
  $pass = [regex]::Match($output, 'ALL_[A-Z_]+_PASSED \((\d+) checks\)')
  if ($pass.Success) {
    $total += [int]$pass.Groups[1].Value
    Write-Host ("PASS  {0,-14} {1} checks" -f $suite, $pass.Groups[1].Value) -ForegroundColor Green
  } else {
    $failed++
    $reason = [regex]::Match($output, '(TEST FAILED[^\\"]*|ERROR:[^\\"]*)').Value
    if (-not $reason) { $reason = 'no pass marker found (connection or login problem?)' }
    Write-Host ("FAIL  {0,-14} {1}" -f $suite, $reason) -ForegroundColor Red
  }
}

Write-Host ''
if ($failed -eq 0) {
  Write-Host "All $($suites.Count) suites passed ($total checks)." -ForegroundColor Green
  exit 0
}
Write-Host "$failed suite(s) failed." -ForegroundColor Red
exit 1
