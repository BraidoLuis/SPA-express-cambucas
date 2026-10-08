type Ticket = { channel: string; generation: number };

// Bloqueia cliques repetidos e invalida respostas após fechamento/desmontagem.
export class BookingRequests {
  private active = false;
  private generation = 0;
  private pending = new Map<string, Ticket>();

  start() {
    if (!this.active) {
      this.active = true;
      this.generation++;
    }
  }

  stop() {
    this.active = false;
    this.generation++;
    this.pending.clear();
  }

  busy(channel: string) { return this.active && this.pending.has(channel); }

  begin(channel: string, exclusive = false): Ticket | null {
    if (!this.active || (exclusive && this.pending.has(channel))) return null;
    const ticket = { channel, generation: this.generation };
    this.pending.set(channel, ticket);
    return ticket;
  }

  current(ticket: Ticket) {
    return this.active && ticket.generation === this.generation && this.pending.get(ticket.channel) === ticket;
  }

  finish(ticket: Ticket) {
    if (this.current(ticket)) this.pending.delete(ticket.channel);
  }
}
