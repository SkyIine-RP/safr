# SAFR Handbook

The San Andreas First Responders website for Skyline Roleplay: SOPs, roster, vehicles and uniforms.

## Put it online (one time, about 5 minutes)

1. Sign in to [github.com](https://github.com) (make a free account if you don't have one).
2. Click **+** (top right) → **New repository**. Name it `safr`, set it to **Public**, and click **Create repository**.
3. On the new repo page, click **uploading an existing file**. Drag in **everything inside this folder** (`index.html`, `README.md`, and the `assets` and `data` folders). Click **Commit changes**.
4. Go to **Settings** → **Pages**. Under **Branch**, pick `main` and `/ (root)`, then **Save**.
5. Wait a minute and refresh. Your link shows at the top of that page, like `https://yourname.github.io/safr/`.

## Let command edit

**Settings** → **Collaborators** → **Add people**, then enter their GitHub username. They get an invite by email.

## Editing

Everything you'd change lives in the `data` folder. Open a file on GitHub, click the **pencil** to edit, then **Commit changes**. The site updates within a minute or two.

| File | What it is |
|---|---|
| `data/roster.csv` | The roster. One person per line: `Name,Callsign,Rank,Status,Certs,Join Date`. Status is `Active`, `LOA` or `Inactive`. Put quotes around certs with commas: `"FTO, Air"` |
| `data/ranks.csv` | Rank names and their order. The roster and uniforms are sorted by this. `Tier` is `High Command` (gold), `Command` (red), `Supervisor` (orange), `Shift Lead` (purple), or empty |
| `data/sops.md` | The SOPs. `##` starts a new section (it shows in the side menu), `###` a smaller heading. Start a table row with `★` to highlight it as **Common** |
| `data/vehicles.csv` | Vehicles. `Livery #` is the number you'd use with `/liv` |
| `data/clothing.csv` | Uniforms. Each piece is `style/color`, for example `250/3`. Leave a cell empty to show "Not set" |

**Tip:** GitHub shows `.csv` files as a table. When you click the pencil you edit the plain text, so keep the commas lined up with the header.

## Undo a bad change

Open the file → **History** → click the change → the `...` menu → **View file** at the version before. Copy it, edit the current file, paste, and commit. Every edit is saved with who made it.
