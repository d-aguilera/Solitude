export class RingBuffer<T> {
  private storage = new Array<T>();

  constructor(readonly capacity: number) {}

  private cnt = 0;
  get count(): number {
    return this.cnt;
  }

  private t = -1;
  get tail(): number {
    return this.t;
  }

  push(value: T): T | undefined {
    if (this.cnt < this.capacity) {
      // Grow phase: contiguous [0..count-1]
      this.t++;
      this.storage.push(value);
      this.cnt++;
      return undefined;
    }

    // Full: overwrite and evict oldest (at head)
    this.t = (this.t + 1) % this.capacity;
    const evicted = this.storage[this.t];
    this.storage[this.t] = value;
    return evicted;
  }

  forEach(fn: (value: T) => void): void {
    for (let i = 0; i < this.cnt; i++) {
      const idx = (this.capacity + this.t - i) % this.capacity;
      fn(this.storage[idx]);
    }
  }
}
