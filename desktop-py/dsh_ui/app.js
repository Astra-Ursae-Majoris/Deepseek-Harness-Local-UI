// DeepSeek Harness 桌面版 UI 逻辑
// 通过 pywebview js_api 调用 Python 桥（window.pywebview.api.*）

const state = {
  sessions: [],
  currentId: null,
  history: [],        // 当前会话的扁平消息行
  events: [],         // 当前会话的原始事件（含 seq）
  outline: [],
  streaming: false,
  streamTurn: null,
  streamStep: null,
};

const $ = (sel) => document.querySelector(sel);

// ---- toast ----
let toastTimer = null;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---- 服务管理 ----
async function refreshStatus() {
  try {
    const s = await window.pywebview.api.status();
    const el = $('#svc-status');
    const txt = $('#svc-text');
    if (s.running) {
      el.className = 'svc-running';
      txt.textContent = '服务运行中' + (s.version ? ' · v' + s.version : '');
    } else {
      el.className = 'svc-stopped';
      txt.textContent = '服务已停止';
    }
    $('#btn-start').disabled = s.running;
    $('#btn-stop').disabled = !s.running;
  } catch (e) {
    $('#svc-text').textContent = '状态未知';
  }
}

async function onStart() {
  const msg = await window.pywebview.api.start_service();
  toast(msg);
  await refreshStatus();
  if (msg.includes('已启动') || msg.includes('已在运行')) loadSessions();
}
async function onStop() {
  const msg = await window.pywebview.api.stop_service();
  toast(msg);
  await refreshStatus();
}
async function onRestart() {
  const msg = await window.pywebview.api.restart_service();
  toast(msg);
  await refreshStatus();
  loadSessions();
}

// ---- 会话列表 ----
function sessionTitle(s) {
  if (s.title && s.title.trim()) return s.title.trim();
  return '会话 ' + String(s.sessionId).slice(-8);
}

async function loadSessions() {
  const items = await window.pywebview.api.list_sessions();
  state.sessions = items;
  const box = $('#session-list');
  box.innerHTML = '';
  for (const s of items) {
    const div = document.createElement('div');
    div.className = 'session-item' + (s.sessionId === state.currentId ? ' active' : '');
    div.textContent = sessionTitle(s);
    div.title = s.sessionId;
    div.addEventListener('click', () => openSession(s.sessionId));
    box.appendChild(div);
  }
  if (state.currentId && !items.some(s => s.sessionId === state.currentId)) {
    state.currentId = null;
    $('#chat-title').textContent = '选择或新建一个会话';
    $('#messages').innerHTML = '';
    $('#outline-list').innerHTML = '';
  }
}

async function newSession() {
  const id = await window.pywebview.api.create_session();
  await loadSessions();
  await openSession(id);
}

// ---- 消息渲染 ----
function renderMessages() {
  const box = $('#messages');
  box.innerHTML = '';
  for (const row of state.history) {
    box.appendChild(buildMessageEl(row));
  }
  box.scrollTop = box.scrollHeight;
}

function buildMessageEl(row) {
  const div = document.createElement('div');
  div.className = 'msg ' + row.kind;
  div.dataset.turn = String(row.turn ?? '');
  if (row.kind === 'user') {
    const tag = document.createElement('span');
    tag.className = 'turn-tag';
    tag.textContent = 'T' + (row.turn ?? '?');
    div.appendChild(tag);
  }
  const text = document.createElement('div');
  text.className = 'msg-text';
  text.textContent = row.text || ' ';
  div.appendChild(text);
  if (row.kind === 'user') {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    const btnRewind = document.createElement('button');
    btnRewind.textContent = '↩ 回退到这一步';
    btnRewind.addEventListener('click', () => rewindAt(row.seq));
    const btnRegen = document.createElement('button');
    btnRegen.textContent = '↻ 重新生成';
    btnRegen.addEventListener('click', () => regenerateAt(row.seq, row.text));
    actions.appendChild(btnRewind);
    actions.appendChild(btnRegen);
    div.appendChild(actions);
  }
  if (row.kind === 'assistant' && row.streaming) div.classList.add('streaming');
  return div;
}

