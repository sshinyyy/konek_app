export async function readJsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(fallback);
    throw error;
  }
}
