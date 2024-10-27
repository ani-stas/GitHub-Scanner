interface IRepositories {
  nodes: INode[];
}

interface INode {
  id: string;
  name: string;
  diskUsage: number;
  owner: {
    login: string;
  };
}

export interface IRepositoriesResponse {
  data: {
    viewer: {
      repositories: IRepositories;
    };
  };
}
