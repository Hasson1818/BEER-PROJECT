import { drawBarcode } from './textures.js';

const $ = (id) => document.getElementById(id);

/**
 * Everything drawn in HTML on top of the 3D view. Dialogues and panels are
 * "modal": while one is open the player can't move and the mouse is free.
 */
export function createUI({ onModalChange }) {
  let modalCount = 0;
  const keyHandlers = new Set();

  function holdModal() {
    modalCount++;
    if (modalCount === 1) onModalChange(true);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      modalCount = Math.max(0, modalCount - 1);
      if (modalCount === 0) onModalChange(false);
    };
  }

  /** Drop every hold at once (used when a step has to be abandoned). */
  function releaseAll() {
    if (modalCount === 0) return;
    modalCount = 0;
    onModalChange(false);
  }

  document.addEventListener('keydown', (event) => {
    for (const handler of [...keyHandlers]) handler(event);
  });

  function onKey(handler) {
    keyHandlers.add(handler);
    return () => keyHandlers.delete(handler);
  }

  // ---------- HUD ----------

  const objective = document.querySelector('.objective');

  function setObjective(text, sub = '') {
    const changed = $('objective-text').textContent !== text;
    $('objective-text').textContent = text;
    setObjectiveSub(sub);
    if (changed) {
      objective.classList.remove('flash');
      void objective.offsetWidth;
      objective.classList.add('flash');
    }
  }

  function setObjectiveSub(sub) {
    const el = $('objective-sub');
    el.hidden = !sub;
    if (el.textContent !== sub) el.textContent = sub;
  }

  function setClock(totalMinutes) {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = Math.floor(totalMinutes % 60);
    const text = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if ($('clock').textContent !== text) $('clock').textContent = text;
  }

  function showSticker(number) {
    const canvas = $('sticker-barcode');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawBarcode(ctx, 4, 2, canvas.width - 8, canvas.height - 4, number.charCodeAt(2) * 31 + 7);
    $('sticker-number').textContent = number;
    $('sticker').hidden = false;
  }

  function setPrompt(text) {
    const el = $('prompt');
    if (!text) {
      el.hidden = true;
      $('crosshair').classList.remove('active');
      return;
    }
    const touch = document.body.classList.contains('touch');
    const html = touch ? text : `<kbd>E</kbd> ${text}`;
    if (el.dataset.text !== html) {
      el.dataset.text = html;
      el.innerHTML = '';
      if (!touch) {
        const key = document.createElement('kbd');
        key.textContent = 'E';
        el.append(key, ` ${text}`);
      } else {
        el.textContent = text;
      }
    }
    el.hidden = false;
    $('crosshair').classList.add('active');
  }

  let announceTimer;
  function announce(title, detail) {
    const el = $('announcement');
    el.innerHTML = '';
    el.append(title);
    if (detail) {
      const small = document.createElement('small');
      small.textContent = detail;
      el.append(small);
    }
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      el.hidden = true;
    }, 6500);
  }

  let toastTimer;
  function toast(text, duration = 2800) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), duration);
  }

  // ---------- Dialogue ----------

  const dialogue = $('dialogue');

  /**
   * Show one line. With `choices`, resolves to the chosen index; otherwise
   * resolves when the player continues.
   */
  function talk(speaker, text, choices = null) {
    const release = holdModal();
    dialogue.hidden = false;
    dialogue.style.animation = 'none';
    void dialogue.offsetWidth;
    dialogue.style.animation = '';

    const speakerEl = $('dialogue-speaker');
    speakerEl.textContent = speaker;
    speakerEl.classList.toggle('player', speaker === 'אני');
    const textEl = $('dialogue-text');
    const choicesEl = $('dialogue-choices');
    const continueEl = $('dialogue-continue');
    choicesEl.innerHTML = '';
    continueEl.hidden = true;

    return new Promise((resolve) => {
      let offKey = () => {};
      let shown = 0;
      let typing = true;
      textEl.textContent = '';
      const typer = setInterval(() => {
        shown += 2;
        textEl.textContent = text.slice(0, shown);
        if (shown >= text.length) finishTyping();
      }, 16);

      function finishTyping() {
        if (!typing) return;
        typing = false;
        clearInterval(typer);
        textEl.textContent = text;
        if (choices) renderChoices();
        else continueEl.hidden = false;
      }

      function done(value) {
        clearInterval(typer);
        offKey();
        continueEl.onclick = null;
        dialogue.onclick = null;
        dialogue.hidden = true;
        release();
        resolve(value);
      }

      function renderChoices() {
        choices.forEach((choice, i) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'choice';
          const key = document.createElement('span');
          key.className = 'choice-key';
          key.textContent = String(i + 1);
          button.append(key, choice);
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            done(i);
          });
          choicesEl.append(button);
        });
      }

      dialogue.onclick = () => {
        if (typing) finishTyping();
        else if (!choices) done(null);
      };
      continueEl.onclick = (event) => {
        event.stopPropagation();
        // A question can only be closed by picking an answer.
        if (!choices) done(null);
      };

      const openedAt = performance.now();
      offKey = onKey((event) => {
        // Ignore the same key press that opened the dialogue.
        if (event.repeat || performance.now() - openedAt < 250) return;
        const advance = ['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(event.code);
        if (typing && advance) {
          event.preventDefault();
          finishTyping();
          return;
        }
        if (typing) return;
        if (choices) {
          const index = Number(event.key) - 1;
          if (index >= 0 && index < choices.length) {
            event.preventDefault();
            done(index);
          }
        } else if (advance) {
          event.preventDefault();
          done(null);
        }
      });
    });
  }

  /** Several lines in a row: [[speaker, text], ...]. Keeps the dialogue open between them. */
  async function conversation(lines) {
    const release = holdModal();
    try {
      for (const [speaker, text] of lines) await talk(speaker, text);
    } finally {
      release();
    }
  }

  // ---------- Panels ----------

  const layer = $('panel-layer');

  /** Opens a panel. `build(panel, close)` fills it; resolves with what close() gets. */
  function panel(className, build) {
    const release = holdModal();
    layer.hidden = false;
    const el = document.createElement('div');
    el.className = `panel ${className}`;
    layer.append(el);
    return new Promise((resolve) => {
      const cleanups = [];
      const close = (value) => {
        for (const fn of cleanups) fn();
        el.remove();
        if (!layer.children.length) layer.hidden = true;
        release();
        resolve(value);
      };
      build(el, close, (fn) => cleanups.push(fn));
    });
  }

  function fact(title, points) {
    return panel('fact', (el, close, cleanup) => {
      el.innerHTML = `<div class="icon">!</div><p class="eyebrow">ידעת?</p><h2></h2><ul></ul><div class="actions"><button class="button" type="button">הבנתי</button></div>`;
      el.querySelector('h2').textContent = title;
      const list = el.querySelector('ul');
      for (const point of points) {
        const li = document.createElement('li');
        li.textContent = point;
        list.append(li);
      }
      el.querySelector('button').addEventListener('click', () => close());
      const openedAt = performance.now();
      cleanup(
        onKey((event) => {
          if (performance.now() - openedAt < 400) return;
          if (['Enter', 'Space', 'KeyE'].includes(event.code) && !event.repeat) {
            event.preventDefault();
            close();
          }
        }),
      );
    });
  }

  // ---------- Fade ----------

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function fadeOut() {
    $('fade').classList.add('on');
    await wait(650);
  }

  async function fadeIn() {
    $('fade').classList.remove('on');
    await wait(650);
  }

  /** Black screen with a line of text, e.g. "45 דקות אחר כך…". */
  async function interlude(text, ms = 2600) {
    const release = holdModal();
    await fadeOut();
    const el = document.createElement('div');
    el.className = 'fade-text';
    el.textContent = text;
    document.body.append(el);
    await wait(ms);
    el.remove();
    await fadeIn();
    release();
  }

  return {
    holdModal,
    releaseAll,
    onKey,
    setObjective,
    setObjectiveSub,
    setClock,
    showSticker,
    setPrompt,
    announce,
    toast,
    talk,
    conversation,
    panel,
    fact,
    fadeOut,
    fadeIn,
    interlude,
    get modalOpen() {
      return modalCount > 0;
    },
  };
}
