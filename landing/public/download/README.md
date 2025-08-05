# Download Files Organization

This directory contains downloadable files for the Opus releases. The files should be organized in the following structure:

```
public/
  downloads/
    op0/         # Opus 0
      no0.pdf    # Release 0
      no1.pdf    # Release 1
    op1/         # Opus 1
      no0.pdf    # Release 0
      no1.pdf    # Release 1
```

## Naming Convention

- `op{number}/` - Directory for each opus (e.g., `op0`, `op1`, etc.)
- `no{number}.pdf` - Individual release files (e.g., `no0.pdf`, `no1.pdf`)

## Adding New Releases

1. Create a directory for the opus if it doesn't exist: `mkdir -p public/downloads/op{opus_number}`
2. Add the PDF file with the correct naming: `cp your-file.pdf public/downloads/op{opus_number}/no{release_number}.pdf`
3. The file will be automatically available at: `/download/op{opus_number}/no{release_number}`

## Example

For Opus 0, Release 1, the path would be:

- File: `public/downloads/op0/no1.pdf`
- URL: `/download/op0/no1`
