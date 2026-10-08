import { afterEach, describe, expect, it, vi } from "vitest";
import { initLayout, type LayoutView } from "../../infra/domLayout";

describe("layout lifetime", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("keeps DPR listeners independent and removes the latest listener on disposal", () => {
    const windowTarget = Object.assign(new EventTarget(), {
      devicePixelRatio: 1,
    });
    vi.stubGlobal("window", windowTarget);
    const queries: EventTarget[] = [];
    vi.stubGlobal("matchMedia", () => {
      const media = new EventTarget();
      queries.push(media);
      return media;
    });
    const container = { clientWidth: 1000, clientHeight: 700 } as Element;
    const makeView = (): LayoutView => ({
      element: { style: {} } as HTMLElement,
      layout: { kind: "primary" },
      resize: vi.fn(),
    });
    const a = makeView();
    const b = makeView();
    const disposeA = initLayout(container, [a]);
    const disposeB = initLayout(container, [b]);
    queries[0].dispatchEvent(new Event("change"));
    expect(a.resize).toHaveBeenCalledTimes(2);
    expect(b.resize).toHaveBeenCalledTimes(1);
    expect(queries).toHaveLength(3);
    disposeA();
    disposeA();
    windowTarget.dispatchEvent(new Event("resize"));
    queries[2].dispatchEvent(new Event("change"));
    expect(a.resize).toHaveBeenCalledTimes(2);
    expect(b.resize).toHaveBeenCalledTimes(2);
    disposeB();
    windowTarget.dispatchEvent(new Event("resize"));
    queries[1].dispatchEvent(new Event("change"));
    expect(b.resize).toHaveBeenCalledTimes(2);
  });
});
