export type SearchResultHit = {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string | null;
};

export interface RoleSearchClient {
  search(query: string, limit: number): Promise<SearchResultHit[]>;
}
