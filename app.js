(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fields = [$('hours'), $('minutes'), $('seconds')];
  const ui = {
    dial: $('dial'), ring: $('ring'), elapsed: $('elapsed'), hundredths: $('hundredths'),
    message: $('message'), action: $('action'), pause: $('pause'), restore: $('restore'),
    clear: $('clear'), finish: $('finish'), confirm: $('confirm')
  };
  let savedMs = Math.max(0, Number(localStorage.getItem('selfStopwatchSeconds') || 0) * 1000);
  let remainingMs = savedMs;
  let endAt = 0;
  let mode = savedMs > 0 ? 'ready' : 'empty';
  let frame = 0;

  const pad = (value, size = 2) => String(Math.max(0, value)).padStart(size, '0');
  const format = ms => {
    const cs = Math.max(0, Math.ceil(ms / 10));
    const whole = Math.floor(cs / 100);
    return `${pad(Math.floor(whole / 3600))} : ${pad(Math.floor(whole % 3600 / 60))} : ${pad(whole % 60)}.${pad(cs % 100)}`;
  };
  const setAction = (label, key, disabled = false) => {
    ui.action.disabled = disabled;
    ui.action.innerHTML = `<span>${label}</span>${key ? `<kbd aria-label="${key === '▔' ? 'Space' : key} 키">${key}</kbd>` : ''}`;
  };
  const renderInputs = () => {
    const cs = Math.max(0, Math.ceil(remainingMs / 10));
    const whole = Math.floor(cs / 100);
    if (document.activeElement !== fields[0]) fields[0].value = pad(Math.floor(whole / 3600));
    if (document.activeElement !== fields[1]) fields[1].value = pad(Math.floor(whole % 3600 / 60));
    if (document.activeElement !== fields[2]) fields[2].value = pad(whole % 60);
    ui.hundredths.textContent = pad(cs % 100);
    ui.elapsed.textContent = format(mode === 'editing' ? 0 : Math.max(0, savedMs - remainingMs));
    const progress = savedMs > 0 ? Math.min(1, Math.max(0, (savedMs - remainingMs) / savedMs)) : 0;
    document.documentElement.style.setProperty('--progress', `${progress * 360}deg`);
  };
  const renderState = () => {
    renderInputs();
    ui.pause.disabled = mode !== 'running' && mode !== 'paused';
    ui.pause.querySelector('span').textContent = mode === 'paused' ? '재개' : '일시정지';
    if (mode === 'editing') setAction('시간 저장', 'T');
    else if (mode === 'running') setAction('진행 중', '▔');
    else if (mode === 'paused') setAction('재개', '↵');
    else if (savedMs > 0) setAction('시작', '↵');
    else setAction('시간을 입력해 주세요', '', true);
    if (mode === 'editing') ui.message.textContent = '시간을 입력한 뒤 T 키나 시간 저장을 눌러 주세요';
    else if (mode === 'paused') ui.message.textContent = '일시정지';
    else if (mode !== 'running') ui.message.textContent = savedMs > 0 ? '시작할 준비가 되었습니다' : '시간을 입력해 주세요';
  };
  const enterEditing = () => {
    if (mode === 'running' || mode === 'paused' || mode === 'finished') return;
    mode = 'editing';
    remainingMs = 0;
    const h = Math.min(99, Number(fields[0].value.replace(/\D/g, '')) || 0);
    const m = Math.min(59, Number(fields[1].value.replace(/\D/g, '')) || 0);
    const s = Math.min(59, Number(fields[2].value.replace(/\D/g, '')) || 0);
    remainingMs = (h * 3600 + m * 60 + s) * 1000;
    renderState();
  };
  const save = () => {
    const h = Math.min(99, Number(fields[0].value) || 0);
    const m = Math.min(59, Number(fields[1].value) || 0);
    const s = Math.min(59, Number(fields[2].value) || 0);
    const total = h * 3600 + m * 60 + s;
    if (total < 1) { ui.message.textContent = '1초 이상의 시간을 입력해 주세요'; return; }
    savedMs = total * 1000;
    localStorage.setItem('selfStopwatchSeconds', String(total));
    restore();
  };
  const start = () => {
    if (!savedMs || mode === 'editing' || mode === 'finished' || mode === 'running') return;
    if (remainingMs <= 0) remainingMs = savedMs;
    endAt = performance.now() + remainingMs;
    mode = 'running';
    renderState();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  };
  const pause = () => {
    if (mode === 'paused') { start(); return; }
    if (mode !== 'running') return;
    remainingMs = Math.max(0, endAt - performance.now());
    mode = 'paused';
    cancelAnimationFrame(frame);
    document.documentElement.style.setProperty('--pulse', '0');
    renderState();
  };
  const restore = () => {
    cancelAnimationFrame(frame);
    mode = savedMs > 0 ? 'ready' : 'empty';
    remainingMs = savedMs;
    document.documentElement.style.setProperty('--pulse', '0');
    ui.finish.hidden = true;
    renderState();
  };
  const clear = () => {
    savedMs = 0;
    localStorage.removeItem('selfStopwatchSeconds');
    restore();
  };
  const finish = () => {
    cancelAnimationFrame(frame);
    remainingMs = 0;
    mode = 'finished';
    document.documentElement.style.setProperty('--pulse', '0');
    renderInputs();
    ui.finish.hidden = false;
    ui.confirm.focus();
  };
  const warning = now => {
    const seconds = remainingMs / 1000;
    let text = '';
    if (seconds <= 5) text = '5초 남았습니다.';
    else if (seconds <= 10) text = '10초 남았습니다.';
    else if (seconds <= 15) text = '15초 남았습니다.';
    else if (seconds <= 30) text = '30초 남았습니다.';
    ui.message.textContent = text || '진행 중';
    if (seconds > 30) return 0;
    const period = seconds <= 10 ? 2000 : 3000;
    const phase = (now % period) / period;
    const envelope = phase < .14 ? phase / .14 : phase < .27 ? 1 : phase < .54 ? 1 - (phase - .27) / .27 : 0;
    return envelope * (seconds <= 10 ? .95 : .72);
  };
  const tick = now => {
    if (mode !== 'running') return;
    remainingMs = Math.max(0, endAt - now);
    document.documentElement.style.setProperty('--pulse', String(warning(now)));
    renderInputs();
    if (remainingMs <= 0) { finish(); return; }
    frame = requestAnimationFrame(tick);
  };
  const centralAction = () => {
    if (mode === 'editing') save();
    else if (mode === 'running' || mode === 'paused') pause();
    else start();
  };

  fields.forEach((field, index) => {
    field.addEventListener('focus', () => { if (mode !== 'running' && mode !== 'paused') { mode = 'editing'; field.select(); renderState(); } });
    field.addEventListener('input', () => {
      field.value = field.value.replace(/\D/g, '').slice(0, 2);
      const limit = index === 0 ? 99 : 59;
      if (Number(field.value) > limit) field.value = String(limit);
      enterEditing();
    });
    field.addEventListener('blur', () => { field.value = pad(Number(field.value) || 0); });
  });
  ui.action.addEventListener('click', centralAction);
  ui.pause.addEventListener('click', pause);
  ui.restore.addEventListener('click', restore);
  ui.clear.addEventListener('click', clear);
  ui.confirm.addEventListener('click', restore);

  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (mode === 'finished' && (key === 'enter' || key === ' ')) { event.preventDefault(); restore(); return; }
    if (key === ' ') { event.preventDefault(); pause(); return; }
    if (key === 't' && mode === 'editing') { event.preventDefault(); save(); return; }
    if (key === 'enter' && mode !== 'editing') { event.preventDefault(); start(); return; }
    if (key === 's') { event.preventDefault(); restore(); return; }
    if (key === 'r') { event.preventDefault(); clear(); }
  }, { passive: false });

  renderState();
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
})();
