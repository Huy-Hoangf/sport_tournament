export async function loadAllMatchPages<T>(fetchPage: (page: number) => Promise<{ items: T[]; total: number }>): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  while (true) {
    const result = await fetchPage(page++);
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) return items;
  }
}
