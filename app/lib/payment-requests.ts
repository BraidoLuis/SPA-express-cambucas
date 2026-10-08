type ActionToken = { generation: number; sequence: number };
type ReadToken = ActionToken & { channel: string };

// Cada instância pertence a uma montagem/acesso. O bloqueio é síncrono.
export class PaymentRequests {
  private active = false;
  private generation = 0;
  private sequence = 0;
  private action: ActionToken | null = null;
  private reads = new Map<string, number>();
  private pendingReads = new Map<string, number>();

  activate() {
    this.active = true;
    this.generation++;
    this.action = null;
    this.reads.clear();
    this.pendingReads.clear();
  }
  deactivate() {
    this.active = false;
    this.generation++;
    this.action = null;
    this.reads.clear();
    this.pendingReads.clear();
  }
  invalidateReads() { this.reads.clear(); }
  busy() { return this.action !== null; }
  beginAction(): ActionToken | null {
    if (!this.active || this.action) return null;
    this.invalidateReads();
    this.action = { generation: this.generation, sequence: ++this.sequence };
    return this.action;
  }
  currentAction(token: ActionToken) {
    return this.active && token.generation === this.generation && this.action === token;
  }
  finishAction(token: ActionToken) {
    if (this.currentAction(token)) this.action = null;
  }
  beginRead(channel: string): ReadToken | null {
    if (!this.active) return null;
    const sequence = ++this.sequence;
    this.reads.set(channel, sequence);
    this.pendingReads.set(channel, sequence);
    return { generation: this.generation, sequence, channel };
  }
  // Invalidar dados não transfere a titularidade do loading.
  // Apenas a última consulta ainda pendente do canal/acesso pode encerrá-lo.
  finishRead(token: ReadToken) {
    if (!this.active || token.generation !== this.generation ||
        this.pendingReads.get(token.channel) !== token.sequence) return false;
    this.pendingReads.delete(token.channel);
    return true;
  }
  currentRead(token: ReadToken) {
    return this.active && token.generation === this.generation &&
      this.reads.get(token.channel) === token.sequence;
  }
}

// A confirmação e a falha posterior da recarga têm callbacks distintos.
export async function runPaymentAction<T>(
  requests: PaymentRequests,
  action: () => Promise<T>,
  callbacks: {
    onStart: () => void;
    onConfirmed: (result: T) => void;
    reload: () => Promise<void>;
    onError: (error: unknown) => void;
    onRefreshFailure?: () => void;
    onFinish: () => void;
  },
) {
  const token = requests.beginAction();
  if (!token) return "ignored" as const;
  callbacks.onStart();
  try {
    let result: T;
    try {
      result = await action();
    } catch (error) {
      if (requests.currentAction(token)) callbacks.onError(error);
      return "failed" as const;
    }
    if (!requests.currentAction(token)) return "ignored" as const;
    requests.invalidateReads();
    callbacks.onConfirmed(result);
    try {
      await callbacks.reload();
    } catch {
      if (requests.currentAction(token)) callbacks.onRefreshFailure?.();
      return "confirmed-refresh-failed" as const;
    }
    return "confirmed" as const;
  } finally {
    if (requests.currentAction(token)) callbacks.onFinish();
    requests.finishAction(token);
  }
}

// O painel dono dos dados pode continuar montado quando sua tabela desmonta na recarga.
export async function reloadConfirmedPayment(
  owner: PaymentRequests,
  loaders: Array<() => Promise<boolean>>,
  onRefreshFailure: () => void,
) {
  const token = owner.beginRead("payment-refresh");
  if (!token) return;
  try {
    const results = await Promise.all(loaders.map(async (load) => {
      try { return await load(); } catch { return false; }
    }));
    if (!owner.currentRead(token)) return;
    if (results.some((success) => !success)) {
      onRefreshFailure();
      throw new Error("Recarga indisponível após confirmação");
    }
  } finally {
    owner.finishRead(token);
  }
}
