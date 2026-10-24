// Note input from Web MIDI keyboards.

export class MidiInput {
  constructor({ onNoteOn, onNoteOff, onPedal, onDevices }) {
    Object.assign(this, { onNoteOn, onNoteOff, onPedal, onDevices });
    this.access = null;
    this.selected = 'all';
    this.handler = (e) => this.message(e);
  }

  get supported() {
    return 'requestMIDIAccess' in navigator;
  }

  async init() {
    if (!this.supported) return false;
    if (this.access) return true;
    try {
      this.access = await navigator.requestMIDIAccess();
    } catch {
      return false;
    }
    this.access.onstatechange = () => this.attach();
    this.attach();
    return true;
  }

  devices() {
    if (!this.access) return [];
    return [...this.access.inputs.values()].map((i) => ({ id: i.id, name: i.name }));
  }

  select(id) {
    this.selected = id || 'all';
    this.attach();
  }

  attach() {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = this.selected === 'all' || this.selected === input.id ? this.handler : null;
    }
    this.onDevices?.(this.devices());
  }

  message(e) {
    const [status, d1, d2] = e.data;
    const cmd = status & 0xf0;
    if (cmd === 0x90 && d2 > 0) this.onNoteOn(d1, d2 / 127, e.timeStamp);
    else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) this.onNoteOff(d1, e.timeStamp);
    else if (cmd === 0xb0 && d1 === 64) this.onPedal(d2 >= 64);
  }
}
