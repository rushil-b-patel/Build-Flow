export const AUTH_STATE_CHANGED_EVENT = "bf:auth-state-changed";

export function notifyAuthStateChanged() {
    window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
}