// ---- 打开会话 ----
async function openSession(sessionId) {
  state.currentId = sessionId;
  state.history = [];
  state.streaming = false;
  state.streamTurn = null;
  state.streamStep = null;
  $('#chat-title').textContent = sessionTitle(
    state.sessions.find(s => s.sessionId === sessionId) ?? { sessionId }
  );
  document.querySelectorAll('.session-item').forEach(el => {
    el.classList.toggle('active', el.title === sessionId);
  });
  await loadHistory(sessionId);
  await loadOutline(sessionId);
}

async function loadHistory(sessionId) {
  const data = await window.pywebview.api.get_history(sessionId);
  if (data.error) {
    toast('加载历史失败：' + data.error);
    return;
  }
  state.events = data.events ?? [];
  state.history = flattenEvents(state.events);
  renderMessages();
}

function flattenEvents(events) {
  const rows = [];
  for (const ev of events) {
    const t = ev.type, d = ev.data ?? {};
    if (t === 'turn/start') {
      rows.push({ kind: 'boundary', turn: d.turn, text: '── 第 ' + d.turn + ' 轮 ──', seq: ev.seq });
    } else if (t === 'user/message') {
      rows.push({ kind: 'user', turn: d.turn, text: blocksText(d.content), seq: ev.seq });
    } else if (t === 'assistant/message') {
      rows.push({ kind: 'assistant', turn: d.turn, text: blocksText(d.message?.content), seq: ev.seq });
    } else if (t === 'assistant/chunk') {
      // 只保留最后一条（history 里的 chunk 是流式尾巴，历史以 message 为准）
      continue;
    } else if (t === 'tool/call') {
      rows.push({ kind: 'tool', turn: d.turn, text: '🔧 ' + (d.name ?? '工具') + '(...)', seq: ev.seq });
    }
  }
  return rows;
}

function blocksText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter(b => b && b.type === 'text')
    .map(b => b.text ?? '')
    .join('');
}

// ---- 大纲导航 ----
async function loadOutline(sessionId) {
  const turns = await window.pywebview.api.get_outline(sessionId);
  state.outline = turns;
  const box = $('#outline-list');
  box.innerHTML = '';
  if (turns.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'outline-meta';
    empty.textContent = '暂无对话';
    box.appendChild(empty);
    return;
  }
  for (const t of turns) {
    const row = document.createElement('div');
    row.className = 'outline-row';
    row.dataset.turn = String(t.turn);
    const first = document.createElement('div');
    first.innerHTML = '<span class="outline-turn">T' + t.turn + '</span><span class="outline-user">' +
      escHtml(t.userText || '（空）') + '</span>';
    const meta = document.createElement('div');
    meta.className = 'outline-meta';
    const reply = t.status === 'open' ? '生成中…'
      : t.hasToolCalls ? '工具调用'
      : (t.replyText ? t.replyText : '无回复');
    meta.textContent = reply;
    row.appendChild(first);
    row.appendChild(meta);
    row.addEventListener('click', () => jumpToTurn(t.turn, t.anchorSeq));
    box.appendChild(row);
  }
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function jumpToTurn(turn, anchorSeq) {
  // 在消息区定位到对应轮次的第一条消息
  const msgs = document.querySelectorAll('#messages .msg');
  for (const el of msgs) {
    if (Number(el.dataset.turn) === turn) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'blink 1s 2';
      document.querySelectorAll('.outline-row').forEach(r =>
        r.classList.toggle('active', Number(r.dataset.turn) === turn));
      return;
    }
  }
  toast('该轮消息尚未加载');
}

// ---- 发送 / 回退 / 重新生成 ----
async function sendPrompt() {
  const input = $('#input');
  const text = input.value.trim();
  if (!text || !state.currentId || state.streaming) return;
  input.value = '';
  input.style.height = 'auto';
  const res = await window.pywebview.api.send_prompt(state.currentId, text);
  if (!res.ok) {
    toast('发送失败：' + res.error);
    return;
  }
  // 乐观追加用户消息
  state.history.push({ kind: 'user', turn: '?', text, seq: -1 });
  state.history.push({ kind: 'assistant', turn: '?', text: '', streaming: true, seq: -1 });
  state.streaming = true;
  renderMessages();
  await loadHistory(state.currentId);
  await loadOutline(state.currentId);
}

