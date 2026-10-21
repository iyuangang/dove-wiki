import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

export function useDialogFocus(target: Ref<HTMLElement | null>) {
  let panel: HTMLElement | null = null
  let previous: HTMLElement | null = null
  const controls = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])') || [])
    .filter(element => element.getClientRects().length && !element.closest('[inert]'))
  function trap(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !panel) return
    const items = controls()
    const first = items[0]
    const last = items.at(-1)
    if (!first) { event.preventDefault(); panel.focus(); return }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault(); last?.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) {
      event.preventDefault(); first.focus()
    }
  }
  function contain(event: FocusEvent) {
    if (panel && event.target instanceof Node && !panel.contains(event.target)) panel.focus({ preventScroll: true })
  }
  function release() {
    panel?.removeEventListener('keydown', trap)
    document.removeEventListener('focusin', contain)
    panel = null
    if (previous?.isConnected) previous.focus({ preventScroll: true })
    previous = null
  }
  watch(target, async element => {
    release()
    if (!element) return
    previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel = element
    panel.addEventListener('keydown', trap)
    document.addEventListener('focusin', contain)
    await nextTick()
    if (panel === element) element.focus({ preventScroll: true })
  }, { flush: 'post' })
  onBeforeUnmount(release)
}
