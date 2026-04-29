export type { RawSourceItem } from "./source-types";

export interface SourceAdapter {
  name: string;
  fetchItems(): Promise<import("./source-types").RawSourceItem[]>;
}
