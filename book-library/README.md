## Local Book Library (ignored by git)

This folder is for your local PDF/unit files.
It is intentionally git-ignored so large files never get committed.

### Recommended structure

Use one folder per book, then one PDF per unit.

```text
book-library/
  books.example.json
  Cambridge-Kids-Book-1/
    Unit-01.pdf
    Unit-02.pdf
    Unit-03.pdf
  Oxford-Stars-Book-2/
    Unit-01.pdf
    Unit-02.pdf
```

### Manifest file

Use `books.example.json` as your template and rename/copy it later to the final manifest name used by the app.

Each unit should reference a relative path from project root (for consistency), for example:

- `book-library/Cambridge-Kids-Book-1/Unit-01.pdf`
- `book-library/Oxford-Stars-Book-2/Unit-02.pdf`

### Important notes

- Keep unit files reasonably sized when possible for faster open/render.
- If you rename/move a unit PDF, update the manifest path to match.
- Progress restore should be keyed by `bookId + unitId` so page history stays stable.
