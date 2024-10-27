export interface IFile {
  text: string;
}

interface INode {
  id: string;
  name: string;
  diskUsage: number;
  owner: {
    login: string;
  };
  fileObject: IFile;
}

export interface IRepositoryDetailsResponse {
  data: {
    node: INode;
  };
}
