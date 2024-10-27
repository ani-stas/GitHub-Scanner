import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import {
  IFetchRepositoriesResult,
  IFile,
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

const fetchRepositories = async () => {
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

const fetchRepositoryDetails = async (id: string, filePath: string) => {
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

  const filesResponse = await fetch(
    `https://api.github.com/repos/${repoOwner.login}/${repoName}/git/trees/main?recursive=1`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    }
  );

  const filesResponseJson = (await filesResponse.json()) as IFilesResponse;
  const filesAmount: number = filesResponseJson.tree.filter(
    (item) => item.type === FileType.BLOB
  ).length;

  let yamlContent = null;
  const fileObject: IFile = repoDetailsJson.data.node.fileObject;
  if (fileObject) yamlContent = fileObject.text;

  const webhooksResponse = await fetch(
    `https://api.github.com/repos/${repoOwner.login}/${repoName}/hooks`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    }
  );

  const webhooksData = (await webhooksResponse.json()) as IWebhookResponse[];
  const activeWebhooks: IWebhookResponse[] = webhooksData.filter(
    (elem) => elem.active
  );

  return {
    ...repoDetailsJson.data.node,
    owner: repoDetailsJson.data.node.owner.login,
    size: repoDetailsJson.data.node.diskUsage,
    filesAmount,
    yamlContent,
    activeWebhooks,
  };
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
