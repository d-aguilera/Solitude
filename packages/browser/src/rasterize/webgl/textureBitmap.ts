interface BitmapEntry {
  references: number;
  bitmap: ImageBitmap | null;
  abort: AbortController;
  ready: Promise<ImageBitmap>;
}

// Only in-flight uploads retain decoded pixels. Views share preparation by URL;
// the last completed/cancelled upload closes the bitmap and removes the entry.
const entries = new Map<string, BitmapEntry>();

export function acquireTextureBitmap(source: string) {
  let entry = entries.get(source);
  if (!entry) {
    const created: BitmapEntry = {
      references: 0,
      bitmap: null,
      abort: new AbortController(),
      ready: null!,
    };
    created.ready = (async () => {
      const response = await fetch(source, { signal: created.abort.signal });
      if (!response.ok)
        throw new Error(`Texture request failed: ${response.status}`);
      // Decode from compressed bytes asynchronously, avoiding HTMLImageElement's
      // lazy decode and conversion inside a synchronous WebGL upload.
      const bitmap = await createImageBitmap(await response.blob(), {
        premultiplyAlpha: "none",
      });
      if (created.references === 0) {
        bitmap.close();
        throw new Error("Texture preparation cancelled");
      }
      created.bitmap = bitmap;
      return bitmap;
    })();
    entries.set(source, created);
    entry = created;
  }
  entry.references++;
  const retained = entry;
  let released = false;
  return {
    ready: retained.ready,
    release: () => {
      if (released) return;
      released = true;
      if (--retained.references !== 0) return;
      if (entries.get(source) === retained) entries.delete(source);
      retained.abort.abort();
      retained.bitmap?.close();
      retained.bitmap = null;
    },
  };
}