async function rewindAt(seq) {
  if (!state.currentId) return;
  const res = await window.pywebview.api.fork_at(state.currentId, seq);
  if (!res.ok) { toast('回退失败：' + res.error); return; }
  toast('已创建分支，正在打开…');
  await loadSessions();
  await openSession(res.sessionId);
}

async function regenerateAt(seq, text) {
  if (!state.currentId) return;
  const res = await window.pywebview.api.fork_at(state.currentId, seq, text);
  if (!res.ok) { toast('重新生成失败：' + res.error); return; }
  toast('已创建分支并重新生成…');
  await loadSessions();
  await openSession(res.sessionId);
}

// ---- 实时事件（SSE 推送）----
window.__dshOnFrame = async function (frame) {
  const method = frame.method;
  const payload = frame.payload ?? {};
  const sid = payload.sessionId;
  if (sid !== state.currentId) {
    // 其它会话的事件：仅刷新会话列表（状态/标题变化）
    if (method === 'session/status' || method === 'session/title') loadSessions();
    return;
  }
  if (method === 'session/event') {
    const ev = payload.event ?? {};
    state.events.push(ev);
    // 增量更新消息区
    const t = ev.type, d = ev.data ?? {};
    if (t === 'user/message') {
      state.history.push({ kind: 'user', turn: d.turn, text: blocksText(d.content), seq: ev.seq });
      renderMessages();
    } else if (t === 'assistant/chunk') {
      // 流式追加到当前 assistant 消息
      const chunk = d.chunk ?? {};
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
        const last = state.history[state.history.length - 1];
        if (last && last.kind === 'assistant') {
          last.text += chunk.text;
          last.streaming = true;
          const box = $('#messages');
          const els = box.querySelectorAll('.msg.assistant');
          const target = els[els.length - 1];
          if (target) {
            target.querySelector('.msg-text').textContent = last.text;
            if (!target.classList.contains('streaming')) target.classList.add('streaming');
            box.scrollTop = box.scrollHeight;
          }
        }
      }
    } else if (t === 'assistant/message') {
      const last = state.history[state.history.length - 1];
      if (last && last.kind === 'assistant') {
        last.text = blocksText(d.message?.content);
        last.streaming = false;
      } else {
        state.history.push({ kind: 'assistant', turn: d.turn, text: blocksText(d.message?.content), seq: ev.seq });
      }
      renderMessages();
    } else if (t === 'turn/start') {
      state.history.push({ kind: 'boundary', turn: d.turn, text: '── 第 ' + d.turn + ' 轮 ──', seq: ev.seq });
      renderMessages();
    } else if (t === 'turn/end') {
      if (state.history.length) {
        const last = state.history[state.history.length - 1];
        if (last && last.kind === 'assistant') last.streaming = false;
      }
      state.streaming = false;
      renderMessages();
      loadOutline(state.currentId);
    }
  } else if (method === 'session/status') {
    // running 位变化
  }
};

// ---- 事件绑定 ----
function init() {
  $('#btn-start').addEventListener('click', onStart);
  $('#btn-stop').addEventListener('click', onStop);
  $('#btn-restart').addEventListener('click', onRestart);
  $('#btn-new').addEventListener('click', newSession);
  $('#btn-send').addEventListener('click', sendPrompt);
  $('#btn-outline-toggle').addEventListener('click', () => {
    $('#outline').classList.toggle('collapsed');
    const btn = $('#btn-outline-toggle');
    btn.textContent = $('#outline').classList.contains('collapsed') ? '❯' : '❮';
  });
  const input = $('#input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  });

  refreshStatus();
  loadSessions();
  setInterval(refreshStatus, 5000);
}

document.addEventListener('DOMContentLoaded', init);
