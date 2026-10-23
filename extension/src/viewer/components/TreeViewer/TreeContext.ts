import { DiffByPath } from "@/viewer/commons/Diff";
import { TreeNavigator } from "./TreeNavigator";

export type TreeContext = {
  tree: TreeNavigator;
  enableEnterNode: boolean;
  viewerId: string;
  diffByPath?: DiffByPath;
};
