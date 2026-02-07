let lastProfilingToggleDown = false;
let currentProfiling = false;

export function handleProfilingToggle(profilingTogglePressed: boolean) {
  let profilingEnabled = currentProfiling;

  if (profilingTogglePressed && !lastProfilingToggleDown) {
    profilingEnabled = !currentProfiling;
    currentProfiling = profilingEnabled;
  }

  lastProfilingToggleDown = profilingTogglePressed;

  return profilingEnabled;
}
