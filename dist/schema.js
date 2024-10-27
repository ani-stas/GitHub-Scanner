export const typeDefs = `#graphql
  type Owner {
    login: String
  }
  type Repository {
    id: ID
    name: String
    diskUsage: Int
    owner: Owner
    isPrivate: Boolean
    fileCount: Int
    yamlContent: String
  }
  type Query {
    repositories: [Repository],
    repositoryDetails(id: ID!, filePath: String!): Repository
  }
`;
