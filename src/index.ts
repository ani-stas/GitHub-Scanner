import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import {
  IFetchRepositoriesResult,
  IFetchRepositoryDetailsResult,
  IFilesResponse,
  IRepositoriesResponse,
  IRepositoryDetailsResponse,
  IWebhookResponse,
} from "./interfaces";
import PQueue from "p-queue";
import dotenv from "dotenv";

dotenv.config();

const queue = new PQueue({ concurrency: 2 });
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

enum FileType {
  BLOB = "blob",
}

const typeDefs = `#graphql
  type Webhook {
    id: ID
    url: String
    active: Boolean
    events: [String]
    createdAt: String
    updatedAt: String
  }
  type Repository {
    id: ID
    name: String
    size: Int
    owner: String
    isPrivate: Boolean
    filesAmount: Int
    yamlContent: String
    activeWebhooks: [Webhook] 
  }
  type Query {
    repositories: [Repository],
    repositoryDetails(id: ID!, filePath: String!): Repository
  }
`;

const fetchRepositories = async (): Promise<IFetchRepositoriesResult[]> => {
  const reposResponse = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      query: `
        query {
          viewer {
            repositories(last: 10) {
              nodes {
                id
                name
                diskUsage
                owner {
                  login
                }
              }
            }
          }
        }
      `,
    }),
  });

  const reposResponseJson =
    (await reposResponse.json()) as IRepositoriesResponse;

  if (!reposResponseJson.data?.viewer.repositories.nodes) {
    throw new Error("Failed to fetch data from GitHub API");
  }

  const mappedResult: IFetchRepositoriesResult[] =
    reposResponseJson.data.viewer.repositories.nodes.map((elem) => ({
      ...elem,
      size: elem.diskUsage,
      owner: elem.owner.login,
    }));

  return mappedResult;
};

const fetchRepositoryDetails = async (
  id: string,
  filePath: string
): Promise<IFetchRepositoryDetailsResult> => {
  const repoDetailsResponse = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      query: `
        query ($id: ID!) {
          node(id: $id) {
            ... on Repository {
              id
              name
              isPrivate
              diskUsage
              owner {
                login
              }
              fileObject: object(expression: "HEAD:${filePath}") {
                ... on Blob {
                  text
                }
              }
            }
          }
        }
      `,
      variables: { id, filePath },
    }),
  });

  const repoDetailsJson =
    (await repoDetailsResponse.json()) as IRepositoryDetailsResponse;

  if (!repoDetailsJson.data || !repoDetailsJson.data?.node) return null;

  const {
    owner: repoOwner,
    name: repoName,
  }: { owner: { login: string }; name: string } = repoDetailsJson.data.node;

  const filesAmount = await getRepositoryFiles(repoOwner.login, repoName);
  const activeWebhooks = await getWebhooks(repoOwner.login, repoName);

  return {
    ...repoDetailsJson.data.node,
    owner: repoDetailsJson.data.node.owner.login,
    size: repoDetailsJson.data.node.diskUsage,
    yamlContent: repoDetailsJson.data.node.fileObject?.text || null,
    filesAmount,
    activeWebhooks,
  };
};

const getRepositoryFiles = async (
  repoOwner: string,
  repoName: string
): Promise<number> => {
  const response = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/main?recursive=1`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    }
  );

  const responseJson = (await response.json()) as IFilesResponse;
  const filteredFiles = responseJson.tree.filter(
    (item) => item.type === FileType.BLOB
  );

  return filteredFiles.length;
};

const getWebhooks = async (
  repoOwner: string,
  repoName: string
): Promise<IWebhookResponse[]> => {
  const webhooksResponse = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/hooks`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    }
  );

  const webhooksData = (await webhooksResponse.json()) as IWebhookResponse[];
  return webhooksData.filter((elem) => elem.active);
};

const resolvers = {
  Query: {
    repositories: async () => await fetchRepositories(),
    repositoryDetails: async (_, { id, filePath }) => {
      return await queue.add(() => fetchRepositoryDetails(id, filePath));
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

await startStandaloneServer(server, {
  listen: { port: 4000 },
});
