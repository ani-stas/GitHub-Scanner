export interface IFilesResponse {
  sha: string;
  url: string;
  tree: IFile[];
}

interface IFile {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size: number;
  url: string;
}
