export class AtomicReloader<T> {
  private value?: T;
  private fingerprint?: string;
  private pending?: Promise<T>;
  private pendingFingerprint?: string;

  async get(fingerprint: string, build: () => Promise<T>): Promise<T> {
    if (this.value && this.fingerprint === fingerprint) return this.value;
    if (this.pending) {
      if (this.pendingFingerprint === fingerprint) return this.pending;
      await this.pending;
      return this.get(fingerprint, build);
    }
    this.pendingFingerprint = fingerprint;
    this.pending = build()
      .then((next) => {
        this.value = next;
        this.fingerprint = fingerprint;
        return next;
      })
      .finally(() => {
        this.pending = undefined;
        this.pendingFingerprint = undefined;
      });
    return this.pending;
  }
}
