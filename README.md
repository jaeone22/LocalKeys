# CLI

```bash
# Check project list
localkeys list

# Save your secret
localkeys set myapp API_KEY "sk-1234567890abcdef"

# Secret lookup
localkeys get myapp API_KEY

# Executing commands with environment variables
localkeys run --project=myapp -- npm start
```

# 빌드

```bash
# Build
npm run build

npm run build -- --mac
npm run build -- --win
npm run build -- --linux
```
