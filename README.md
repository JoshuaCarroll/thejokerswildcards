# thejokerswildcards

## Baseball Card Thumbnail Gallery

A new page is available at `cards.html` that loads baseball card thumbnails from a single folder in this repo.

### Folder and file naming

1. Put card images in a folder named `cards` at the repo root.
2. Name files like:
	- `griffey-1989-upper-deck-front.jpg`
	- `griffey-1989-upper-deck-back.jpg`
3. The page pairs files by the shared prefix before `-front` / `-back`.

### How loading works

- The page uses client-side JavaScript and the public GitHub Contents API.
- No backend is required.
- On GitHub Pages, it will render all matching pairs automatically.

### Config

The configuration is in `cards.html` under `window.CARDS_GALLERY_CONFIG`:

- `owner`
- `repo`
- `branch`
- `imagesPath`

Update these values if your repo name, branch, or image folder changes.