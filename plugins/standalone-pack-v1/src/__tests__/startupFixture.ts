/** Complete an idle 60 Hz presentation streak without ticking physics. */
export function prepareStartup(controller: {
  observeStartupFrame: (now: number, dt: number) => void;
}) {
  for (let i = 0; i <= 30; i++)
    controller.observeStartupFrame((i * 1000) / 60, 1000 / 60);
}
