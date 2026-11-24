export type BillingDiagnosticCode = 'scheduled_failed' | 'queue_failed' | 'queue_retry_requested';
export type BillingDiagnosticsBinding = {
  writeDataPoint(point: { indexes: string[]; blobs: string[]; doubles: number[] }): void;
};

export function createBillingDiagnostics(binding?: BillingDiagnosticsBinding): (code: BillingDiagnosticCode) => void {
  const emitted = new Set<BillingDiagnosticCode>();
  return (code) => {
    if (code !== 'scheduled_failed' && code !== 'queue_failed' && code !== 'queue_retry_requested') return;
    if (!binding || emitted.has(code)) return;
    emitted.add(code);
    try {
      binding.writeDataPoint({ indexes: [`billing:${code}`], blobs: ['billing', code], doubles: [1] });
    } catch {
      // Diagnostics must never change delivery or expose transport errors.
    }
  };
}
