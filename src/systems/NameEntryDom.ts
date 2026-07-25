/**
 * DOM name field overlaid on the Phaser canvas.
 * Phaser text input is weak on mobile; a real <input> opens the OS keyboard.
 */

export type NameEntryOptions = {
  title?: string;
  placeholder?: string;
  maxLength?: number;
  initial?: string;
  submitLabel?: string;
  skipLabel?: string;
  onSubmit: (name: string) => void;
  onSkip: () => void;
};

const ROOT_ID = 'orc-ball-name-entry';

function applyStyle(el: HTMLElement, styles: Record<string, string>): void {
  for (const [k, v] of Object.entries(styles)) {
    el.style.setProperty(k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), v);
  }
}

export function isNameEntryOpen(): boolean {
  return Boolean(document.getElementById(ROOT_ID));
}

export function closeNameEntry(): void {
  document.getElementById(ROOT_ID)?.remove();
}

export function openNameEntry(opts: NameEntryOptions): void {
  closeNameEntry();

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', opts.title ?? 'Enter name');
  // Sit in the lower half so the Phaser victory stats stay readable above.
  applyStyle(root, {
    position: 'fixed',
    left: '0',
    right: '0',
    bottom: '0',
    top: '45%',
    zIndex: '10000',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '8px',
    pointerEvents: 'none',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  });

  const panel = document.createElement('div');
  applyStyle(panel, {
    pointerEvents: 'auto',
    width: 'min(92vw, 360px)',
    padding: '18px 16px 14px',
    background: 'rgba(10, 18, 32, 0.96)',
    border: '2px solid #4fc3f7',
    borderRadius: '6px',
    boxShadow:
      '0 0 0 1px rgba(79,195,247,0.25), 0 12px 40px rgba(0,0,0,0.55)',
    textAlign: 'center',
    color: '#fff',
    userSelect: 'text',
  });

  const title = document.createElement('div');
  title.textContent = opts.title ?? 'ENTER YOUR NAME';
  applyStyle(title, {
    color: '#ffd54f',
    fontWeight: '700',
    fontSize: '15px',
    letterSpacing: '0.06em',
    marginBottom: '12px',
  });

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = opts.maxLength ?? 12;
  input.placeholder = opts.placeholder ?? 'NAME';
  input.value = opts.initial ?? '';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.enterKeyHint = 'done';
  applyStyle(input, {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    fontSize: '18px',
    fontFamily: 'inherit',
    textAlign: 'center',
    textTransform: 'uppercase',
    color: '#ffffff',
    background: '#050510',
    border: '1px solid #4fc3f7',
    borderRadius: '4px',
    outline: 'none',
    marginBottom: '12px',
    caretColor: '#4fc3f7',
  });

  const row = document.createElement('div');
  applyStyle(row, {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  });

  const mkBtn = (label: string, primary: boolean): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    applyStyle(b, {
      flex: '1',
      padding: '10px 8px',
      fontFamily: 'inherit',
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '0.04em',
      cursor: 'pointer',
      borderRadius: '4px',
      border: primary ? '1px solid #4fc3f7' : '1px solid #546e7a',
      background: primary ? '#1565c0' : '#0d1520',
      color: '#ffffff',
    });
    return b;
  };

  const submit = mkBtn(opts.submitLabel ?? 'SUBMIT', true);
  const skip = mkBtn(opts.skipLabel ?? 'SKIP', false);

  const finish = (submitName: boolean): void => {
    const name = input.value;
    closeNameEntry();
    if (submitName) opts.onSubmit(name);
    else opts.onSkip();
  };

  submit.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    finish(true);
  });
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    finish(false);
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  input.addEventListener('keypress', (e) => e.stopPropagation());

  row.append(submit, skip);
  panel.append(title, input, row);
  root.append(panel);
  document.body.append(root);

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}
