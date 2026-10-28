/* 临时文字编辑：右上角开关切换整页文字可编辑，保存时把改动写回 frontend/index.html */
(() => {
  const shell = document.querySelector('main.shell');
  if (!shell) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'text-edit-toggle';
  toggle.textContent = '编辑文字';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.title = '编辑页面文字并写回 frontend/index.html（Esc 取消改动）';
  document.body.append(toggle);
  // 避免 app.js 的按钮代码雨效果给开关注入字符并改掉 fixed 定位
  toggle.addEventListener('pointerover', event => event.stopPropagation());

  const status = document.createElement('p');
  status.className = 'text-edit-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  document.body.append(status);

  let editing = false;
  let snapshot = new Map();
  let statusTimer = 0;

  const textNodes = () => {
    const nodes = [];
    const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  };
  const takeSnapshot = () => { snapshot = new Map(textNodes().map(node => [node, node.nodeValue])); };

  const showStatus = (message, isError = false) => {
    status.textContent = message;
    status.hidden = false;
    status.classList.toggle('is-error', isError);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.hidden = true; }, 6000);
  };

  const scopeOf = (node) => {
    const chain = [];
    let element = node.parentElement;
    while (element && element !== document.documentElement && chain.length < 8) {
      chain.push({ tag: element.tagName.toLowerCase(), id: element.id || '' });
      element = element.parentElement;
    }
    return chain;
  };

  const gatherEdits = () => {
    const edits = [];
    for (const node of textNodes()) {
      const original = snapshot.get(node);
      if (original === undefined || node.nodeValue === original) continue;
      edits.push({ from: original, to: node.nodeValue, scope: scopeOf(node) });
    }
    return edits;
  };

  const exit = (cancel) => {
    if (cancel) for (const [node, value] of snapshot) if (node.nodeValue !== value) node.nodeValue = value;
    editing = false;
    shell.removeAttribute('contenteditable');
    document.body.classList.remove('is-text-editing');
    toggle.textContent = '编辑文字';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.disabled = false;
  };

  const save = async () => {
    const edits = gatherEdits();
    if (!edits.length) { exit(false); showStatus('没有改动'); return; }
    toggle.disabled = true;
    toggle.textContent = '保存中…';
    try {
      const response = await fetch('/api/ui-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits })
      });
      const data = await response.json();
      if (!response.ok) throw Error(data && data.error ? data.error.message : '保存失败');
      exit(false);
      const message = [`已保存 ${data.applied.length} 处到 ${data.file}`];
      if (data.skipped.length) {
        const names = data.skipped.slice(0, 2).map(item => `「${item.text.slice(0, 12)}」`).join('、');
        message.push(`${data.skipped.length} 处未保存：${names}${data.skipped.length > 2 ? ' 等' : ''}`);
      }
      showStatus(message.join('；'), data.skipped.length > 0);
    } catch (error) {
      toggle.disabled = false;
      toggle.textContent = '保存并退出';
      showStatus(`保存失败：${error.message}`, true);
    }
  };

  toggle.addEventListener('click', () => {
    if (editing) { save(); return; }
    editing = true;
    takeSnapshot();
    shell.setAttribute('contenteditable', 'true');
    document.body.classList.add('is-text-editing');
    toggle.textContent = '保存并退出';
    toggle.setAttribute('aria-pressed', 'true');
    shell.focus({ preventScroll: true });
  });

  document.addEventListener('keydown', (event) => {
    if (!editing || event.key !== 'Escape') return;
    event.preventDefault();
    exit(true);
    showStatus('已取消改动');
  });
})();
