/** Scripts executed inside the DSH web UI to drive its own controls. */

/** Click the sidebar fold toggle (present in both states). */
export const SIDEBAR_TOGGLE_JS = `(() => {
  const button = document.querySelector('button[aria-label="收起侧边栏"], button[aria-label="打开侧边栏"]')
  if (button instanceof HTMLButtonElement) {
    button.click()
    return true
  }
  return false
})()`

/** Show a transient hint pill at the top center of the page. */
export function hintPillHtml(text: string): string {
  const safe = text.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] ?? c)
  return `(() => {
    const id = 'dsh-desktop-hint'
    document.getElementById(id)?.remove()
    const pill = document.createElement('div')
    pill.id = id
    pill.textContent = ${JSON.stringify(text)}
    pill.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;padding:6px 14px;border-radius:999px;background:rgba(30,30,30,0.85);color:#fff;font:13px system-ui;box-shadow:0 2px 10px rgba(0,0,0,0.3);pointer-events:none;transition:opacity .2s;'
    document.body.appendChild(pill)
    setTimeout(() => { pill.style.opacity = '0' }, 400)
    setTimeout(() => pill.remove(), 650)
  })()`
}
