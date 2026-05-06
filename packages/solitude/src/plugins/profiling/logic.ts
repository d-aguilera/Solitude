export interface ProfilingController {
  updateEnabled: (togglePressed: boolean) => boolean;
  isEnabled: () => boolean;
}

export function createProfilingController(): ProfilingController {
  let enabled = false;
  let toggleKeyDown = false;

  const updateEnabled = (togglePressed: boolean): boolean => {
    if (togglePressed) {
      if (!toggleKeyDown) {
        enabled = !enabled;
        toggleKeyDown = true;
      }
    } else if (toggleKeyDown) {
      toggleKeyDown = false;
    }

    return enabled;
  };

  const isEnabled = (): boolean => enabled;

  return { updateEnabled, isEnabled };
}
