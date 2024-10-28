## Repositories query example:
query ReposQuery {
  repositories {
    id
    name 
    size 
    owner
  }
}

## Repository Details query example:
query RepoDetailsQuery($id: ID!, $filePath: String!) {
  repositoryDetails(id: $id, filePath: $filePath) {
    name
    size
    isPrivate
    filesAmount
    activeWebhooks {
      id
    }
    owner
    yamlContent
  }
}

## Variables example:
{
  "id": "R_kgDONFWhJg",
  "filePath": "testdata/kubeconfig-2.yaml"
}