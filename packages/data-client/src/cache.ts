export interface DataClientCache {
  get(url: string): Promise<Response | undefined> | Response | undefined;
  set(url: string, response: Response): Promise<void> | void;
  delete(url: string): Promise<void> | void;
}

export class MemoryDataClientCache implements DataClientCache {
  private readonly responses = new Map<string, Response>();

  get(url: string): Response | undefined {
    const response = this.responses.get(url);
    return response?.clone();
  }

  set(url: string, response: Response): void {
    this.responses.set(url, response.clone());
  }

  delete(url: string): void {
    this.responses.delete(url);
  }
}
