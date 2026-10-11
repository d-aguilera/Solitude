import { afterEach, expect, it, vi } from "vitest";
import { acquireTextureBitmap } from "../../../rasterize/webgl/textureBitmap";

afterEach(() => vi.unstubAllGlobals());

function decodedFixture() {
  const close = vi.fn();
  const bitmap = { width: 8192, height: 4096, close } as unknown as ImageBitmap;
  const fetchTexture = vi.fn(async () => ({
    ok: true,
    blob: async () => new Blob(),
  }));
  const decode = vi.fn(async () => bitmap);
  vi.stubGlobal("fetch", fetchTexture);
  vi.stubGlobal("createImageBitmap", decode);
  return { bitmap, close, fetchTexture, decode };
}

it("fetches and decodes once for five views and closes only after the last upload releases", async () => {
  const f = decodedFixture();
  const views = Array.from({ length: 5 }, () =>
    acquireTextureBitmap("/shared.jpg"),
  );
  expect(await Promise.all(views.map((view) => view.ready))).toEqual(
    Array(5).fill(f.bitmap),
  );
  expect(f.fetchTexture).toHaveBeenCalledOnce();
  expect(f.decode).toHaveBeenCalledExactlyOnceWith(expect.any(Blob), {
    premultiplyAlpha: "none",
  });
  for (const view of views.slice(0, 4)) view.release();
  expect(f.close).not.toHaveBeenCalled();
  views[4].release();
  views[4].release();
  expect(f.close).toHaveBeenCalledOnce();
  const fresh = acquireTextureBitmap("/shared.jpg");
  await fresh.ready;
  expect(f.fetchTexture).toHaveBeenCalledTimes(2);
  fresh.release();
});

it("aborts unused fetches and closes late decodes after Retry disposal", async () => {
  const f = decodedFixture();
  let finish: (bitmap: ImageBitmap) => void = () => {};
  f.decode.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = acquireTextureBitmap("/late.jpg");
  const rejected = expect(view.ready).rejects.toThrow("cancelled");
  await vi.waitFor(() => expect(f.decode).toHaveBeenCalledOnce());
  const signal = (
    f.fetchTexture.mock.calls[0] as unknown as [string, RequestInit]
  )[1].signal!;
  view.release();
  expect(signal.aborted).toBe(true);
  finish(f.bitmap);
  await rejected;
  expect(f.close).toHaveBeenCalledOnce();
});

it.each(["request", "decode"])(
  "releases failed %s preparation so a fresh run can retry",
  async (failure) => {
    const f = decodedFixture();
    if (failure === "request")
      f.fetchTexture.mockRejectedValueOnce(new Error("request failed"));
    else f.decode.mockRejectedValueOnce(new Error("decode failed"));
    const first = acquireTextureBitmap("/failure.jpg");
    await expect(first.ready).rejects.toThrow(`${failure} failed`);
    first.release();
    const fresh = acquireTextureBitmap("/failure.jpg");
    expect(await fresh.ready).toBe(f.bitmap);
    fresh.release();
    expect(f.close).toHaveBeenCalledOnce();
  },
);
