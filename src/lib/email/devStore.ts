export interface DevEmail {
  to: string;
  subject: string;
  body: string;
  sentAt: Date;
}

// Use globalThis to persist store across vi.resetModules() in tests
const getGlobalStore = () => {
  if (!globalThis.__devEmailStore) {
    globalThis.__devEmailStore = [];
  }
  return globalThis.__devEmailStore as DevEmail[];
};

export function recordDevEmail(email: Omit<DevEmail, "sentAt">): void {
  const store = getGlobalStore();
  store.unshift({ ...email, sentAt: new Date() });
  if (store.length > 50) store.pop();
}

export function getDevEmails(): DevEmail[] {
  return getGlobalStore();
}

export function clearDevEmails(): void {
  const store = getGlobalStore();
  store.length = 0;
}
