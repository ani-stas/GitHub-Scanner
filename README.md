## Repositories query example:
```javascript
query ReposQuery {
  repositories {
    id
    name 
    size 
    owner
  }
}
```

## Repository Details query example:
```javascript
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
```

## Variables example:
```json
{
  "id": "R_kgDONFWhJg",
  "filePath": "testdata/kubeconfig-2.yaml"
}
```
