const TOKEN_KEY = "contextos.token";
const PAGE_CONTEXT_KEY = "contextos.includePageContext";

export async function getToken(): Promise<string | null> {
  const value = await chrome.storage.local.get(TOKEN_KEY);
  return (value[TOKEN_KEY] as string | undefined) ?? null;
}

export async function setToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [TOKEN_KEY]: token });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove(TOKEN_KEY);
}

/** Per-device override of the "include page context" toggle in the overlay. */
export async function getIncludePageContext(): Promise<boolean | null> {
  const value = await chrome.storage.local.get(PAGE_CONTEXT_KEY);
  return (value[PAGE_CONTEXT_KEY] as boolean | undefined) ?? null;
}

export async function setIncludePageContext(value: boolean): Promise<void> {
  await chrome.storage.local.set({ [PAGE_CONTEXT_KEY]: value });
}
